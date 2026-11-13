// API mínima (Cloudflare Worker, plano grátis): GET /saude, GET e POST /itens.
// Itens ficam na memória da instância (podem sumir quando o Worker reinicia): é um ponto de partida.
const NOME = '{{nome}}';
const MAX_ITENS = 200;
const MAX_TEXTO = 500;
const itens = [];

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' },
});

export async function tratar(request) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return json(null, 204);
  if (url.pathname === '/saude' && request.method === 'GET') return json({ ok: true, nome: NOME });
  if (url.pathname === '/itens' && request.method === 'GET') return json({ itens });
  if (url.pathname === '/itens' && request.method === 'POST') {
    let corpo;
    try { corpo = await request.json(); } catch { return json({ erro: 'Envie JSON: { "texto": "..." }' }, 400); }
    const texto = String((corpo && corpo.texto) || '').trim().slice(0, MAX_TEXTO);
    if (!texto) return json({ erro: 'O campo "texto" é obrigatório.' }, 400);
    const item = { id: String(Date.now()) + Math.random().toString(36).slice(2, 6), texto, criadoEm: new Date().toISOString() };
    itens.push(item);
    if (itens.length > MAX_ITENS) itens.shift();
    return json({ item }, 201);
  }
  if (url.pathname === '/saude' || url.pathname === '/itens') return json({ erro: 'Método não permitido.' }, 405);
  return null;
}

export default {
  async fetch(request, env) {
    const r = await tratar(request);
    if (r) return r;
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return json({ erro: 'Não encontrado.' }, 404);
  },
};
