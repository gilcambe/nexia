// Contrato: Kernex Finance, aba Investir com valor ATUAL (cotação ao vivo e CDI), igual ao banco.
// Prova do dono 16/11 20:05: o banco mostrava Renda fixa R$ 138.473,95; o Finance mostrava o CDB com R$ 138.263,12
// (valor do print antigo), "sem cotação" em TODOS os ativos, BTLG11 (FII) como "Renda fixa" e o total não mudava.
// Causa: a aba Investir (`invest_visao` → `visao`) só usa cotação digitada à mão. A cotação ao vivo já existe e funciona
// no ar (`carteiraAoVivo` em `prumo-lib/cotacoes.js`, usada só pela tela Carteira), mas a aba Investir não a usa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { visao, agirInvestimentos } = require('../../netlify/functions/prumo-lib/investimentos');

const T = '2026-11-16T17:00:00.000Z'; // segunda, 14h em Brasília (pregão aberto)
const itens = () => [
  { id: 'a', nome: 'CDB', tipo: 'renda_fixa', valor: 138263.12, data_valor: '2026-11-03', taxa: '100% do CDI' },
  { id: 'b', nome: 'MXRF11', tipo: 'fiis', ticker: 'MXRF11', quantidade: 100, valor: 800 },
  { id: 'c', nome: 'BTLG11', tipo: 'renda_fixa', ticker: 'BTLG11', quantidade: 25, valor: 2518 },
];
const vivo = () => ({
  itens: [
    { id: 'a', ticker: null, valor_print: 138263.12, vivo: { valor: 138473.95, fonte: 'CDI (Banco Central)', estimado: true, dias_uteis: 9, data_hora: T, desatualizada: false } },
    { id: 'b', ticker: 'MXRF11', valor_print: 800, vivo: { valor: 858, preco: 8.58, variacao_dia_pct: 0.5, fonte: 'yahoo', data_hora: T, desatualizada: false } },
    { id: 'c', ticker: 'BTLG11', valor_print: 2518, vivo: { valor: 2550, preco: 102, variacao_dia_pct: -0.2, fonte: 'yahoo', data_hora: T, desatualizada: false } },
  ],
  total: 141881.95, total_print: 141581.12, em_pregao: true, atualizado_em: T,
});
const item = (v, id) => v.itens.find((x) => x.id === id);

test('visao(itens, dividendos, agora, vivo): valor de cada ativo é o valor ATUAL (cotação ao vivo / CDI), com fonte e hora', () => {
  const v = visao(itens(), [], T, vivo());
  assert.equal(item(v, 'a').valor, 138473.95, 'CDB: use o valor atualizado pelo CDI (vivo.valor), não o do print');
  assert.equal(item(v, 'b').valor, 858, 'MXRF11: valor = quantidade × cotação ao vivo (vivo.valor)');
  assert.ok(item(v, 'b').cotacao, 'MXRF11: precisa mostrar a cotação ao vivo (campo cotacao)');
  assert.equal(item(v, 'b').cotacao.preco, 8.58);
  assert.equal(item(v, 'b').cotacao.fonte, 'yahoo');
  assert.equal(item(v, 'b').cotacao.data_hora, T);
  assert.equal(item(v, 'b').cotacao.desatualizada, false);
  assert.ok(item(v, 'a').cotacao, 'CDB: precisa dizer de onde veio o valor (cotacao com fonte CDI)');
  assert.equal(item(v, 'a').cotacao.fonte, 'CDI (Banco Central)');
  assert.equal(item(v, 'a').cotacao.estimado, true, 'CDB: marque estimado: true (é estimativa pelo CDI)');
  assert.equal(item(v, 'a').valor_print, 138263.12, 'guarde o valor do print em valor_print para comparação');
});

test('o total e a concentração usam os valores ATUAIS', () => {
  const v = visao(itens(), [], T, vivo());
  assert.equal(v.concentracao.total, 141881.95, 'total investido = soma dos valores atuais');
  assert.ok(!v.lacunas.some((l) => /sem cotação/i.test(l)), 'com cotação ao vivo em todos, não pode aparecer o aviso "sem cotação"');
  assert.equal(v.em_pregao, true, 'devolva em_pregao (a tela usa para se atualizar sozinha)');
  assert.equal(v.atualizado_em, T, 'devolva atualizado_em (hora da cotação)');
});

test('ticker de FII (4 letras + 11) cadastrado como renda fixa vira FII', () => {
  const v = visao(itens(), [], T, vivo());
  assert.equal(item(v, 'c').tipo, 'fiis', 'BTLG11 é FII: tipo "fiis", não "renda_fixa"');
  assert.ok(v.concentracao.por_tipo.some((t) => t.nome === 'fiis'), 'concentração por tipo precisa contar BTLG11 em fiis');
});

test('sem cotação ao vivo para um ativo: fica o valor do print e o aviso aparece; sem o 4º parâmetro, nada muda', () => {
  const vv = vivo(); vv.itens[1].vivo = null;
  const v = visao(itens(), [], T, vv);
  assert.equal(item(v, 'b').valor, 800);
  assert.equal(item(v, 'b').cotacao, null);
  assert.ok(v.lacunas.some((l) => /sem cotação/i.test(l)));
  const antigo = visao(itens(), [], T);
  assert.equal(antigo.concentracao.total, 141581.12, 'sem vivo, o total continua a soma dos prints');
});

test('agirInvestimentos("invest_visao") busca a cotação ao vivo (c.deps.fetch) e devolve o valor atual', async () => {
  const pedidos = [];
  const fetch = async (url) => {
    pedidos.push(String(url));
    const ok = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (/finance\.yahoo\.com\/v8\/finance\/chart\/MXRF11\.SA\?range=1d/.test(url)) return ok({ chart: { result: [{ meta: { regularMarketPrice: 8.58, chartPreviousClose: 8.5, regularMarketTime: Date.parse(T) / 1000 } }] } });
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  const base = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }), get: async () => ({ docs: [] }) }) };
  const c = { base, listar: async () => [], listarCarteira: async () => [itens()[1]], salvar: async () => [200, {}], apagar: async () => [200, {}], agoraIso: T, deps: { fetch, env: {} } };
  const [st, v] = await agirInvestimentos('invest_visao', {}, c);
  assert.equal(st, 200);
  assert.ok(pedidos.some((u) => /MXRF11/.test(u)), 'invest_visao precisa buscar a cotação ao vivo do MXRF11 (use carteiraAoVivo de cotacoes.js com c.deps.fetch)');
  assert.equal(v.itens[0].valor, 858, 'valor = 100 cotas × R$ 8,58 ao vivo');
  assert.equal(v.itens[0].cotacao.fonte, 'yahoo');
});

test('se a cotação ao vivo falhar inteira, invest_visao responde com os valores do print (não quebra)', async () => {
  const fetch = async () => { throw new Error('sem internet'); };
  const base = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }), get: async () => ({ docs: [] }) }) };
  const c = { base, listar: async () => [], listarCarteira: async () => [{ id: 'z', nome: 'XPTO11', tipo: 'fiis', ticker: 'XPTO11', quantidade: 3, valor: 30 }], salvar: async () => [200, {}], apagar: async () => [200, {}], agoraIso: T, deps: { fetch, env: {} } };
  const [st, v] = await agirInvestimentos('invest_visao', {}, c);
  assert.equal(st, 200);
  assert.equal(v.itens[0].valor, 30);
});

test('tela Investir (prumo/investimentos.js) se atualiza sozinha no pregão e mostra o CDB estimado pelo CDI', () => {
  const js = fs.readFileSync(path.join(__dirname, '../../prumo/investimentos.js'), 'utf8');
  assert.match(js, /setInterval\s*\(/, 'chame invest_visao de novo a cada 60 s enquanto v.em_pregao (como prumo/carteira.js faz)');
  assert.match(js, /em_pregao/, 'use v.em_pregao para decidir se atualiza sozinha');
  assert.match(js, /clearInterval\s*\(/, 'pare a atualização quando sair da aba (clearInterval)');
  assert.match(js, /estimado/, 'para o CDB mostre "estimado pelo CDI" (cotacao.estimado) em vez de "cotação R$ undefined"');
});
