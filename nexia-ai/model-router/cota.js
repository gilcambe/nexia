'use strict';
// Placar de cota: lembra quais modelos estão sem cota e até quando.
// chave = "provider|model"; valor = { ate: epochMs, motivo }
//
// Parte 1 de #821: evita chamar de novo um modelo que já estourou a cota
// dentro de uma execução, para a próxima não gastar chamada sem sucesso.
const SEIS_H = 6 * 60 * 60 * 1000;
const VINTE_E_QUATRO_H = 24 * 60 * 60 * 1000;
const DOIS_MIN = 2 * 60 * 1000;
const SESSENTA_S = 60 * 1000;
// #821: disjuntor (circuit breaker). Modelo que falha CIRCUITO_FALHAS vezes seguidas por instabilidade
// (busy/transient: 5xx, "high demand", timeout) é rebaixado por 1 hora. Um sucesso zera a conta.
const CINCO_MIN = 5 * 60 * 1000;
const UMA_H = 60 * 60 * 1000;
const CIRCUITO_FALHAS = 3;
const INSTAVEL = new Set(['busy', 'transient']);

function chaveDe(desc) {
  if (typeof desc === 'string') return desc;
  if (desc && typeof desc === 'object')
    return `${String(desc.provider || '')}|${String(desc.model || '')}`;
  return String(desc);
}

/** Converte um cabeçalho de reset (ex: "2m59.56s", "7.66s", "30") em ms. */
function parseReset(texto) {
  if (texto == null || texto === '') return SESSENTA_S;
  const s = String(texto).trim();
  const m = s.match(/^(\d+)m(\d+(?:\.\d+)?)s$/);
  if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000);
  const m2 = s.match(/^(\d+(?:\.\d+)?)s$/);
  if (m2) return Math.round(Number(m2[1]) * 1000);
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  return SESSENTA_S;
}

function createPlacar({ agora = () => Date.now() } = {}) {
  const placar = {}; // chave -> { ate: number, motivo: string }
  const seguidas = {}; // chave -> falhas seguidas por instabilidade (disjuntor)

  function castigo(tipo, retryAfterMs) {
    switch (tipo) {
      case 'daily':
        return retryAfterMs ? Number(retryAfterMs) : SEIS_H;
      case 'rate':
        return Math.max(Number(retryAfterMs || 0), SESSENTA_S);
      case 'fatal':
        return VINTE_E_QUATRO_H;
      case 'busy':
        return DOIS_MIN;
      default:
        return null; // não marca
    }
  }

  return {
    /** Marca um modelo como sem cota por um tempo de castigo. */
    marcar(desc, tipo, retryAfterMs) {
      const k = chaveDe(desc);
      if (INSTAVEL.has(tipo) && (seguidas[k] = (seguidas[k] || 0) + 1) >= CIRCUITO_FALHAS) {
        seguidas[k] = 0;
        placar[k] = { ate: agora() + CINCO_MIN, motivo: 'circuito' };
        return;
      }
      const ms = castigo(tipo, retryAfterMs);
      if (ms === null) return;
      if (placar[k] && placar[k].ate > agora() + ms) return; // não encurta um castigo mais longo (ex.: disjuntor)
      placar[k] = { ate: agora() + ms, motivo: tipo };
    },
    /** #821: resposta boa fecha o disjuntor (zera as falhas seguidas). */
    sucesso(desc) { delete seguidas[chaveDe(desc)]; },
    /** true se o modelo ainda está bloqueado. */
    bloqueado(desc) {
      const k = chaveDe(desc);
      const e = placar[k];
      return !!e && e.ate > agora();
    },
    /**
     * Devolve a lista sem os bloqueados. Se todos estiverem bloqueados,
     * devolve a lista inteira ordenada pelo ate mais cedo (nunca vazia).
     */
    ordenar(lista) {
      const agora_ = agora();
      const livres = [];
      const bloqueados = [];
      for (const item of lista) {
        const k = chaveDe(item);
        const e = placar[k];
        if (e && e.ate > agora_) bloqueados.push({ item, ate: e.ate });
        else livres.push(item);
      }
      if (livres.length) return livres;
      return bloqueados
        .sort((a, b) => a.ate - b.ate)
        .map(x => x.item);
    },
    /** Esquece todos os castigos (testes e diagnóstico). */
    limpar() { for (const k of Object.keys(placar)) delete placar[k]; for (const k of Object.keys(seguidas)) delete seguidas[k]; },
    /** Objeto simples para salvar no D1 (parte 3). */
    exportar() {
      const out = {};
      for (const k of Object.keys(placar)) out[k] = { ...placar[k] };
      try {
        out['_cache_stats'] = require('./cache').getSharedCache().stats();
      } catch {}
      return out;
    },
    /** Economia de cota gerada pelo cache. */
    economiaCache() {
      try {
        return require('./cache').getSharedCache().stats();
      } catch {
        return { hits: 0, economiaTokens: 0, size: 0 };
      }
    },
    /** Importa objeto simples; ignora entradas vencidas. */
    importar(obj) {
      if (!obj || typeof obj !== 'object') return;
      const agora_ = agora();
      for (const k of Object.keys(obj)) {
        if (k === '_cache_stats') continue;
        const e = obj[k];
        if (!e || typeof e.ate !== 'number') continue;
        if (e.ate <= agora_) continue; // vencido: ignora
        if (placar[k] && placar[k].ate >= e.ate) continue; // já temos um castigo igual ou mais longo
        placar[k] = { ate: e.ate, motivo: String(e.motivo || '') };
      }
    },
    /** Registra cabeçalhos de rate-limit da resposta e marca o modelo se estiver sem cota. */
    registrarCabecalhos(desc, headers) {
      try {
        if (!headers) return;
        const get = (nome) => {
          try { return headers.get(nome); } catch { return undefined; }
        };
        const remainingRequests = get('x-ratelimit-remaining-requests');
        const remainingTokens = get('x-ratelimit-remaining-tokens');
        const reset = get('x-ratelimit-reset-requests');
        let bloquear = false;
        if (remainingRequests !== null && remainingRequests !== undefined) {
          const v = Number(remainingRequests);
          if (!Number.isNaN(v) && (v === 0 || v === 1)) bloquear = true;
        }
        if (remainingTokens !== null && remainingTokens !== undefined) {
          const v = Number(remainingTokens);
          if (!Number.isNaN(v) && v < 2000) bloquear = true;
        }
        if (bloquear) {
          const ms = reset != null ? parseReset(reset) : SESSENTA_S;
          this.marcar(desc, 'rate', ms);
        }
      } catch {
        // nunca pode quebrar a resposta do chamador
      }
    },
  };
}

let placarCompartilhado = null;
function getPlacar() {
  if (!placarCompartilhado) placarCompartilhado = createPlacar();
  return placarCompartilhado;
}

// Cada job do GitHub Actions começa do zero: o placar vai para o D1 grátis (mesmo banco do Vault) entre execuções.
// Sem NEXIA_D1_TOKEN/NEXIA_D1_ACCOUNT_ID não faz nada; erro do D1 só avisa e nunca derruba a tarefa.
const DOC = 'ia_cota/placar';
function driverD1(env, o) {
  if (o && o.driver) return o.driver;
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
  return createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}
async function carregarDoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o);
    if (!d) return false;
    const doc = (await d.get([DOC])).get(DOC);
    if (doc && doc.fields) {
      (o.placar || getPlacar()).importar(doc.fields.placar);
      (o.qualidade || require('./qualidade').getQualidade()).importar(doc.fields.qualidade);   // #832
    }
    return true;
  } catch (e) { console.warn('[cota] não li o placar do D1:', e && e.message); return false; }
}
/** Junta com o que outro job salvou (castigo mais longo vence) e grava. */
async function salvarNoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o);
    if (!d) return false;
    const p = o.placar || getPlacar();
    const atual = (await d.get([DOC])).get(DOC);
    const q = o.qualidade || require('./qualidade').getQualidade();
    if (atual && atual.fields) { p.importar(atual.fields.placar); q.importar(atual.fields.qualidade); }
    const agora = new Date().toISOString();
    await d.apply([{ type: 'upsert', path: DOC, fields: { placar: p.exportar(), qualidade: q.exportar() }, create_time: (atual && atual.create_time) || agora, update_time: agora }]);
    return true;
  } catch (e) { console.warn('[cota] não salvei o placar no D1:', e && e.message); return false; }
}

// #2719 parte 2 (#2848): créditos internos = quanto cada IA gastou no dia (pedidos, tokens, respostas 429).
// Chave "provedor:AAAA-MM-DD". "base" veio do D1; "delta" é o que este processo somou. Ao salvar, soma o delta
// ao que está no D1 agora (dois jobs ao mesmo tempo não apagam a conta um do outro).
const DOC_USO = 'ia_cota/uso';
const DIAS_USO = 14;
const dia = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const somar = (a = {}, b = {}) => ({ requests: (a.requests || 0) + (b.requests || 0), tokens: (a.tokens || 0) + (b.tokens || 0), errors: (a.errors || 0) + (b.errors || 0) });
function createUso({ agora = () => Date.now() } = {}) {
  let base = {}; let delta = {};
  return {
    /** Soma um uso. errors = respostas 429 (sem cota). */
    incrementUsage(providerId, inc = {}) {
      if (!providerId) return;
      const k = `${providerId}:${dia(agora())}`;
      delta[k] = somar(delta[k], { requests: Number(inc.requests) || 0, tokens: Math.max(0, Math.round(Number(inc.tokens) || 0)), errors: Number(inc.errors) || 0 });
    },
    /** Uso do provedor no dia (padrão: hoje). */
    getUsage(providerId, date = dia(agora())) { const k = `${providerId}:${date}`; return somar(base[k], delta[k]); },
    /** Tudo de um dia: { provedor: {requests,tokens,errors} }. */
    doDia(date = dia(agora())) {
      const out = {};
      for (const k of new Set([...Object.keys(base), ...Object.keys(delta)])) {
        const i = k.lastIndexOf(':'); if (k.slice(i + 1) === date) out[k.slice(0, i)] = somar(base[k], delta[k]);
      }
      return out;
    },
    importar(obj) { base = {}; if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (v && typeof v === 'object') base[k] = somar(v); },
    /** Junta o delta ao que veio do D1 agora, guarda só os últimos DIAS_USO dias e zera o delta. */
    juntar(atualD1) {
      const limite = dia(agora() - DIAS_USO * 864e5);
      const out = {};
      const fonte = atualD1 && typeof atualD1 === 'object' ? atualD1 : base;
      for (const k of new Set([...Object.keys(fonte), ...Object.keys(delta)])) {
        if (k.slice(k.lastIndexOf(':') + 1) < limite) continue;
        out[k] = somar(fonte[k], delta[k]);
      }
      base = out; delta = {};
      return out;
    },
    pendente() { return Object.keys(delta).length > 0; },
  };
}
let usoCompartilhado = null;
function getUso() { if (!usoCompartilhado) usoCompartilhado = createUso(); return usoCompartilhado; }
const incrementUsage = (id, inc) => getUso().incrementUsage(id, inc);
const getUsage = (id, date) => getUso().getUsage(id, date);

async function carregarUsoDoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o);
    if (!d) return false;
    const doc = (await d.get([DOC_USO])).get(DOC_USO);
    (o.uso || getUso()).importar(doc && doc.fields && doc.fields.uso);
    return true;
  } catch (e) { console.warn('[cota] não li o uso do D1:', e && e.message); return false; }
}
async function salvarUsoNoD1(env = process.env, o = {}) {
  try {
    const d = driverD1(env, o);
    const u = o.uso || getUso();
    if (!d || !u.pendente()) return false;
    const atual = (await d.get([DOC_USO])).get(DOC_USO);
    const uso = u.juntar((atual && atual.fields && atual.fields.uso) || {});
    const agora = new Date().toISOString();
    await d.apply([{ type: 'upsert', path: DOC_USO, fields: { uso }, create_time: (atual && atual.create_time) || agora, update_time: agora }]);
    return true;
  } catch (e) { console.warn('[cota] não salvei o uso no D1:', e && e.message); return false; }
}

module.exports = { CIRCUITO_FALHAS, createPlacar, getPlacar, parseReset, carregarDoD1, salvarNoD1,
  DOC_USO, createUso, getUso, incrementUsage, getUsage, carregarUsoDoD1, salvarUsoNoD1 };
