'use strict';

// Sistema de planos do Cortex

const PLANOS = {
  gratis: {
    nome: 'Grátis',
    mensagensDiarias: 20,
    creditosMensais: 0,
    modelosPermitidos: ['rapido'],
    maxAgentes: 3,
    sitesPorMes: 0,
    usuarios: 1,
    contasFilhas: 0,
    precoMensal: { BRL: 0, USD: 0 }
  },
  basico: {
    nome: 'Básico',
    mensagensDiarias: 0, // Ilimitado
    creditosMensais: 1500,
    modelosPermitidos: ['rapido', 'forte'],
    maxAgentes: 10,
    sitesPorMes: 0,
    usuarios: 1,
    contasFilhas: 0,
    precoMensal: { BRL: 29, USD: 9 }
  },
  pro: {
    nome: 'Pró',
    mensagensDiarias: 0, // Ilimitado
    creditosMensais: 5000,
    modelosPermitidos: ['rapido', 'forte', 'avançado'],
    maxAgentes: 20,
    sitesPorMes: 1,
    usuarios: 1,
    contasFilhas: 0,
    precoMensal: { BRL: 79, USD: 19 }
  },
  negocio: {
    nome: 'Negócio',
    mensagensDiarias: 0, // Ilimitado
    creditosMensais: 15000,
    modelosPermitidos: ['rapido', 'forte', 'avançado', 'premium'],
    maxAgentes: 50,
    sitesPorMes: 3,
    usuarios: 3,
    contasFilhas: 0,
    precoMensal: { BRL: 199, USD: 49 }
  },
  revenda: {
    nome: 'Revenda',
    mensagensDiarias: 0, // Ilimitado
    creditosMensais: 0,
    modelosPermitidos: ['todos'],
    maxAgentes: 100,
    sitesPorMes: 0,
    usuarios: 0,
    contasFilhas: 10,
    precoMensal: { BRL: 499, USD: 129 }
  }
};

// Custo por modelo (em créditos)
const CUSTO_MODELO = {
  rapido: 1,
  forte: 3,
  avancado: 5,
  premium: 10
};

// Função para calcular o custo de uma mensagem
function calcularCustoMensagem(modelo, tamanho = 1) {
  const custoPorToken = CUSTO_MODELO[modelo] || 0;
  return Math.ceil(tamanho * custoPorToken / 1000); // Arredonda para cima a cada 1000 tokens
}

// Função para obter o plano do usuário
function getPlanoUsuario(uid, planoAtual) {
  // Aqui você buscaria o plano do usuário no Firestore ou outra fonte
  // Por enquanto, vamos retornar o plano informado
  return planoAtual;
}

// Função para registrar o uso de mensagens
async function registrarUsoMensagem(uid, modelo, tamanho, db) {
  const hoje = new Date();
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  
  const path = `cortexClientes/${uid}/uso/${mesAno}`;
  
  // Registra o uso
  const usoRef = db.collection(path);
  const hojeStr = hoje.toISOString().split('T')[0];
  
  // Adiciona o uso de hoje
  await usoRef.doc(hojeStr).set({
    mensagens: admin.firestore.FieldValue.increment(1),
    tokens: admin.firestore.FieldValue.increment(tamanho),
    modelo,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  // Adiciona ao total do mês
  await usoRef.doc('total').set({
    mensagens: admin.firestore.FieldValue.increment(1),
    tokens: admin.firestore.FieldValue.increment(tamanho),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// Função para verificar se o usuário tem créditos suficientes
async function verificarCreditos(uid, modelo, tamanho, db, planoAtual) {
  const plano = getPlanoUsuario(uid, planoAtual);
  
  if (!plano) {
    throw new Error('Plano não encontrado');
  }
  
  const planoConfig = PLANOS[plano];
  
  // Verifica se o modelo é permitido
  if (!planoConfig.modelosPermitidos.includes(modelo)) {
    return {
      permitido: false,
      motivo: 'Modelo não permitido para seu plano',
      plano: plano,
      opcaoMudarPlano: true
    };
  }
  
  // Verifica limite diário para plano grátis
  if (plano === 'gratis') {
    const hoje = new Date();
    const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const path = `cortexClientes/${uid}/uso/${mesAno}`;
    
    const hojeStr = hoje.toISOString().split('T')[0];
    const doc = await db.collection(path).doc(hojeStr).get();
    
    const mensagensHoje = doc.data()?.mensagens || 0;
    
    if (mensagensHoje >= planoConfig.mensagensDiarias) {
      return {
        permitido: false,
        motivo: 'Limite diário de mensagens atingido',
        plano: plano,
        opcaoMudarPlano: true
      };
    }
  }
  
  // Verifica créditos mensais para planos pagos
  if (plano !== 'gratis' && plano !== 'revenda') {
    const hoje = new Date();
    const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const path = `cortexClientes/${uid}/uso/${mesAno}`;
    
    const doc = await db.collection(path).doc('total').get();
    
    const creditosUsados = doc.data()?.tokens || 0;
    const custo = calcularCustoMensagem(modelo, tamanho);
    
    if (creditosUsados + custo > planoConfig.creditosMensais) {
      return {
        permitido: false,
        motivo: 'Créditos insuficientes para este mês',
        plano: plano,
        opcaoMudarPlano: true,
        creditosRestantes: planoConfig.creditosMensais - creditosUsados
      };
    }
  }
  
  return {
    permitido: true,
    plano: plano,
    custo: calcularCustoMensagem(modelo, tamanho)
  };
}

// Função para consumir créditos
async function consumirCreditos(uid, modelo, tamanho, db, planoAtual) {
  const resultado = await verificarCreditos(uid, modelo, tamanho, db, planoAtual);
  
  if (!resultado.permitido) {
    return resultado;
  }
  
  // Registra o uso
  await registrarUsoMensagem(uid, modelo, tamanho, db);
  
  return {
    permitido: true,
    plano: resultado.plano,
    custo: resultado.custo,
    mensagem: 'Uso registrado com sucesso'
  };
}

// Função para obter o uso atual do usuário
async function getUsoAtual(uid, db) {
  const hoje = new Date();
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const path = `cortexClientes/${uid}/uso/${mesAno}`;
  
  const hojeStr = hoje.toISOString().split('T')[0];
  
  // Pega o uso de hoje
  const docHoje = await db.collection(path).doc(hojeStr).get();
  const usoHoje = docHoje.data() || {};
  
  // Pega o total do mês
  const docTotal = await db.collection(path).doc('total').get();
  const usoTotal = docTotal.data() || {};
  
  return {
    hoje: {
      mensagens: usoHoje.mensagens || 0,
      tokens: usoHoje.tokens || 0
    },
    mes: {
      mensagens: usoTotal.mensagens || 0,
      tokens: usoTotal.tokens || 0
    }
  };
}

// Função para obter informações do plano atual
function getPlanoInfo(plano) {
  return PLANOS[plano] || null;
}

// Função para verificar se o mês virou
function mesVirou(agora = Date.now()) {
  const hoje = new Date(agora);
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  
  // Verifica se é o primeiro dia do mês
  return hoje.getDate() === 1;
}

module.exports = {
  PLANOS,
  CUSTO_MODELO,
  calcularCustoMensagem,
  getPlanoUsuario,
  registrarUsoMensagem,
  verificarCreditos,
  consumirCreditos,
  getUsoAtual,
  getPlanoInfo,
  mesVirou
};