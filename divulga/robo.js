const fs = require('fs');
const path = require('path');

const ESTADO_PATH = path.join(__dirname, 'estado.json');

function carregarEstado() {
  const raw = fs.readFileSync(ESTADO_PATH, 'utf-8');
  return JSON.parse(raw);
}

function salvarEstado(estado) {
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2), 'utf-8');
}

function escolherProximoCliente(estado) {
  const { clientes, rodizioIndex } = estado;
  if (!clientes || clientes.length === 0) {
    return null;
  }
  const cliente = clientes[rodizioIndex % clientes.length];
  estado.rodizioIndex = (rodizioIndex + 1) % clientes.length;
  return cliente;
}

function gerarPost(cliente) {
  const baseUrl = 'https://exemplo.com/oferta';
  const utmParams = new URLSearchParams({
    utm_source: cliente.utm_source,
    utm_medium: cliente.utm_medium,
    utm_campaign: cliente.utm_campaign
  }).toString();
  const link = `${baseUrl}?${utmParams}`;
  return `Confira a novidade de ${cliente.nome}: ${link}`;
}

async function publicarNoCanal(canal, texto) {
  try {
    const response = await fetch(canal.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${canal.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: texto })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return { sucesso: true, canal: canal.nome };
  } catch (error) {
    return { sucesso: false, canal: canal.nome, erro: error.message };
  }
}

async function executar() {
  const estado = carregarEstado();
  const cliente = escolherProximoCliente(estado);
  
  if (!cliente) {
    console.log('Nenhum cliente configurado.');
    return { sucesso: false, motivo: 'sem_clientes' };
  }

  const texto = gerarPost(cliente);
  const canaisAtivos = estado.canais.filter(c => c.ativo);

  if (canaisAtivos.length === 0) {
    console.log('--- MODO ENSAIO ---');
    console.log(`Cliente: ${cliente.nome}`);
    console.log(`Texto: ${texto}`);
    salvarEstado(estado);
    return { sucesso: true, modo: 'ensaio', cliente: cliente.nome, texto };
  }

  const resultados = [];
  for (const canal of canaisAtivos) {
    const resultado = await publicarNoCanal(canal, texto);
    resultados.push(resultado);
    if (resultado.sucesso) {
      console.log(`Publicado em ${canal.nome}`);
    } else {
      console.error(`Erro em ${canal.nome}: ${resultado.erro}`);
    }
  }

  salvarEstado(estado);
  return { sucesso: true, cliente: cliente.nome, resultados };
}

module.exports = { executar, carregarEstado, salvarEstado, escolherProximoCliente, gerarPost, publicarNoCanal };