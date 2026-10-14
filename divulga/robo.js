const fs = require('fs');
const path = require('path');

const ESTADO_PATH = path.join(__dirname, 'estado.json');

function lerEstado() {
  const raw = fs.readFileSync(ESTADO_PATH, 'utf-8');
  return JSON.parse(raw);
}

function salvarEstado(estado) {
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2), 'utf-8');
}

function proximoCliente(estado) {
  const clientes = estado.clientes.filter(c => c.canais.some(can => can.ativo));
  if (clientes.length === 0) return null;
  const cliente = clientes[estado.indice_atual % clientes.length];
  estado.indice_atual = (estado.indice_atual + 1) % clientes.length;
  return cliente;
}

function gerarPost(cliente) {
  const baseUrl = 'https://exemplo.com/oferta';
  const url = `${baseUrl}?utm_source=${cliente.utm_source}&utm_medium=bot&utm_campaign=divulga`;
  return `📢 ${cliente.nome}: Confira nossa oferta especial! ${url}`;
}

async function publicarTelegram(canal, texto) {
  const { chat_id, token } = canal.config;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text: texto, parse_mode: 'HTML' })
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return { ok: true, canal: canal.id };
}

async function publicarWhatsApp(canal, texto) {
  const { phone, token } = canal.config;
  const url = `https://graph.facebook.com/v18.0/${phone}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: texto } })
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  return { ok: true, canal: canal.id };
}

async function publicarCanal(canal, texto) {
  switch (canal.tipo) {
    case 'telegram': return publicarTelegram(canal, texto);
    case 'whatsapp': return publicarWhatsApp(canal, texto);
    default: throw new Error(`Canal desconhecido: ${canal.tipo}`);
  }
}

async function executar() {
  const estado = lerEstado();
  const cliente = proximoCliente(estado);

  if (!cliente) {
    console.log('Nenhum cliente com canal ativo. Modo ensaio.');
    const clientesComCanal = estado.clientes.filter(c => c.canais.length > 0);
    if (clientesComCanal.length > 0) {
      const clienteEnsaio = clientesComCanal[estado.indice_atual % clientesComCanal.length];
      const texto = gerarPost(clienteEnsaio);
      console.log('MODO ENSAIO - Post que seria publicado:');
      console.log(texto);
    }
    return { modo: 'ensaio', cliente: null, resultados: [] };
  }

  const texto = gerarPost(cliente);
  const canaisAtivos = cliente.canais.filter(c => c.ativo);

  const resultados = await Promise.all(
    canaisAtivos.map(canal =>
      publicarCanal(canal, texto).catch(err => ({ ok: false, canal: canal.id, erro: err.message }))
    )
  );

  console.log('Resultados:', JSON.stringify(resultados, null, 2));
  salvarEstado(estado);
  return { modo: 'producao', cliente: cliente.id, resultados };
}

if (require.main === module) {

  executar().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = { executar, lerEstado, salvarEstado, proximoCliente, gerarPost, publicarCanal };
