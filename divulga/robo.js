import fs from 'fs';
import path from 'path';

const ESTADO_PATH = path.resolve('divulga/estado.json');
export const CANAIS = [
  { id: 'twitter', ativo: true, publicar: async (texto) => { console.log('[Twitter]', texto); return { ok: true }; } },
  { id: 'linkedin', ativo: true, publicar: async (texto) => { console.log('[LinkedIn]', texto); return { ok: true }; } },
  { id: 'instagram', ativo: false, publicar: async (texto) => { console.log('[Instagram]', texto); return { ok: true }; } },
];

export const CLIENTES = [
  { id: 'cli_1', nome: 'Cliente Alpha', url: 'https://exemplo.com/alpha' },
  { id: 'cli_2', nome: 'Cliente Beta', url: 'https://exemplo.com/beta' },
  { id: 'cli_3', nome: 'Cliente Gamma', url: 'https://exemplo.com/gamma' },
];

function lerEstado() {
  if (!fs.existsSync(ESTADO_PATH)) return { rodizio_index: 0 };
  return JSON.parse(fs.readFileSync(ESTADO_PATH, 'utf-8'));
}

function salvarEstado(estado) {
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2));
}

function proximoCliente() {
  const estado = lerEstado();
  const cliente = CLIENTES[estado.rodizio_index % CLIENTES.length];
  estado.rodizio_index = (estado.rodizio_index + 1) % CLIENTES.length;
  salvarEstado(estado);
  return cliente;
}

function gerarPost(cliente) {
  const urlComUtm = `${cliente.url}?utm_source=divulga&utm_medium=social&utm_campaign=${cliente.id}`;
  return `Conheça ${cliente.nome}! ${urlComUtm}`;
}

async function publicarEmCanais(texto) {
  const canaisAtivos = CANAIS.filter(c => c.ativo);
  if (canaisAtivos.length === 0) {
    console.log('--- MODO ENSAIO ---');
    console.log(texto);
    return [{ canal: 'ensaio', ok: true, texto }];
  }
  const resultados = [];
  for (const canal of canaisAtivos) {
    try {
      const res = await canal.publicar(texto);
      resultados.push({ canal: canal.id, ok: true, ...res });
    } catch (e) {
      resultados.push({ canal: canal.id, ok: false, erro: e.message });
    }
  }
  return resultados;
}

export async function executar() {
  const cliente = proximoCliente();
  const texto = gerarPost(cliente);
  const resultados = await publicarEmCanais(texto);
  return { cliente, texto, resultados };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  executar().then(r => console.log('Resultado:', JSON.stringify(r, null, 2))).catch(console.error);
}