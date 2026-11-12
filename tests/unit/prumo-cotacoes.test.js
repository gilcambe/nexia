'use strict';
// #3304 — cotação ao vivo grátis com troca de fonte, cache e CDI para o CDB. Rede sempre falsa.
const test = require('node:test');
const assert = require('node:assert/strict');
const cot = require('../../netlify/functions/prumo-lib/cotacoes.js');

const resp = (corpo, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => corpo, text: async () => corpo });
const yahoo = (preco, ant) => ({ chart: { result: [{ meta: { regularMarketPrice: preco, chartPreviousClose: ant, regularMarketTime: 1762880400 } }] } });
const bcb = (v, d) => [{ data: d, valor: v }];
function redeFalsa(mapa) {
  const chamadas = [];
  const f = async (url) => { chamadas.push(url); for (const [re, r] of mapa) if (re.test(url)) return typeof r === 'function' ? r(url) : r; return resp({}, false); };
  f.chamadas = chamadas; return f;
}
const pregao = new Date('2026-11-12T15:00:00Z'); // quinta, 12h em Brasília

test('COT1 Yahoo responde: MXRF11 361 × 8,90 = 3.212,90 e ganho vs preço médio', async () => {
  cot._cache.clear(); cot._limparIndices();
  const f = redeFalsa([[/yahoo.*MXRF11/, resp(yahoo(8.9, 8.95))], [/bcb/, resp(bcb('0,055131', '11/11/2026'))]]);
  const r = await cot.carteiraAoVivo([{ id: 'a', ticker: 'MXRF11', quantidade: 361, preco_medio: 9.23, valor: 3212.9, tipo: 'fiis' }], { fetch: f, agora: pregao, env: {} });
  assert.equal(r.itens[0].vivo.valor, 3212.9);
  assert.equal(r.itens[0].vivo.fonte, 'yahoo');
  assert.equal(r.itens[0].vivo.ganho, -119.13); // igual ao print do banco
  assert.equal(r.itens[0].vivo.variacao_dia_pct, -0.56);
  assert.equal(r.em_pregao, true);
});

test('COT2 1ª fonte falha, 2ª responde; todas falham = última guardada marcada desatualizada', async () => {
  cot._cache.clear(); cot._limparIndices();
  const f = redeFalsa([[/yahoo/, resp({}, false)], [/brapi/, resp({ results: [{ regularMarketPrice: 8.19, regularMarketPreviousClose: 8.1 }] })]]);
  const a = await cot.cotar('CYCR11', { fetch: f, agora: pregao, env: {} });
  assert.equal(a.preco, 8.19); assert.equal(a.fonte, 'brapi');
  cot._cache.clear(); cot._limparIndices();
  const nada = redeFalsa([]);
  const b = await cot.cotar('CYCR11', { fetch: nada, agora: pregao, env: {}, guardada: { preco: 8.1, fonte: 'yahoo', data_hora: '2026-11-11T20:00:00Z' } });
  assert.equal(b.preco, 8.1); assert.equal(b.desatualizada, true);
  cot._cache.clear(); cot._limparIndices();
  const c = await cot.cotar('CYCR11', { fetch: nada, agora: pregao, env: {} });
  assert.equal(c.preco, null); assert.equal(c.desatualizada, true); // nunca inventa preço
});

test('COT3 Google Finance: lê o preço do HTML', () => {
  assert.equal(cot.precoDoGoogle('<div data-last-price="8.9" data-x>'), 8.9);
  assert.equal(cot.precoDoGoogle('<div class="YMlKec fxKbKc">R$ 1.234,56</div>'), 1234.56);
  assert.ok(Number.isNaN(cot.precoDoGoogle('nada')));
});

test('COT4 cache curto: 2ª chamada no mesmo minuto não vai à rede', async () => {
  cot._cache.clear(); cot._limparIndices();
  const f = redeFalsa([[/yahoo/, resp(yahoo(98.12, 98))]]);
  await cot.cotar('BTLG11', { fetch: f, agora: pregao, env: {} });
  await cot.cotar('BTLG11', { fetch: f, agora: new Date(pregao.getTime() + 60000), env: {} });
  assert.equal(f.chamadas.length, 1);
});

test('COT5 CDB 138.263,12 rende pelo CDI desde a data do print (dias úteis)', () => {
  assert.equal(cot.diasUteis('2026-11-11', '2026-11-12'), 1);
  assert.equal(cot.diasUteis('2026-11-13', '2026-11-16'), 1); // sexta → segunda
  const e = cot.estimarRendaFixa(138263.12, '2026-11-11', '2026-11-12', 0.055131, 100);
  assert.equal(e.valor, 138339.35);
  assert.equal(cot.pctCdiDe('102% do CDI'), 102);
  assert.equal(cot.estimarRendaFixa(1000, '2026-11-12', '2026-11-12', 0.05).valor, 1000);
});

test('COT6 carteira inteira: total ao vivo soma cotações + CDB pelo CDI; bolsa fechada é avisada', async () => {
  cot._cache.clear(); cot._limparIndices();
  const f = redeFalsa([[/yahoo.*IVVB11/, resp(yahoo(480, 478.8))], [/bcb.*sgs\.12\//, resp(bcb('0,055131', '11/11/2026'))], [/bcb/, resp(bcb('15,00', '12/11/2026'))]]);
  const sabado = new Date('2026-11-14T15:00:00Z');
  const r = await cot.carteiraAoVivo([
    { id: 'c', nome: 'CDB LIQUIDEZ DIARIA', tipo: 'renda_fixa', valor: 138263.12, data_valor: '2026-11-11' },
    { id: 'i', ticker: 'IVVB11', quantidade: 1, valor: 478.8, tipo: 'etf' },
  ], { fetch: f, agora: sabado, env: {} });
  assert.equal(r.em_pregao, false);
  assert.equal(r.itens[1].vivo.valor, 480);
  assert.equal(r.itens[0].vivo.estimado, true);
  assert.equal(r.total, Math.round((r.itens[0].vivo.valor + 480) * 100) / 100);
  assert.equal(r.total_print, 138741.92);
  assert.equal(r.indices.cdi_dia_pct, 0.055131);
});

test('COT7 GET público cotacao_saude: só dado de mercado, sem login; 503 se nenhuma fonte responde', async () => {
  const p = require('../../netlify/functions/prumo.js');
  cot._cache.clear(); cot._limparIndices();
  const antes = global.fetch;
  global.fetch = async (url) => (/yahoo/.test(url) ? resp(yahoo(8.9, 8.95)) : /bcb/.test(url) ? resp(bcb('0,055131', '11/11/2026')) : resp({}, false));
  try {
    const r = await p.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { acao: 'cotacao_saude' } });
    const b = JSON.parse(r.body);
    assert.equal(r.statusCode, 200); assert.equal(b.preco, 8.9); assert.equal(b.fonte, 'yahoo'); assert.equal(b.cdi_dia_pct, 0.055131);
    cot._cache.clear(); cot._limparIndices();
    global.fetch = async () => resp({}, false);
    const r2 = await p.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { acao: 'cotacao_saude' } });
    assert.equal(r2.statusCode, 503);
    const r3 = await p.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {} });
    assert.equal(r3.statusCode, 405);
  } finally { global.fetch = antes; }
});

test('COT8 índices do Banco Central ficam 30 min em cache (não estoura o limite grátis)', async () => {
  cot._limparIndices();
  const f = redeFalsa([[/bcb/, resp(bcb('0,055131', '11/11/2026'))]]);
  await cot.indices(f, 0); await cot.indices(f, 60000);
  assert.equal(f.chamadas.length, 3); // 3 séries na 1ª vez, nenhuma na 2ª
});

test('COT9 assessor: peso, renda de proventos, alertas de queda, abaixo do PM e concentração', async () => {
  cot._cache.clear(); cot._limparIndices();
  const div = { chart: { result: [{ meta: { regularMarketPrice: 8.9, chartPreviousClose: 9.3 }, events: { dividends: Object.fromEntries(Array.from({ length: 12 }, (_, k) => [k, { amount: 0.1, date: 1730000000 + k * 2592000 }])) } }] } };
  const f = redeFalsa([[/yahoo.*MXRF11/, resp(div)], [/yahoo.*RBRR11/, resp(yahoo(63, 63.5))], [/bcb/, resp(bcb('0,055131', '11/11/2026'))]]);
  const r = await cot.carteiraAoVivo([
    { id: 'm', ticker: 'MXRF11', quantidade: 361, preco_medio: 9.23, valor: 3212.9, tipo: 'fiis' },
    { id: 'r', ticker: 'RBRR11', quantidade: 19, preco_medio: 76.22, valor: 1197, tipo: 'fiis' },
    { id: 'c', nome: 'CDB LIQUIDEZ DIARIA', tipo: 'renda_fixa', valor: 138263.12, data_valor: '2026-11-12' },
  ], { fetch: f, agora: pregao, env: {} });
  const m = r.itens.find((x) => x.id === 'm');
  assert.equal(m.renda_mensal, 36.1); // 361 cotas × R$ 1,20 no ano ÷ 12
  assert.equal(m.yield_on_cost_pct, 13);
  assert.ok(r.itens.reduce((a, x) => a + x.peso_pct, 0) > 99.9);
  const txt = r.assessor.alertas.map((a) => a.tipo);
  assert.ok(txt.includes('queda'), 'MXRF11 caiu 4,3% no dia');
  assert.ok(txt.includes('abaixo_pm'), 'RBRR11 63 vs PM 76,22');
  assert.ok(txt.includes('concentracao'), 'CDB = ~97%');
  assert.equal(r.assessor.renda_mensal_estimada, 36.1);
});

test('COT10 chat assessor responde com os dados reais da carteira (ticker, proventos, alertas)', async () => {
  const { responderInvest } = require('../../netlify/functions/prumo-lib/assistente.js');
  cot._cache.clear(); cot._limparIndices();
  const div = { chart: { result: [{ meta: { regularMarketPrice: 8.9, chartPreviousClose: 8.95 }, events: { dividends: { a: { amount: 1.2, date: 1750000000 } } } }] } };
  const itens = [{ id: 'm', ticker: 'MXRF11', quantidade: 361, preco_medio: 9.23, valor: 3212.9, tipo: 'fiis' }];
  const r = await cot.carteiraAoVivo(itens, { fetch: redeFalsa([[/yahoo/, resp(div)]]), agora: pregao, env: {} });
  assert.match(responderInvest('quanto rendeu meu MXRF11?', itens, r).resposta, /361 cotas × R\$\s?8,90 = R\$\s?3\.212,90.*Perda de R\$\s?119,13/);
  assert.match(responderInvest('quanto recebo de dividendos?', itens, r).resposta, /36,10 por mês/);
  assert.match(responderInvest('quanto rendeu o PETR4?', itens, r).resposta, /Não achei PETR4/);
});

test('COT11 rebalanceamento: aporte vai para o que está abaixo da meta, sem vender; meta precisa somar 100', () => {
  const r = cot.rebalancear({ renda_fixa: 138263.12, fiis: 10289.82, etf: 478.8 }, { renda_fixa: 70, fiis: 20, etf: 10 }, 10000);
  assert.equal(r.comprar.reduce((a, x) => a + x.valor, 0), 10000);
  assert.ok(!r.comprar.some((x) => x.tipo === 'renda_fixa'), 'renda fixa já está acima da meta');
  assert.ok(r.comprar.find((x) => x.tipo === 'fiis').valor > r.comprar.find((x) => x.tipo === 'etf').valor);
  assert.equal(cot.rebalancear({ fiis: 1 }, { fiis: 60, etf: 30 }, 100), null);
  assert.match(r.aviso, /não é recomendação/);
});

test('COT12 comparativos de 12 meses: CDI do Banco Central e índices pelo Yahoo', async () => {
  cot._limparIndices();
  const serie = (a, b) => ({ chart: { result: [{ indicators: { adjclose: [{ adjclose: [a, null, b] }] } }] } });
  const f = redeFalsa([[/sgs\.4391/, resp(Array.from({ length: 12 }, () => ({ valor: '1,0' })))], [/%5EBVSP/, resp(serie(100, 110))], [/XFIX11/, resp(serie(10, 9.5))], [/IVVB11/, resp(serie(300, 360))]]);
  const b = await cot.benchmarks(f, 0);
  assert.equal(b.cdi_12m_pct, 12.68); assert.equal(b.ibov_12m_pct, 10); assert.equal(b.ifix_12m_pct, -5); assert.equal(b.ivvb11_12m_pct, 20);
});
