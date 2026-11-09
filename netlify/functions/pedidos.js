'use strict';
const { agir } = require('./central/pedidos-acoes');

// Cortex no celular: o dono manda pedidos ao Cortex e vê todo o histórico, sem precisar da Claude.
//   GET  /api/pedidos?q=&estado=todos|abertos|travados|feitos&pagina=1   lista
//   GET  /api/pedidos?n=123                                              um pedido com conversa e PRs
//   POST /api/pedidos {acao:'pedir', texto} | {acao:'comentar', n, texto} | {acao:'tentar', n}
//                     {acao:'cancelar', n} | {acao:'reabrir', n} | {acao:'juntar', pr}

// #3133: GET /api/pedidos?ias=1 → { ias, resumo, conferidoEm }. Mesma fonte da Central (estado-tarefas).
async function iasAgoraComResumo(gh) {
  const { REPO } = require('./central/pedidos-gh');
  const { estadoTarefas, resumoDia } = require('./central/estado-tarefas');
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10); // dia em Brasília
  const q = (x) => gh('/search/issues?per_page=100&q=' + encodeURIComponent('repo:' + REPO + ' is:issue label:cortex-fila ' + x)).then((r) => r.items || []).catch(() => []);
  const [ias, abertas, fechadasHoje] = await Promise.all([
    require('./central/ias-agora').carregar(gh, REPO),
    q('is:open'),
    q('is:closed closed:>=' + hoje),
  ]);
  const c = estadoTarefas(abertas.concat(fechadasHoje));
  return { ias, resumo: resumoDia(c, ias), contagens: c, conferidoEm: new Date().toISOString(), origem: 'issues do GitHub com rótulo cortex-fila' };
}

// #3225: PRs abertos para a tela Publicações (sem segredo; automerge = vai entrar sozinho).
async function prsAbertos(gh) {
  const { REPO } = require('./central/pedidos-gh');
  const lista = await gh('/repos/' + REPO + '/pulls?state=open&per_page=40&sort=updated&direction=desc');
  const prs = (Array.isArray(lista) ? lista : []).map((x) => ({
    numero: x.number, titulo: String(x.title || '').slice(0, 120), link: x.html_url, ramo: x.head && x.head.ref,
    doCortex: String((x.head && x.head.ref) || '').startsWith('nexia/'), automerge: (x.labels || []).some((l) => l.name === 'automerge'),
    rascunho: !!x.draft, quando: x.updated_at,
  }));
  return { prs, conferidoEm: new Date().toISOString(), origem: 'PRs abertos no GitHub (gilcambe/nexia)' };
}

// #3227: Cofre. Só NOME e data de troca dos segredos; o GitHub nem devolve o valor.
async function cofre(gh) {
  const { REPO } = require('./central/pedidos-gh');
  const r = await gh('/repos/' + REPO + '/actions/secrets?per_page=100');
  const segredos = ((r && r.secrets) || []).map((x) => ({ name: x.name, updated_at: x.updated_at }));
  return { segredos, conferidoEm: new Date().toISOString(), origem: 'nomes dos segredos do repositório no GitHub' };
}

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  const getPedidos = deps.getPedidos || (() => {
    const p = require('./central/pedidos-gh').criarPedidos();
    return { ...p, detalhe: require('./central/pedidos-detalhe').criarDetalhe(p.gh) };
  });

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    const auth = await getMw().verifyBearerToken(event).catch(() => ({ ok: false }));
    if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o dono da NEXIA abre o Cortex.' });

    const p = getPedidos();
    if (!p.temToken) return res(500, { error: 'Falta o token do GitHub (NEXIA_JOBS_TOKEN) no servidor.' });
    try {
      if (method === 'GET') {
        const qs = event.queryStringParameters || {};
        if (qs.deploy) return res(200, await require('./central/pedidos-publicar').situacao(p.gh));
        if (qs.n) return res(200, await p.detalhe(qs.n));
        if (qs.projetos) return res(200, await require('./central/projetos').carregar(p.gh, require('./central/pedidos-gh').REPO));
        if (qs.cofre) return res(200, await cofre(p.gh));
        if (qs.prs) return res(200, await prsAbertos(p.gh));
        if (qs.homologacao) return res(200, await require('./central/homologacao').carregar(p.gh));   // #3269
        if (qs.ias) return res(200, await (deps.iasAgora || iasAgoraComResumo)(p.gh));
        return res(200, await p.lista({ q: qs.q, estado: qs.estado, pagina: qs.pagina }));
      }
      let b = {};
      try { b = JSON.parse(event.body || '{}') || {}; } catch { return res(400, { error: 'Pedido inválido.' }); }
      // #833: avisos do Cortex no celular (Web Push grátis), ações avisos_*.
      if (/^avisos_/.test(String(b.acao || ''))) {
        const getDb = deps.getDb || (() => require('./firebase-init').db);
        const [status, corpo] = (await require('./central/cortex-avisos').acoesAvisos(b, getDb())) || [400, { error: 'Ação desconhecida.' }];
        return res(status, corpo);
      }
      if (b.acao === 'homologar') return res(200, await require('./central/homologacao').rodar(p.gh));   // #3269 botão Rodar tudo
      const x = await agir(p, b, auth.email || 'dono');
      return res(x.status, x.corpo);
    } catch (e) {
      return res(502, { error: 'GitHub: ' + e.message });
    }
  };
}

exports.createHandler = createHandler;
exports.cofre = cofre;
exports.handler = createHandler();
