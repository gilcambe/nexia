'use strict';
// Kernex Finance, fase 4: cartões, faturas e parcelas.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const k = require('../../netlify/functions/prumo-lib/cartoes');

const CARTAO = { id: 'c1', nome: 'Nubank', limite: 5000, dia_fechamento: 3, dia_vencimento: 10 };

test('KT1. parcelas: 100 em 3x = 33,34 + 33,33 + 33,33 (sem perder centavo) nos meses certos', () => {
  const g = { cartao_id: 'c1', valor: 100, parcelas: 3, data: '2026-11-20' };
  assert.equal(k.parcelaNoMes(g, '2026-11').centavos, 3334);
  assert.equal(k.parcelaNoMes(g, '2026-12').centavos, 3333);
  assert.equal(k.parcelaNoMes(g, '2027-01').numero, 3);
  assert.equal(k.parcelaNoMes(g, '2027-02'), null);
  assert.equal(k.parcelaNoMes(g, '2026-10'), null);
  const total = ['2026-11', '2026-12', '2027-01'].reduce((s, m) => s + k.parcelaNoMes(g, m).centavos, 0);
  assert.equal(total, 10000);
});

test('KT2. limite comprometido soma parcelas do mês em diante; disponível = limite - comprometido (estimativa)', () => {
  const gastos = [
    { cartao_id: 'c1', valor: 1200, parcelas: 12, data: '2026-09-10' },   // 12x 100: de nov em diante restam 10
    { cartao_id: 'c1', valor: 300, parcelas: 1, data: '2026-11-02' },
    { cartao_id: 'c2', valor: 999, parcelas: 1, data: '2026-11-02' },     // outro cartão não conta
  ];
  const r = k.limiteDoCartao(CARTAO, gastos, '2026-11');
  assert.equal(r.comprometido, 1300);
  assert.equal(r.disponivel, 3700);
  assert.equal(r.pct, 26);
  assert.equal(k.faturaDoMes(gastos, 'c1', '2026-11'), 400);
});

test('KT3. previsão das próximas faturas mostra a parcela caindo mês a mês', () => {
  const gastos = [{ cartao_id: 'c1', valor: 300, parcelas: 3, data: '2026-11-02' }, { cartao_id: 'c1', valor: 50, parcelas: 1, data: '2026-12-01' }];
  assert.deepEqual(k.previsaoFaturas(gastos, 'c1', '2026-11', 5).map((x) => x.valor), [100, 150, 100, 0, 0]);
});

test('KT4. retorno e anuidade: só calcula com o valor do milheiro informado; sem dados avisa em vez de inventar', () => {
  assert.equal(k.retornoPct({ pontos_por_real: 2, valor_milheiro: 20 }).pct, 4);
  assert.equal(k.retornoPct({ cashback_pct: 1.5 }).pct, 1.5);
  assert.equal(k.retornoPct({ pontos_por_real: 2 }), null);
  assert.equal(k.retornoPct({ pontos_por_real: 2, cashback_pct: 1 }).parcial, true);
  const bom = k.custoBeneficioAnuidade({ anuidade: 300, pontos_por_real: 2, valor_milheiro: 20 }, 12000);
  assert.equal(bom.retorno_anual, 480);
  assert.equal(bom.liquido, 180);
  assert.equal(bom.compensa, true);
  assert.equal(k.custoBeneficioAnuidade({ anuidade: 300, pontos_por_real: 2, valor_milheiro: 20 }, 3000).compensa, false);
  assert.equal(k.custoBeneficioAnuidade({ anuidade: 300 }, 12000).compensa, null);
  const m = k.melhorCartao([{ id: 'a', nome: 'A', cashback_pct: 1 }, { id: 'b', nome: 'B', pontos_por_real: 3, valor_milheiro: 25 }, { id: 'c', nome: 'C' }]);
  assert.deepEqual(m.ranking.map((x) => x.nome), ['B', 'A']);
  assert.deepEqual(m.sem_dados.map((x) => x.nome), ['C']);
});

test('KT5. simular compra: cabe ou não no limite e mostra a fatura antes e depois de cada mês', () => {
  const gastos = [{ cartao_id: 'c1', valor: 4000, parcelas: 1, data: '2026-11-01' }];
  const nao = k.simularCompra({ cartao: CARTAO, gastos, mesRef: '2026-11', valor: 2000, parcelas: 2 });
  assert.equal(nao.cabe, false);
  assert.equal(nao.disponivel_antes, 1000);
  assert.equal(nao.disponivel_depois, -1000);
  const sim = k.simularCompra({ cartao: CARTAO, gastos, mesRef: '2026-11', valor: 600, parcelas: 3 });
  assert.equal(sim.cabe, true);
  assert.deepEqual(sim.faturas.map((f) => [f.valor_antes, f.parcela_nova]), [[4000, 200], [0, 200], [0, 200]]);
});

test('KT6. recorrências (3+ meses, valor parecido) e cobranças para revisar (repetida em 1 dia, valor 3x acima)', () => {
  const l = (data, valor, nome) => ({ tipo: 'despesa', data, valor, estabelecimento: nome });
  const rec = k.recorrencias([l('2026-08-05', 39.9, 'Streaming X'), l('2026-09-05', 39.9, 'STREAMING X'), l('2026-10-05', 40, 'Streaming X'), l('2026-10-07', 20, 'Padaria'), l('2026-11-07', 90, 'Padaria')]);
  assert.equal(rec.length, 1);
  assert.equal(rec[0].proximo_mes, '2026-11');
  const sus = k.cobrancasSuspeitas([l('2026-10-01', 50, 'Loja A'), l('2026-10-01', 50, 'Loja A'), l('2026-08-01', 30, 'Café'), l('2026-09-01', 32, 'Café'), l('2026-10-01', 31, 'Café'), l('2026-11-01', 300, 'Café')]);
  assert.deepEqual(sus.map((x) => x.motivo).sort(), ['cobrança repetida em até 1 dia', 'valor 3 vezes acima do que você costuma pagar aqui']);
});

test('KT7. cartão com campos novos: salva valores com ponto decimal sem estragar; campo ruim é recusado; antigo continua válido', () => {
  const ok = p.validarCartao({ nome: 'Itaú', limite: 8000, dia_fechamento: 5, dia_vencimento: 12, anuidade: 12.5, pontos_por_real: 1.5, valor_milheiro: 20, bandeira: 'Visa', beneficios: 'Sala VIP' });
  assert.equal(ok.ok, true);
  assert.equal(ok.item.anuidade, 12.5);
  assert.equal(ok.item.pontos_por_real, 1.5);
  assert.equal(ok.item.bandeira, 'Visa');
  assert.equal(p.validarCartao({ nome: 'X', limite: 1, dia_fechamento: 1, dia_vencimento: 1, anuidade: -5 }).ok, false);
  const antigo = p.validarCartao({ nome: 'Nubank', limite: 1000, dia_fechamento: 3, dia_vencimento: 10 });
  assert.equal(antigo.ok, true);
  assert.equal('anuidade' in antigo.item, false);
});

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col };
}
test('KT8. API: visão dos cartões, simulação e inteligência; limite do cartão não entra no saldo disponível', async () => {
  const antes = { db: p.deps.db, agora: p.deps.agora };
  const banco = bancoFalso();
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try {
    const c = await p.agir('u1', { acao: 'cartao_salvar', nome: 'Nubank', limite: 5000, dia_fechamento: 3, dia_vencimento: 7, anuidade: 300, pontos_por_real: 2, valor_milheiro: 20 });
    assert.equal(c[0], 200);
    await p.agir('u1', { acao: 'gasto_salvar', cartao_id: c[1].id, descricao: 'Geladeira', valor: 3000, data: '2026-11-02', categoria: 'casa', parcelas: 10 });
    const v = (await p.agir('u1', { acao: 'cartao_visao' }))[1];
    assert.equal(v.cartoes[0].comprometido, 3000);
    assert.equal(v.cartoes[0].disponivel, 2000);
    assert.equal(v.cartoes[0].fatura_mes, 300);
    assert.equal(v.cartoes[0].proximas.length, 6);
    assert.equal(v.melhor.ranking[0].retorno.pct, 4);
    assert.ok(v.cartoes[0].anuidade_analise.anuidade === 300);
    const s = (await p.agir('u1', { acao: 'cartao_simular', cartao_id: c[1].id, valor: 2500, parcelas: 1 }))[1];
    assert.equal(s.cabe, false);
    assert.equal((await p.agir('u1', { acao: 'cartao_simular', cartao_id: 'nao-existe', valor: 1 }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'cartao_simular', cartao_id: c[1].id, valor: 0 }))[0], 400);
    const i = (await p.agir('u1', { acao: 'cartao_inteligencia' }))[1];
    assert.deepEqual(i.recorrentes, []);
    const r = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.equal(r.saldo_disponivel, null); // limite de cartão nunca vira saldo
  } finally { Object.assign(p.deps, antes); }
});
