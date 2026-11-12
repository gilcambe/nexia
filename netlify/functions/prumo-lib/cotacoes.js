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

// #3533: proventos (dividendos/rendimentos) dos últimos 12 meses, pelo Yahoo (grátis). Cache de 12 h por isolate.
const provCache = new Map();
async function proventos12m(tk, f, agoraMs = Date.now()) {
  const c = provCache.get(tk);
  if (c && agoraMs - c.em < 12 * 3600 * 1000) return c.valor;
  const j = await pegarJson(f, `https://query1.finance.yahoo.com/v8/finance/chart/${tk}.SA?range=1y&interval=1mo&events=div`);
  const ev = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].events && j.chart.result[0].events.dividends;
  const lista = Object.values(ev || {}).map((d) => ({ valor: Number(d.amount), data: new Date(d.date * 1000).toISOString().slice(0, 10) }))
    .filter((d) => d.valor > 0).sort((a, b) => a.data.localeCompare(b.data));
  const valor = { por_cota_12m: Math.round(lista.reduce((a, d) => a + d.valor, 0) * 10000) / 10000, pagamentos: lista.length, ultimo: lista[lista.length - 1] || null };
  provCache.set(tk, { em: agoraMs, valor });
  return valor;
}

/** Assessor (#3533): peso de cada ativo, alertas de alta/queda forte no dia, renda mensal estimada e concentração. */
function assessor(r, itens) {
  const porId = Object.fromEntries(itens.map((i) => [i.id, i]));
  const alertas = []; let renda = 0;
  for (const x of r.itens) {
    const v = x.vivo ? x.vivo.valor : x.valor_print;
    x.peso_pct = r.total > 0 ? Math.round((v / r.total) * 10000) / 100 : 0;
    const i = porId[x.id] || {};
    if (x.vivo && x.vivo.variacao_dia_pct != null && Math.abs(x.vivo.variacao_dia_pct) >= 3) alertas.push({ tipo: x.vivo.variacao_dia_pct > 0 ? 'alta' : 'queda', ticker: x.ticker, texto: `${x.ticker} ${x.vivo.variacao_dia_pct > 0 ? 'subiu' : 'caiu'} ${Math.abs(x.vivo.variacao_dia_pct).toFixed(2).replace('.', ',')}% hoje.` });
    if (x.vivo && x.vivo.preco > 0 && i.preco_medio > 0 && x.vivo.preco < i.preco_medio * 0.85) alertas.push({ tipo: 'abaixo_pm', ticker: x.ticker, texto: `${x.ticker} está ${Math.round((1 - x.vivo.preco / i.preco_medio) * 100)}% abaixo do seu preço médio.` });
    if (x.proventos && x.proventos.por_cota_12m > 0 && Number(i.quantidade) > 0) {
      x.renda_mensal = dinheiro((x.proventos.por_cota_12m * Number(i.quantidade)) / 12);
      x.yield_12m_pct = x.vivo && x.vivo.preco > 0 ? Math.round((x.proventos.por_cota_12m / x.vivo.preco) * 10000) / 100 : null;
      x.yield_on_cost_pct = i.preco_medio > 0 ? Math.round((x.proventos.por_cota_12m / i.preco_medio) * 10000) / 100 : null;
      renda += x.renda_mensal;
    }
  }
  const maior = [...r.itens].sort((a, b) => b.peso_pct - a.peso_pct)[0];
  if (maior && maior.peso_pct >= 50) alertas.push({ tipo: 'concentracao', texto: `${maior.peso_pct.toFixed(1).replace('.', ',')}% do patrimônio está num só investimento (${(porId[maior.id] || {}).nome || maior.ticker}). Diversificar reduz o risco.` });
  return { alertas, renda_mensal_estimada: dinheiro(renda), renda_anual_estimada: dinheiro(renda * 12) };
}

// #3533 parte 2: comparativos grátis em 12 meses: CDI (Banco Central, série 4391 = CDI do mês), IBOV, IFIX (pelo ETF XFIX11) e S&P 500 em reais (IVVB11).
let benchCache = null;
async function benchmarks(f, agoraMs = Date.now()) {
  if (benchCache && agoraMs - benchCache.em < 12 * 3600 * 1000) return benchCache.valor;
  const ano = async (sym) => {
    const j = await pegarJson(f, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1mo`);
    const q = j && j.chart && j.chart.result && j.chart.result[0];
    const c = ((q && q.indicators && q.indicators.adjclose && q.indicators.adjclose[0] && q.indicators.adjclose[0].adjclose) || (q && q.indicators && q.indicators.quote && q.indicators.quote[0].close) || []).filter((x) => x > 0);
    return c.length > 1 ? Math.round(((c[c.length - 1] / c[0]) - 1) * 10000) / 100 : null;
  };
  const cdi = async () => {
    const j = await pegarJson(f, 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados/ultimos/12?formato=json');
    const m = (j || []).map((x) => Number(String(x.valor).replace(',', '.'))).filter(Number.isFinite);
    return m.length ? Math.round((m.reduce((a, x) => a * (1 + x / 100), 1) - 1) * 10000) / 100 : null;
  };
  const [c, ibov, ifix, sp] = await Promise.all([cdi(), ano('^BVSP'), ano('XFIX11.SA'), ano('IVVB11.SA')].map((p) => p.catch(() => null)));
  const valor = { cdi_12m_pct: c, ibov_12m_pct: ibov, ifix_12m_pct: ifix, ivvb11_12m_pct: sp };
  if (c != null || ibov != null) benchCache = { em: agoraMs, valor };
  return valor;
}

/** Rebalanceamento (só sugestão, nunca ordem): com um aporte, quanto pôr em cada tipo para chegar perto da meta, sem vender nada. */
function rebalancear(porTipo, alvo, aporte) {
  const tipos = Object.keys(alvo || {}).filter((t) => alvo[t] > 0);
  const soma = tipos.reduce((a, t) => a + alvo[t], 0);
  if (!tipos.length || Math.abs(soma - 100) > 0.5) return null;
  const totalNovo = Object.values(porTipo).reduce((a, v) => a + v, 0) + (aporte > 0 ? aporte : 0);
  const falta = tipos.map((t) => ({ tipo: t, falta: Math.max(0, totalNovo * alvo[t] / 100 - (porTipo[t] || 0)) }));
  const somaFalta = falta.reduce((a, x) => a + x.falta, 0);
  const comprar = falta.map((x) => ({ tipo: x.tipo, valor: dinheiro(somaFalta > 0 && aporte > 0 ? aporte * x.falta / somaFalta : 0) })).filter((x) => x.valor > 0);
  const atual = Object.fromEntries(Object.entries(porTipo).map(([t, v]) => [t, totalNovo > 0 ? Math.round(v / (totalNovo - (aporte > 0 ? aporte : 0)) * 10000) / 100 : 0]));
  return { atual_pct: atual, alvo_pct: alvo, aporte: dinheiro(aporte > 0 ? aporte : 0), comprar, aviso: 'Sugestão educativa, não é recomendação oficial de investimento.' };
}

/** Carteira ao vivo: cada ativo com ticker vira quantidade × cotação; CDB/renda fixa rende pelo CDI desde o print. */
async function carteiraAoVivo(itens, { fetch: f, agora, env, guardadas = {}, comProventos = true }) {
  const hoje = new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const tickers = [...new Set(itens.map((i) => String(i.ticker || '').toUpperCase()).filter((t) => TICKER.test(t)))];
  const [cots, ind] = await Promise.all([Promise.all(tickers.map((tk) => cotar(tk, { fetch: f, agora, env, guardada: guardadas[tk] }))), indices(f).catch(() => ({}))]);
  const porTk = Object.fromEntries(cots.map((c) => [c.ticker, c]));
  const provs = comProventos ? Object.fromEntries(await Promise.all(tickers.map(async (tk) => [tk, await proventos12m(tk, f, agora.getTime()).catch(() => null)]))) : {};
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
    return { id: i.id, ticker: tk || null, valor_print: base, vivo, proventos: provs[tk] || null };
  });
  const r = { itens: out, total: dinheiro(total), total_print: dinheiro(totalPrint), variacao: dinheiro(total - totalPrint), indices: ind, em_pregao: emPregao(agora), atualizado_em: agora.toISOString() };
  r.assessor = assessor(r, itens);
  if (comProventos) {
    r.assessor.benchmarks = await benchmarks(f, agora.getTime()).catch(() => null);
    // Renda variável sobre o custo (preço médio): comparar com IFIX/IBOV no mesmo período é aproximação.
    let custo = 0; let atual = 0;
    for (const x of out) { const i = itens.find((y) => y.id === x.id) || {}; if (x.vivo && i.preco_medio > 0 && Number(i.quantidade) > 0) { custo += i.preco_medio * Number(i.quantidade); atual += x.vivo.valor; } }
    r.assessor.renda_variavel_sobre_custo_pct = custo > 0 ? Math.round(((atual / custo) - 1) * 10000) / 100 : null;
  }
  r.por_tipo = {};
  for (const x of out) { const i = itens.find((y) => y.id === x.id) || {}; r.por_tipo[i.tipo || 'outro'] = dinheiro((r.por_tipo[i.tipo || 'outro'] || 0) + (x.vivo ? x.vivo.valor : x.valor_print)); }
  return r;
}

/** Ação do app: "cotacoes_vivas". Guarda a última cotação boa de cada ticker (para quando as fontes caírem). */
async function agirCotacoes(acao, body, c) {
  if (acao === 'alocacao_alvo_salvar') {
    const alvo = {};
    for (const [t, v] of Object.entries((body && body.alvo) || {})) { const n = Number(v); if (/^[a-z_]{2,20}$/.test(t) && n > 0 && n <= 100) alvo[t] = Math.round(n * 100) / 100; }
    const soma = Object.values(alvo).reduce((a, x) => a + x, 0);
    if (Math.abs(soma - 100) > 0.5) return [400, { error: `A meta precisa somar 100% (está em ${soma}%).` }];
    await c.base.collection('config').doc('alocacao').set({ alvo, atualizado_em: c.agoraIso });
    return [200, { ok: true, alvo }];
  }
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
  const cfg = await c.base.collection('config').doc('alocacao').get();
  const alvo = cfg && cfg.exists ? (cfg.data() || {}).alvo : null;
  r.assessor.alocacao_alvo = alvo || null;
  if (alvo) r.assessor.rebalanceamento = rebalancear(r.por_tipo, alvo, Number(body && body.aporte) || 0);
  return [200, r];
}

module.exports = { _limparIndices: () => { indicesCache = null; provCache.clear(); benchCache = null; }, benchmarks, rebalancear, assessor, proventos12m, agirCotacoes, carteiraAoVivo, cotar, indices, precoDoGoogle, estimarRendaFixa, diasUteis, emPregao, pctCdiDe, FONTES, _cache: cache };
