'use strict';
// Central NEXIA: saúde dos serviços principais de infraestrutura (Cortex, Firebase, Cloudflare, GitHub, Vault).
// Cada serviço é verificado individualmente e retorna { id, ok, ms, motivo, conferidoEm }.
// Os resultados são salvos em Cloudflare D1 ou Firestore no documento saude_servicos/estado
// (mesma lógica de saude-historico.js e vigia-sites.js). Não grava em disco.

const COLECAO = 'saude_servicos';
const DOC = 'estado';
const SERVICOS = ['cortex', 'firebase', 'cloudflare', 'github', 'vault'];

/** Mede uma operação assíncrona devolvendo { ok, ms, motivo, conferidoEm } */
async function medirServico(id, fn, { timeoutMs = 5000 } = {}) {
  const inicio = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await Promise.race([
      fn(ctl.signal),
      new Promise((_, reject) => {
        ctl.signal.addEventListener('abort', () => {
          const err = new Error('TIMEOUT');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    ]);
    const ms = Date.now() - inicio;
    const ok = res && res.ok !== undefined ? !!res.ok : true;
    const motivo = res && res.motivo ? String(res.motivo) : (ok ? 'ok' : 'falha');
    return { id, ok, ms, motivo, conferidoEm: new Date().toISOString() };
  } catch (err) {
    const ms = Date.now() - inicio;
    const motivo = err && (err.name === 'AbortError' || err.message === 'TIMEOUT')
      ? 'TIMEOUT'
      : (err && err.message ? err.message : 'erro');
    return { id, ok: false, ms, motivo, conferidoEm: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

/** Checagens padrão de cada serviço */
function checadoresPadrao({ env = process.env, fetchImpl = globalThis.fetch, getDb, getVaultDb } = {}) {
  return {
    cortex: async (signal) => {
      // Verifica roteador de modelos do Cortex ou endpoint do chat / rotas
      const url = env.NEXIA_APP_URL ? `${String(env.NEXIA_APP_URL).replace(/\/+$/, '')}/cortex` : 'https://cortex.kernex.com.br';
      const r = await fetchImpl(url, { method: 'HEAD', signal });
      return { ok: r.status < 500, motivo: `HTTP ${r.status}` };
    },
    firebase: async () => {
      const db = getDb ? getDb() : require('../firebase-init').db;
      if (!db) return { ok: false, motivo: 'sem conexão de banco' };
      await db.collection('bc_uso').limit(1).get();
      return { ok: true, motivo: 'ok' };
    },
    cloudflare: async (signal) => {
      // Verifica conectividade Cloudflare via API de trace ou graphql
      const r = await fetchImpl('https://1.1.1.1/cdn-cgi/trace', { method: 'GET', signal });
      return { ok: r.ok, motivo: r.ok ? 'ok' : `HTTP ${r.status}` };
    },
    github: async (signal) => {
      const token = env.NEXIA_JOBS_TOKEN || env.GITHUB_TOKEN;
      const headers = { 'User-Agent': 'nexia-central', Accept: 'application/vnd.github+json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetchImpl('https://api.github.com/repos/gilcambe/nexia', { method: 'GET', headers, signal });
      return { ok: r.status < 500, motivo: `HTTP ${r.status}` };
    },
    vault: async () => {
      const db = getVaultDb ? getVaultDb() : require('../firebase-vault').vaultDb(env);
      if (!db) return { ok: false, motivo: 'sem banco vault' };
      return { ok: true, motivo: 'ok' };
    },
  };
}

/** Executa a checagem de todos os serviços informados */
async function verificarServicos(deps = {}) {
  const { checadores = checadoresPadrao(deps), timeoutMs = 5000, lista = SERVICOS } = deps;
  const resultados = await Promise.all(
    lista.map(async (id) => {
      const fn = checadores[id];
      if (typeof fn !== 'function') {
        return { id, ok: false, ms: 0, motivo: 'checagem não implementada', conferidoEm: new Date().toISOString() };
      }
      return medirServico(id, fn, { timeoutMs });
    })
  );
  return resultados;
}

/** Salva o estado atual das checagens no banco D1 ou Firestore */
async function salvarEstado(db, itens, { at = Date.now() } = {}) {
  if (!db) return { skipped: 'sem banco' };
  const conferidoEm = new Date(at).toISOString();
  const servicos = {};
  for (const item of itens) {
    servicos[item.id] = { ...item };
  }
  const ref = db.collection(COLECAO).doc(DOC);
  await ref.set({ em: conferidoEm, servicos });
  return { ok: true, conferidoEm, total: itens.length };
}

/** Consulta o último estado gravado */
async function obterEstado(db) {
  if (!db) return null;
  const ref = db.collection(COLECAO).doc(DOC);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return snap.data();
}

/** Cria o handler Netlify Functions / Worker */
function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('../middleware'));
  const abrirBanco = deps.abrirBanco || (() => {
    try {
      return require('./saude-historico').abrirBanco(deps.env || process.env);
    } catch {
      return null;
    }
  });

  return async (event = {}) => {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

    // Verificação de autenticação caso seja chamada externa pelo navegador
    const isCron = event.isCron || (event.headers && event.headers['x-nexia-cron']);
    if (!isCron) {
      const auth = await getMw().verifyBearerToken(event).catch(() => ({ ok: false }));
      if (!auth.ok || auth.role !== 'master') {
        return res(403, { error: 'Só o administrador da NEXIA consulta a saúde dos serviços.' });
      }
    }

    try {
      const itens = await verificarServicos(deps);
      const db = deps.db || abrirBanco();
      let gravacao = null;
      if (db) {
        gravacao = await salvarEstado(db, itens);
      }
      return res(200, {
        ok: itens.every((i) => i.ok),
        itens,
        gravado: !!(gravacao && gravacao.ok),
        conferidoEm: new Date().toISOString(),
      });
    } catch (e) {
      return res(500, { ok: false, error: 'Falha ao verificar saúde dos serviços: ' + String(e.message || e).slice(0, 160) });
    }
  };
}

const handler = createHandler();

module.exports = {
  COLECAO,
  DOC,
  SERVICOS,
  medirServico,
  checadoresPadrao,
  verificarServicos,
  salvarEstado,
  obterEstado,
  createHandler,
  handler,
};
