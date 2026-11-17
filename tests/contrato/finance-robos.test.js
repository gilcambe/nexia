// Contrato: Kernex Finance — robôs de investimento (parte 1 de 3: o "cérebro" das regras).
// Pedido do dono 16/11: "os robôs de investimento devem funcionar". Decisão do dono: robô de ALERTAS e ESTRATÉGIA
// (grátis): a pessoa define regras, o robô confere com a cotação ao vivo e avisa. Quem compra/vende é a pessoa.
// Este contrato cria netlify/functions/prumo-lib/robos.js com duas funções puras:
//   validarRegra(o)  -> { ok, item } | { ok: false, erro }
//   avaliarRegras(regras, viva, agoraIso) -> { disparos: [{ regra_id, tipo, ticker?, texto }], lacunas: [] }
// "viva" é o resultado de carteiraAoVivo() (prumo-lib/cotacoes.js): { itens: [{ id, ticker, vivo: { preco, variacao_dia_pct },
// proventos: { por_cota_12m } }], total, por_tipo: { fiis: 1000, ... }, assessor: { alocacao_alvo: { fiis: 30, ... } } }.
// Partes 2 (API + tela) e 3 (rodar de hora em hora + e-mail) vêm depois.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarRegra, avaliarRegras } = require('../../netlify/functions/prumo-lib/robos');

const T = '2026-11-16T17:00:00.000Z'; // 14h em Brasília
const viva = () => ({
  itens: [
    { id: 'a', ticker: 'MXRF11', vivo: { preco: 8.4, variacao_dia_pct: -1.2, valor: 840 }, proventos: { por_cota_12m: 1.02 } },
    { id: 'b', ticker: 'PETR4', vivo: { preco: 41.5, variacao_dia_pct: -4.1, valor: 830 }, proventos: null },
    { id: 'c', ticker: 'BTLG11', vivo: null, proventos: null },
  ],
  total: 10000,
  por_tipo: { fiis: 1500, acoes: 830, renda_fixa: 7670 },
  assessor: { alocacao_alvo: { fiis: 30, acoes: 20, renda_fixa: 50 } },
});
const disparou = (r, id) => r.disparos.find((d) => d.regra_id === id);

test('validarRegra: aceita as 6 regras e recusa as inválidas com mensagem clara', () => {
  assert.equal(validarRegra({ tipo: 'preco_abaixo', ticker: 'mxrf11', valor: 8.5 }).ok, true);
  assert.equal(validarRegra({ tipo: 'preco_abaixo', ticker: 'mxrf11', valor: 8.5 }).item.ticker, 'MXRF11', 'ticker em maiúsculas');
  assert.equal(validarRegra({ tipo: 'preco_acima', ticker: 'PETR4', valor: 50 }).ok, true);
  assert.equal(validarRegra({ tipo: 'queda_dia', ticker: 'PETR4', pct: 3 }).ok, true);
  assert.equal(validarRegra({ tipo: 'dy_minimo', ticker: 'MXRF11', pct: 11 }).ok, true);
  assert.equal(validarRegra({ tipo: 'rebalancear', desvio_pct: 5 }).ok, true);
  assert.equal(validarRegra({ tipo: 'concentracao', pct: 40 }).ok, true);
  for (const [o, msg] of [
    [{ tipo: 'comprar_tudo' }, /tipo/i],
    [{ tipo: 'preco_abaixo', ticker: '', valor: 8 }, /ticker|ativo/i],
    [{ tipo: 'preco_abaixo', ticker: 'XX', valor: 8 }, /ticker|ativo/i],
    [{ tipo: 'preco_abaixo', ticker: 'MXRF11', valor: 0 }, /valor|preço/i],
    [{ tipo: 'queda_dia', ticker: 'PETR4', pct: 0 }, /%|porcent/i],
    [{ tipo: 'queda_dia', ticker: 'PETR4', pct: 150 }, /%|porcent/i],
    [{ tipo: 'rebalancear', desvio_pct: 0 }, /%|desvio|porcent/i],
  ]) { const r = validarRegra(o); assert.equal(r.ok, false, JSON.stringify(o)); assert.match(r.erro, msg); }
});

test('preço abaixo / acima do alvo dispara com texto claro', () => {
  const r = avaliarRegras([
    { id: 'r1', tipo: 'preco_abaixo', ticker: 'MXRF11', valor: 8.5 },
    { id: 'r2', tipo: 'preco_acima', ticker: 'PETR4', valor: 40 },
    { id: 'r3', tipo: 'preco_abaixo', ticker: 'PETR4', valor: 30 }, // 41,50 não está abaixo de 30
  ], viva(), T);
  assert.ok(disparou(r, 'r1'), 'MXRF11 a 8,40 está abaixo de 8,50');
  assert.match(disparou(r, 'r1').texto, /MXRF11/);
  assert.match(disparou(r, 'r1').texto, /8,40/, 'valores em reais com vírgula (8,40)');
  assert.ok(disparou(r, 'r2'), 'PETR4 a 41,50 está acima de 40');
  assert.ok(!disparou(r, 'r3'));
});

test('queda forte no dia e dividendo (DY 12 meses) mínimo', () => {
  const r = avaliarRegras([
    { id: 'q1', tipo: 'queda_dia', ticker: 'PETR4', pct: 3 },
    { id: 'q2', tipo: 'queda_dia', ticker: 'MXRF11', pct: 3 }, // caiu só 1,2%
    { id: 'd1', tipo: 'dy_minimo', ticker: 'MXRF11', pct: 11 }, // 1,02 / 8,40 = 12,14%
    { id: 'd2', tipo: 'dy_minimo', ticker: 'MXRF11', pct: 13 },
  ], viva(), T);
  assert.ok(disparou(r, 'q1'));
  assert.ok(!disparou(r, 'q2'));
  assert.ok(disparou(r, 'd1'));
  assert.match(disparou(r, 'd1').texto, /12,1/, 'mostre o DY calculado (12,1%)');
  assert.ok(!disparou(r, 'd2'));
});

test('rebalancear: avisa o tipo que saiu da meta além do desvio; concentração: avisa o maior tipo acima do limite', () => {
  const r = avaliarRegras([{ id: 'b1', tipo: 'rebalancear', desvio_pct: 5 }, { id: 'c1', tipo: 'concentracao', pct: 60 }], viva(), T);
  const b = r.disparos.filter((d) => d.regra_id === 'b1');
  // fiis 15% (meta 30) e renda_fixa 76,7% (meta 50) saíram; ações 8,3% (meta 20) também
  assert.equal(b.length, 3, 'um aviso por tipo fora da meta');
  assert.ok(b.some((d) => /fiis|FII|imobili/i.test(d.texto) && /15/.test(d.texto) && /30/.test(d.texto)), 'diga o % atual e a meta');
  assert.ok(disparou(r, 'c1'), 'renda fixa é 76,7% (> 60%)');
  const semMeta = viva(); semMeta.assessor.alocacao_alvo = null;
  const r2 = avaliarRegras([{ id: 'b1', tipo: 'rebalancear', desvio_pct: 5 }], semMeta, T);
  assert.equal(r2.disparos.length, 0);
  assert.ok(r2.lacunas.some((l) => /meta|aloca/i.test(l)), 'sem meta de alocação: explique na lacuna');
});

test('não repete no mesmo dia; sem cotação não dispara e explica; nunca manda comprar ou vender', () => {
  const regras = [
    { id: 'r1', tipo: 'preco_abaixo', ticker: 'MXRF11', valor: 8.5, ultimo_disparo: '2026-11-16' },
    { id: 'r2', tipo: 'preco_acima', ticker: 'PETR4', valor: 40, ultimo_disparo: '2026-11-15' },
    { id: 'r3', tipo: 'preco_abaixo', ticker: 'BTLG11', valor: 200 },
  ];
  const r = avaliarRegras(regras, viva(), T);
  assert.ok(!disparou(r, 'r1'), 'já avisou hoje (data de Brasília): não repete');
  assert.ok(disparou(r, 'r2'), 'último aviso foi ontem: avisa de novo');
  assert.ok(!disparou(r, 'r3'));
  assert.ok(r.lacunas.some((l) => /BTLG11/.test(l)), 'BTLG11 sem cotação agora: diga na lacuna');
  const tudo = avaliarRegras([{ id: 'x1', tipo: 'preco_abaixo', ticker: 'MXRF11', valor: 9 }, { id: 'x2', tipo: 'queda_dia', ticker: 'PETR4', pct: 1 }, { id: 'x3', tipo: 'rebalancear', desvio_pct: 1 }], viva(), T);
  for (const d of tudo.disparos) assert.doesNotMatch(d.texto, /\b(compre|venda|comprar|vender)\b/i, 'o robô informa, não recomenda: ' + d.texto);
});
