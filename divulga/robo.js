const fs = require('fs');
const path = require('path');

const ESTADO_PATH = path.join(__dirname, 'estado.json');
const CANAIS_PATH = path.join(__dirname, 'canais.json');
const CLIENTES_PATH = path.join(__dirname, 'clientes.json');

function lerEstado() {
  if (!fs.existsSync(ESTADO_PATH)) {
    return { indiceCliente: 0, historico: [] };
  }
  const conteudo = fs.readFileSync(ESTADO_PATH, 'utf-8');
  return JSON.parse(conteudo);
}

function escreverEstado(estado) {
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2), 'utf-8');
}

function lerCanais() {
  if (!fs.existsSync(CANAIS_PATH)) {
    return [];
  }
  const conteudo = fs.readFileSync(CANAIS_PATH, 'utf-8');
  return JSON.parse(conteudo);
}

function lerClientes() {
  if (!fs.existsSync(CLIENTES_PATH)) {
    return [];
  }
  const conteudo = fs.readFileSync(CLIENTES_PATH, 'utf-8');
  return JSON.parse(conteudo);
}

function escolherProximoCliente(clientes, estado) {
  if (!clientes || clientes.length === 0) {
    return null;
  }
  const indice = estado.indiceCliente % clientes.length;
  const cliente = clientes[indice];
  estado.indiceCliente = (indice + 1) % clientes.length;
  return cliente;
}

function gerarPost(cliente) {
  const baseUrl = 'https://exemplo.com';
  const utmSource = 'divulga';
  const utmMedium = 'robo';
  const utmCampaign = cliente.id || 'campanha-padrao';
  const link = `${baseUrl}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
  
  return {
    texto: `Confira ${cliente.nome}! ${link}`,
    link,
    clienteId: cliente.id
  };
}

async function publicarNoCanal(canal, post) {
  // Simula publicação - em produção faria fetch real
  console.log(`[${canal.nome}] Publicando: ${post.texto}`);
  
  // Simula erro aleatório para teste
  if (canal.simularErro) {
    throw new Error(`Erro simulado no canal ${canal.nome}`);
  }
  
  return { sucesso: true, canal: canal.nome, postId: `post-${Date.now()}` };
}

async function executar() {
  const estado = lerEstado();
  const clientes = lerClientes();
  const canais = lerCanais().filter(c => c.ativo);
  
  const cliente = escolherProximoCliente(clientes, estado);
  
  if (!cliente) {
    console.log('Nenhum cliente cadastrado.');
    return { modo: 'erro', mensagem: 'Nenhum cliente cadastrado' };
  }
  
  const post = gerarPost(cliente);
  
  if (canais.length === 0) {
    console.log('=== MODO ENSAIO ===');
    console.log('Nenhum canal ativo. Texto que seria publicado:');
    console.log(post.texto);
    console.log('=====================');
    
    estado.historico.push({
      timestamp: new Date().toISOString(),
      clienteId: cliente.id,
      modo: 'ensaios',
      post: post.texto
    });
    escreverEstado(estado);
    
    return { modo: 'ensaios', post: post.texto };
  }
  
  const resultados = [];
  
  for (const canal of canais) {
    try {
      const resultado = await publicarNoCanal(canal, post);
      resultados.push({ canal: canal.nome, ...resultado });
    } catch (erro) {
      console.error(`Erro no canal ${canal.nome}:`, erro.message);
      resultados.push({ canal: canal.nome, sucesso: false, erro: erro.message });
    }
  }
  
  estado.historico.push({
    timestamp: new Date().toISOString(),
    clienteId: cliente.id,
    modo: 'producao',
    resultados
  });
  escreverEstado(estado);
  
  return { modo: 'producao', cliente: cliente.nome, resultados };
}

module.exports = { executar, lerEstado, escreverEstado, escolherProximoCliente, gerarPost };

if (require.main === module) {
  executar().then(r => console.log('Resultado:', JSON.stringify(r, null, 2)));
}
