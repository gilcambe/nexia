'use strict';
/**
 * Kernex Finance (#3304): cotação ao vivo grátis (FIIs, ações, ETFs da B3) e índices (CDI, Selic, IPCA).
 * Fontes sem chave, em ordem, com troca automática: Yahoo Finance → brapi.dev (token grátis opcional) → Google Finance.
 * Se todas falharem: última cotação guardada, marcada "desatualizada". Nunca inventa preço.
 * Índices: Banco Central (SGS), grátis e sem chave.
 */
const dinheiro = (n) => Math.round(n * 100) / 100;
const TICKER = /^[A-Z]{4}\d{1,2}$/;
const cache = new Map(); // por isolate do Worker: ticker -> { preco, ..., guardado_em }

/** Pregão da B3: seg–sex, 10h–18h (horário de Brasília, UTC−3). */
function emPregao(agora) {
  const brt = new Date(agora.getTime() - 3 * 3600 * 1000);
  const dia = brt.getUTCDay(); const h = brt.getUTCHours();
  return dia >= 1 && dia <= 5 && h >= 10 && h < 18;
}
const validadeMs = (agora) => (emPregao(agora) ? 5 : 60) * 60 * 1000;

const comTempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function pegarJson(f, url) {
  const r = await comTempo(f(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KernexFinance/1.0)', Accept: 'application/json' } }), 8000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const FONTES = {
  async yahoo(tk, f) {
    const j = await pegarJson(f, `https://query1.finance.yahoo.com/v8/finance/chart/${tk}.SA?range=1d&interval=1d`);
    const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
    const preco = Number(m && m.regularMarketPrice);
    if (!(preco > 0)) throw new Error('sem preço');
    const ant = Number(m.chartPreviousClose || m.previousClose);
    return { preco, anterior: ant > 0 ? ant : null, data_hora: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null };
  },
  async brapi(tk, f, env) {
    const tok = env && env.BRAPI_TOKEN ? `?token=${encodeURIComponent(env.BRAPI_TOKEN)}` : '';
    const j = await pegarJson(f, `https://brapi.dev/api/quote/${tk}${tok}`);
    const r = j && j.results && j.results[0];
    const preco = Number(r && r.regularMarketPrice);
    if (!(preco > 0)) throw new Error('sem preço');
    const ant = Number(r.regularMarketPreviousClose);
    return { preco, anterior: ant > 0 ? ant : null, data_hora: r.regularMarketTime ? new Date(r.regularMarketTime).toISOString() : null };
  },
  async google(tk, f) {
    const r = await comTempo(f(`https://www.google.com/finance/quote/${tk}:BVMF?hl=pt`, { headers: { 'User-Agent': 'Mozilla/5.0' } }), 8000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const preco = precoDoGoogle(await r.text());
    if (!(preco > 0)) throw new Error('sem preço');
    return { preco, anterior: null, data_hora: null };
  },
};
/** Preço no HTML do Google Finance: atributo data-last-price="8.9" ou o texto "R$ 8,90" em destaque. */
function precoDoGoogle(html) {
  const s = String(html || '');
  const a = /data-last-price="([\d.]+)"/.exec(s);
  if (a) return Number(a[1]);
  const b = /class="YMlKec fxKbKc">R\$\s?([\d.]+,\d{2})</.exec(s);
  return b ? Number(b[1].replace(/\./g, '').replace(',', '.')) : NaN;
}

/** Cotação de um ticker: cache curto → fontes em ordem → última guardada (desatualizada). */
async function cotar(tk, { fetch: f, agora, env, guardada, fontes = FONTES }) {
  const t = agora.getTime();
  const c = cache.get(tk);
  if (c && t - c.guardado_em < validadeMs(agora)) return c;
  const erros = [];
  for (const [nome, fn] of Object.entries(fontes)) {
    try {
      const r = await fn(tk, f, env);
      const out = { ticker: tk, preco: dinheiro(r.preco), variacao_dia_pct: r.anterior ? Math.round(((r.preco / r.anterior) - 1) * 10000) / 100 : null,
        fonte: nome, data_hora: r.data_hora || agora.toISOString(), desatualizada: false, guardado_em: t };
      cache.set(tk, out);
      return out;
    } catch (e) { erros.push(`${nome}: ${String((e && e.message) || e).slice(0, 40)}`); }
  }
  const velha = c || guardada;
  if (velha && velha.preco > 0) return { ...velha, ticker: tk, desatualizada: true };
  return { ticker: tk, preco: null, fonte: null, desatualizada: true, erro: erros.join(' | ') };
}

/** Índices do Banco Central (SGS): CDI ao dia (12), Selic meta ao ano (432), IPCA do mês (433). */
let indicesCache = null; // { em, valor }: índices mudam 1x por dia; 30 min de cache por isolate
async function indices(f, agoraMs = Date.now()) {
  if (indicesCache && agoraMs - indicesCache.em < 30 * 60 * 1000) return indicesCache.valor;
  const valor = await indicesDoBc(f);
  if (valor.cdi_dia_pct) indicesCache = { em: agoraMs, valor };
  return valor;
}
async function indicesDoBc(f) {
  const serie = async (n) => {
    const j = await pegarJson(f, `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${n}/dados/ultimos/1?formato=json`);
    const v = Number(String(j && j[0] && j[0].valor).replace(',', '.'));
    return Number.isFinite(v) ? { valor: v, data: j[0].data } : null;
  };
  const [cdi, selic, ipca] = await Promise.all([12, 432, 433].map((n) => serie(n).catch(() => null)));
  return { cdi_dia_pct: cdi && cdi.valor, cdi_data: cdi && cdi.data, selic_ano_pct: selic && selic.valor, ipca_mes_pct: ipca && ipca.valor, ipca_data: ipca && ipca.data };
}

/** Dias úteis (seg–sex) depois de "de" até "ate" (AAAA-MM-DD). Feriados não entram (estimativa). */
function diasUteis(de, ate) {
  let n = 0; const d = new Date(`${de}T12:00:00Z`); const fim = new Date(`${ate}T12:00:00Z`);
  if (!(d < fim)) return 0;
  for (d.setUTCDate(d.getUTCDate() + 1); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) { const w = d.getUTCDay(); if (w && w !== 6) n++; }
  return n;
}
/** CDB/renda fixa pós-fixada: valor do print × (1 + CDI do dia × % do CDI)^dias úteis desde o print. */
function estimarRendaFixa(valor, dataPrint, hoje, cdiDiaPct, pctCdi = 100) {
  if (!(valor > 0) || !dataPrint || !(cdiDiaPct > 0)) return null;
  const dias = diasUteis(dataPrint, hoje);
  return { valor: dinheiro(valor * Math.pow(1 + (cdiDiaPct / 100) * (pctCdi / 100), dias)), dias_uteis: dias };
}
const pctCdiDe = (taxa) => { const m = /(\d{2,3}(?:[.,]\d+)?)\s*%\s*(?:do\s*)?cdi/i.exec(String(taxa || '')); return m ? Number(m[1].replace(',', '.')) : 100; };

/** Carteira ao vivo: cada ativo com ticker vira quantidade × cotação; CDB/renda fixa rende pelo CDI desde o print. */
async function carteiraAoVivo(itens, { fetch: f, agora, env, guardadas = {} }) {
  const hoje = new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const tickers = [...new Set(itens.map((i) => String(i.ticker || '').toUpperCase()).filter((t) => TICKER.test(t)))];
  const [cots, ind] = await Promise.all([Promise.all(tickers.map((tk) => cotar(tk, { fetch: f, agora, env, guardada: guardadas[tk] }))), indices(f).catch(() => ({}))]);
  const porTk = Object.fromEntries(cots.map((c) => [c.ticker, c]));
  let total = 0; let totalPrint = 0;
  const out = itens.map((i) => {
    const base = Number(i.valor) || 0; totalPrint += base;
    const tk = String(i.ticker || '').toUpperCase();
    const c = porTk[tk];
    const q = Number(i.quantidade);
    let vivo = null;
    if (c && c.preco > 0 && q > 0) vivo = { valor: dinheiro(q * c.preco), preco: c.preco, variacao_dia_pct: c.variacao_dia_pct, fonte: c.fonte, data_hora: c.data_hora, desatualizada: !!c.desatualizada };
    else if (!tk && i.tipo === 'renda_fixa' && /cdb|lci|lca|liquidez|rdb|lc\b/i.test(i.nome || '')) {
      const e = estimarRendaFixa(base, i.data_valor, hoje, ind.cdi_dia_pct, pctCdiDe(i.taxa));
      if (e) vivo = { valor: e.valor, fonte: 'CDI (Banco Central)', estimado: true, dias_uteis: e.dias_uteis, data_hora: agora.toISOString(), desatualizada: false };
    }
    if (vivo && i.preco_medio > 0 && q > 0) vivo.ganho = dinheiro(vivo.valor - q * i.preco_medio);
    total += vivo ? vivo.valor : base;
    return { id: i.id, ticker: tk || null, valor_print: base, vivo };
  });
  return { itens: out, total: dinheiro(total), total_print: dinheiro(totalPrint), variacao: dinheiro(total - totalPrint), indices: ind, em_pregao: emPregao(agora), atualizado_em: agora.toISOString() };
}

/** Ação do app: "cotacoes_vivas". Guarda a última cotação boa de cada ticker (para quando as fontes caírem). */
async function agirCotacoes(acao, body, c) {
  if (acao !== 'cotacoes_vivas') return null;
  const itens = await c.listarCarteira();
  const col = c.base.collection('cotacoes');
  const guardadas = Object.fromEntries((await c.listar(col)).map((x) => [x.id, x]));
  const agora = c.deps.agora();
  const r = await carteiraAoVivo(itens, { fetch: c.deps.fetch || ((...a) => fetch(...a)), agora, env: c.deps.env || (typeof process !== 'undefined' ? process.env : {}), guardadas });
  for (const i of r.itens) {
    const v = i.vivo;
    if (i.ticker && v && !v.desatualizada && v.preco) await col.doc(i.ticker).set({ preco: v.preco, variacao_dia_pct: v.variacao_dia_pct, fonte: v.fonte, data_hora: v.data_hora });
  }
  return [200, r];
}

module.exports = { _limparIndices: () => { indicesCache = null; }, agirCotacoes, carteiraAoVivo, cotar, indices, precoDoGoogle, estimarRendaFixa, diasUteis, emPregao, pctCdiDe, FONTES, _cache: cache };
