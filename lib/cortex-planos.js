'use strict';

// Definição dos planos do Cortex
const PLANOS = {
  gratis: {
    nome: 'Grátis',
    mensagensPorDia: 20,
    creditosPorMes: 0,
    modelosPermitidos: ['rapido'],
    maxAgentes: 3,
    precoReal: { BRL: 0, USD: 0 },
    descricao: '20 mensagens/dia, só IAs rápidas, 3 agentes'
  },
  basico: {
    nome: 'Básico',
    mensagensPorDia: 0, // Ilimitado
    creditosPorMes: 1500,
    modelosPermitidos: ['rapido', 'forte'],
    maxAgentes: 5,
    maxSites: 0,
    maxUsuarios: 1,
    contasFilhas: 0,
    precoReal: { BRL: 29, USD: 9 },
    descricao: '1500 créditos/mês, IAs rápidas e fortes, 5 agentes'
  },
  pro: {
    nome: 'Pro',
    mensagensPorDia: 0, // Ilimitado
    creditosPorMes: 5000,
    modelosPermitidos: ['rapido', 'forte', 'premium'],
    maxAgentes: 10,
    maxSites: 1,
    maxUsuarios: 1,
    contasFilhas: 0,
    precoReal: { BRL: 79, USD: 19 },
    descricao: '5000 créditos/mês, IAs fortes e premium, 1 site/mês, 10 agentes'
  },
  negocio: {
    nome: 'Negócio',
    mensagensPorDia: 0, // Ilimitado
    creditosPorMes: 15000,
    modelosPermitidos: ['rapido', 'forte', 'premium'],
    maxAgentes: 20,
    maxSites: 3,
    maxUsuarios: 3,
    contasFilhas: 0,
    precoReal: { BRL: 199, USD: 49 },
    descricao: '15000 créditos, 3 usuários, 3 sites, 20 agentes'
  },
  revenda: {
    nome: 'Revenda',
    mensagensPorDia: 0, // Ilimitado
    creditosPorMes: 0, // Não se aplica
    modelosPermitidos: ['rapido', 'forte', 'premium'],
    maxAgentes: 0, // Não se aplica
    maxSites: 0, // Não se aplica
    maxUsuarios: 0, // Não se aplica
    contasFilhas: 10,
    precoReal: { BRL: 499, USD: 129 },
    descricao: '10 contas filhas com acesso completo'
  }
};

// Modelos disponíveis e seus custos base por caractere
const MODELOS = {
  rapido: {
    nome: 'IA Rápida',
    custoPorCaractere: 0.0001,
    custoPorToken: 0.00015,
    maxTokens: 4000,
    descricao: 'Modelo rápido e econômico para tarefas simples'
  },
  forte: {
    nome: 'IA Forte',
    custoPorCaractere: 0.0003,
    custoPorToken: 0.0005,
    maxTokens: 8000,
    descricao: 'Modelo mais poderoso para tarefas complexas'
  },
  premium: {
    nome: 'IA Premium',
    custoPorCaractere: 0.0008,
    custoPorToken: 0.0012,
    maxTokens: 16000,
    descricao: 'Modelo de alta performance para tarefas avançadas'
  }
};

// Função para calcular o custo de uma mensagem baseado no tamanho e modelo
function calcularCustoMensagem(conteudo, modelo) {
  if (!MODELOS[modelo]) {
    throw new Error(`Modelo '${modelo}' não existe. Modelos disponíveis: ${Object.keys(MODELOS).join(', ')}`);
  }

  const modeloInfo = MODELOS[modelo];
  const caracteres = conteudo.length;
  
  // Cálculo baseado no número de caracteres
  let custo = caracteres * modeloInfo.custoPorCaractere;
  
  // Arredondamento para 4 casas decimais
  custo = Math.round(custo * 10000) / 10000;
  
  // Garante que o custo mínimo seja 0.0001 (para mensagens muito curtas)
  custo = Math.max(custo, 0.0001);
  
  return {
    custo,
    caracteres,
    modelo,
    modeloInfo,
    calculo: `(${caracteres} caracteres × ${modeloInfo.custoPorCaractere}) = ${custo}`
  };
}

// Função para verificar se um usuário tem créditos suficientes para uma mensagem
function temCreditosSuficientes(usuario, conteudo, modelo) {
  const plano = PLANOS[usuario.plano];
  if (!plano) {
    throw new Error(`Plano '${usuario.plano}' não existe`);
  }

  const calculo = calcularCustoMensagem(conteudo, modelo);
  const creditosDisponiveis = usuario.creditos || 0;
  
  return {
    podeExecutar: creditosDisponiveis >= calculo.custo,
    calculo,
    creditosDisponiveis,
    creditosNecessarios: calculo.custo,
    sobra: creditosDisponiveis - calculo.custo
  };
}

// Função para deduzir créditos após o uso de uma mensagem
function deduzirCreditos(usuario, conteudo, modelo) {
  const verificado = temCreditosSuficientes(usuario, conteudo, modelo);
  
  if (!verificado.podeExecutar) {
    throw new Error(
      `Créditos insuficientes. Necessário: ${verificado.creditosNecessarios}, disponível: ${verificado.creditosDisponiveis}`
    );
  }

  const calculo = calcularCustoMensagem(conteudo, modelo);
  const creditosAtualizados = {
    ...usuario,
    creditos: usuario.creditos - calculo.custo,
    ultimoUso: new Date().toISOString(),
    historico: [
      ...(usuario.historico || []),
      {
        modelo,
        caracteres: calculo.caracteres,
        custo: calculo.custo,
        timestamp: new Date().toISOString(),
        plano: usuario.plano
      }
    ]
  };

  return {
    usuarioAtualizado: creditosAtualizados,
    calculo,
    creditosDeduzidos: calculo.custo,
    creditosRestantes: creditosAtualizados.creditos
  };
}

// Função para adicionar créditos mensais (usada no início do ciclo de faturamento)
function adicionarCreditosMensais(usuario) {
  const plano = PLANOS[usuario.plano];
  if (!plano) {
    throw new Error(`Plano '${usuario.plano}' não existe`);
  }

  // Planos gratuitos não recebem créditos mensais
  if (plano.creditosPorMes === 0) {
    return {
      usuario,
      creditosAdicionados: 0,
      mensagem: 'Plano gratuito não recebe créditos mensais'
    };
  }

  const creditosAtuais = usuario.creditos || 0;
  const novosCreditos = creditosAtuais + plano.creditosPorMes;

  return {
    usuario: {
      ...usuario,
      creditos: novosCreditos,
      creditosAdicionados: plano.creditosPorMes,
      dataUltimoCredito: new Date().toISOString(),
      cicloAtual: (usuario.cicloAtual || 0) + 1
    },
    creditosAdicionados: plano.creditosPorMes,
    totalCreditos: novosCreditos,
    mensagem: `Adicionados ${plano.creditosPorMes} créditos. Total: ${novosCreditos}`
  };
}

// Função para verificar limites do plano
function verificarLimites(usuario, acao) {
  const plano = PLANOS[usuario.plano];
  if (!plano) {
    throw new Error(`Plano '${usuario.plano}' não existe`);
  }

  const resultado = {
    permitido: true,
    limites: {},
    violacoes: []
  };

  // Verificar limite de mensagens por dia (apenas para plano gratuito)
  if (plano.mensagensPorDia > 0) {
    const hoje = new Date().toISOString().slice(0, 10);
    const mensagensHoje = (usuario.historico || []).filter(
      h => h.timestamp.slice(0, 10) === hoje && h.modelo !== 'sistema'
    ).length;
    
    resultado.limites.mensagensHoje = { atual: mensagensHoje, maximo: plano.mensagensPorDia };
    
    if (mensagensHoje >= plano.mensagensPorDia) {
      resultado.permitido = false;
      resultado.violacoes.push(`Limite de ${plano.mensagensPorDia} mensagens/dia atingido`);
    }
  }

  // Verificar limite de agentes
  if (plano.maxAgentes > 0 && acao === 'criarAgente') {
    const agentesAtuais = (usuario.agentes || []).length;
    resultado.limites.agentes = { atual: agentesAtuais, maximo: plano.maxAgentes };
    
    if (agentesAtuais >= plano.maxAgentes) {
      resultado.permitido = false;
      resultado.violacoes.push(`Limite de ${plano.maxAgentes} agentes atingido`);
    }
  }

  // Verificar limite de sites
  if (plano.maxSites > 0 && acao === 'criarSite') {
    const sitesAtuais = (usuario.sites || []).length;
    resultado.limites.sites = { atual: sitesAtuais, maximo: plano.maxSites };
    
    if (sitesAtuais >= plano.maxSites) {
      resultado.permitido = false;
      resultado.violacoes.push(`Limite de ${plano.maxSites} sites atingido`);
    }
  }

  // Verificar limite de usuários
  if (plano.maxUsuarios > 0 && acao === 'adicionarUsuario') {
    const usuariosAtuais = (usuarios || []).length;
    resultado.limites.usuarios = { atual: usuariosAtuais, maximo: plano.maxUsuarios };
    
    if (usuariosAtuais >= plano.maxUsuarios) {
      resultado.permitido = false;
      resultado.violacoes.push(`Limite de ${plano.maxUsuarios} usuários atingido`);
    }
  }

  // Verificar limite de contas filhas
  if (plano.contasFilhas > 0 && acao === 'criarContaFilha') {
    const contasFilhasAtuais = (usuario.contasFilhas || []).length;
    resultado.limites.contasFilhas = { atual: contasFilhasAtuais, maximo: plano.contasFilhas };
    
    if (contasFilhasAtuais >= plano.contasFilhas) {
      resultado.permitido = false;
      resultado.violacoes.push(`Limite de ${plano.contasFilhas} contas filhas atingido`);
    }
  }

  return resultado;
}

// Função para ob informações do plano atual
function infoPlano(usuario) {
  const plano = PLANOS[usuario.plano];
  if (!plano) {
    throw new Error(`Plano '${usuario.plano}' não existe`);
  }

  return {
    plano: usuario.plano,
    nomePlano: plano.nome,
    creditosAtuais: usuario.creditos || 0,
    creditosMensais: plano.creditosPorMes,
    descricao: plano.descricao,
    precoReal: plano.precoReal,
    modelosPermitidos: plano.modelosPermitidos,
    limites: {
      mensagensPorDia: plano.mensagensPorDia,
      maxAgentes: plano.maxAgentes,
      maxSites: plano.maxSites,
      maxUsuarios: plano.maxUsuarios,
      contasFilhas: plano.contasFilhas
    },
    dataUltimoCredito: usuario.dataUltimoCredito || null,
    cicloAtual: usuario.cicloAtual || 0
  };
}

module.exports = {
  PLANOS,
  MODELOS,
  calcularCustoMensagem,
  temCreditosSuficientes,
  deduzirCreditos,
  adicionarCreditosMensais,
  verificarLimites,
  infoPlano
};
