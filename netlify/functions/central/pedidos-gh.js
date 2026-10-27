'use strict';
// Cortex no celular (/meu-cortex): os pedidos do Cortex são as issues "cortex-fila" do GitHub.
// O histórico fica guardado lá para sempre, de graça, e não depende da Claude.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com';

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const tentativas = (i) => Math.max(0, ...nomes(i).map((n) => Number((/^tentativa-(\d+)$/.exec(n) || [])[1] || 0)));

function situacao(i) {
  const ls = nomes(i);
  if (i.state === 'closed') return ls.includes('cortex-feito') ? 'feito' : 'fechado';
  if (ls.includes('cortex-travado')) return 'travado';
  if (ls.includes('cortex-rodando')) return 'fazendo';
  if (ls.includes('cortex-dividido')) return 'dividido';
  return 'fila';
}

const resumo = (i) => ({
  numero: i.number, titulo: String(i.title || '').slice(0, 160), situacao: situacao(i),
  criado: i.created_at, quando: i.updated_at, comentarios: i.comments || 0, tentativas: tentativas(i), link: i.html_url,
});

// Primeiras palavras do pedido: o PR do Cortex começa com "Pedido: <texto do pedido>".
const frase = (t) => String(t || '').replace(/[^\p{L}\p{N}\s/.-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');

function criarPedidos(env = process.env, fetchFn = fetch) {
  const token = env.NEXIA_JOBS_TOKEN || env.NEXIA_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  async function gh(caminho, init = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-meu-cortex', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (init.body) headers['Content-Type'] = 'application/json';
    const r = await fetchFn(API + caminho, { ...init, headers });
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.message || 'GitHub respondeu ' + r.status);
    return corpo;
  }
  const busca = (q, extra = '') => gh('/search/issues?per_page=30' + extra + '&q=' + encodeURIComponent(q));

  async function lista({ q = '', estado = 'todos', pagina = 1 } = {}) {
    const p = Math.max(1, Math.min(30, Number(pagina) || 1));
    let filtro = 'repo:' + REPO + ' is:issue label:cortex-fila';
    if (estado === 'abertos') filtro += ' is:open -label:cortex-travado';
    if (estado === 'travados') filtro += ' is:open label:cortex-travado';
    if (estado === 'feitos') filtro += ' is:closed';
    const termo = frase(q);
    if (termo) filtro += ' ' + termo;
    const r = await busca(filtro, '&sort=created&order=desc&page=' + p);
    const total = r.total_count || 0;
    return { total, pagina: p, temMais: p * 30 < total, itens: (r.items || []).map(resumo) };
  }

  return { lista, gh, temToken: !!token };
}

async function handleAjudaIas(event) {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
  if (String(event.httpMethod || '').toUpperCase() === 'OPTIONS') return res(204, '');
  const { verifyBearerToken } = require('./middleware');
  const auth = await verifyBearerToken(event).catch(() => ({ ok: false }));
  if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA abre a Central.' });
  if (String(event.httpMethod || '').toUpperCase() === 'GET') return res(200, { ok: true, ajuda: 'Ajuda IAs: use POST com {acao} para testar as IAs da Central.' });
  let body = {};
  try { body = JSON.parse(event.body || '{}') || {}; } catch { return res(400, { error: 'Pedido inválido.' }); }
  return res(200, { ok: true, acao: body.acao || 'ajuda-ias', mensagem: 'Rota de ajuda IAs da Central recebida.' });
}

module.exports = { criarPedidos, situacao, resumo, nomes, frase, REPO, handleAjudaIas };
