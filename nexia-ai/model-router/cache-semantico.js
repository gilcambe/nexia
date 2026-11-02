'use strict';
// #2854 (parte 2 de #2729): cache SEMÂNTICO. Pergunta com outras palavras e mesmo sentido
// (similaridade de cosseno >= 0,92) reaproveita a resposta guardada, sem gastar cota de IA.
// Embeddings grátis do Workers AI (@cf/baai/bge-m3, entende português). Sem chave, fica desligado.
// Só vale para pedido de UMA pergunta (sem conversa antes), com req.cache === true e sem ferramentas.
const { normalizar, cacheavel, SETE_DIAS } = require('./cache');

const MODELO_EMBED = '@cf/baai/bge-m3';
const LIMIAR = 0.92;
const DOC_CACHE_SEMANTICO = 'ia_cota/cache_semantico';

function cosseno(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || '').join(' ') : '');
/** Texto da pergunta para o cache semântico, ou null quando não vale (conversa, ferramentas, imagens). */
function textoSemantico(req) {
  if (!cacheavel(req) || (req.images && req.images.length)) return null;
  const msgs = (req.messages || []).filter((m) => m && m.role !== 'system');
  if (msgs.length !== 1 || msgs[0].role !== 'user') return null;
  const t = normalizar(textoDe(msgs[0].content));
  if (!t || t.length > 4000) return null;
  return t;
}
/** Escopo: só reaproveita com o mesmo system e as mesmas opções (o sentido da tarefa não muda). */
const escopoDe = (req) => normalizar(`${req.system || ''}|${req.maxTokens || ''}|${req.json ? 'json' : ''}`).slice(0, 2000);

/** Embedding pelo Workers AI (REST). Devolve null sem chave ou em erro. */
function criarEmbedWorkersAI(env = process.env, fetchFn = (typeof fetch === 'function' ? fetch : null)) {
  const conta = env.CLOUDFLARE_AI_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_AI_TOKEN;
  if (!conta || !token || !fetchFn || env.NEXIA_CACHE_SEMANTICO === '0') return null;
  return async (texto) => {
    try {
      const r = await fetchFn(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(conta)}/ai/run/${MODELO_EMBED}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: [texto] }), signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      });
      if (!r.ok) return null;
      const j = await r.json();
      const v = j && j.result && j.result.data && j.result.data[0];
      return Array.isArray(v) && v.length ? v : null;
    } catch { return null; }
  };
}

function createCacheSemantico(o = {}) {
  const max = o.max || 150;
  const limiar = o.limiar || LIMIAR;
  const ttl = o.ttlMs || SETE_DIAS;
  const agora = o.agora || Date.now;
  let itens = [];   // { escopo, vetor, valor, ate }
  let acertos = 0;
  const vivos = () => { const t = agora(); itens = itens.filter((i) => i.ate > t); return itens; };
  return {
    buscar(vetor, escopo) {
      let melhor = null; let nota = -1;
      for (const i of vivos()) {
        if (i.escopo !== escopo) continue;
        const s = cosseno(vetor, i.vetor);
        if (s > nota) { nota = s; melhor = i; }
      }
      if (melhor && nota >= limiar) { acertos++; return { valor: melhor.valor, similaridade: nota }; }
      return null;
    },
    guardar(vetor, escopo, valor) {
      if (!Array.isArray(vetor) || !valor) return;
      itens.push({ escopo, vetor: vetor.map((x) => Math.round(x * 1e4) / 1e4), valor, ate: agora() + ttl });
      while (itens.length > max) itens.shift();
    },
    exportar() { return vivos().slice(-max); },
    importar(lista) {
      if (!Array.isArray(lista)) return 0;
      const t = agora(); let n = 0;
      for (const i of lista) {
        if (!i || typeof i.ate !== 'number' || i.ate <= t || !Array.isArray(i.vetor)) continue;
        if (itens.some((x) => x.escopo === i.escopo && cosseno(x.vetor, i.vetor) > 0.999)) continue;
        itens.push(i); n++;
      }
      while (itens.length > max) itens.shift();
      return n;
    },
    stats() { return { acertos, tamanho: itens.length }; },
    zerarAcertos() { acertos = 0; },
  };
}

let compartilhado = null;
const getCacheSemantico = () => (compartilhado || (compartilhado = createCacheSemantico()));

function driverD1(env, o) {
  if (o && o.driver) return o.driver;
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
  return createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}
async function carregarSemanticoDoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o); if (!d) return false;
    const doc = (await d.get([DOC_CACHE_SEMANTICO])).get(DOC_CACHE_SEMANTICO);
    (o.cache || getCacheSemantico()).importar(doc && doc.fields && doc.fields.itens);
    return true;
  } catch (e) { console.warn('[cache-semantico] não li do D1:', e && e.message); return false; }
}
async function salvarSemanticoNoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o); if (!d) return false;
    const c = o.cache || getCacheSemantico();
    const atual = (await d.get([DOC_CACHE_SEMANTICO])).get(DOC_CACHE_SEMANTICO);
    c.importar(atual && atual.fields && atual.fields.itens);
    const t = new Date().toISOString();
    const af = (atual && atual.fields) || {};
    await d.apply([{ type: 'upsert', path: DOC_CACHE_SEMANTICO, fields: { itens: c.exportar(), acertos: (Number(af.acertos) || 0) + c.stats().acertos }, create_time: (atual && atual.create_time) || t, update_time: t }]);
    if (c.zerarAcertos) c.zerarAcertos();
    return true;
  } catch (e) { console.warn('[cache-semantico] não salvei no D1:', e && e.message); return false; }
}

module.exports = { cosseno, textoSemantico, escopoDe, criarEmbedWorkersAI, createCacheSemantico, getCacheSemantico, carregarSemanticoDoD1, salvarSemanticoNoD1, LIMIAR, MODELO_EMBED, DOC_CACHE_SEMANTICO };
