'use strict';
// Dono 20/11: Open Finance pelo Meu Pluggy (grátis, uso pessoal). Sem chaves = "não ligado" (nunca quebra).
// Com chaves: token para o widget, guarda a conexão e sincroniza: movimentos viram lançamentos (sem duplicar),
// transferência entre contas da pessoa fica de fora, pagamento de fatura não é gasto, saldo atualiza a conta,
// cartão vira compras com vencimento + total da fatura no A pagar.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

const resp = (j, ok = true) => ({ ok, status: ok ? 200 : 401, json: async () => j });
function fakeFetch(chamadas) {
  return async (url, opt) => {
    chamadas.push(url.replace('https://api.pluggy.ai', ''));
    if (url.endsWith('/auth')) return resp({ apiKey: 'k' });
    if (url.endsWith('/connect_token')) return resp({ accessToken: 'tok' });
    if (url.includes('/accounts?itemId=it1')) return resp({ results: [
      { id: 'c1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta X', balance: 1500.75 },
      { id: 'k1', type: 'CREDIT', name: 'Cartão Y', balance: 800.4, creditData: { balanceDueDate: '2026-12-08T00:00:00.000Z' } }] });
    if (url.includes('accountId=c1')) return resp({ results: [
      { id: 't1', date: '2026-11-18T10:00:00Z', description: 'SUPERMERCADO BOM', amount: -120.5, type: 'DEBIT', category: 'Groceries' },
      { id: 't2', date: '2026-11-15T10:00:00Z', description: 'SALARIO', amount: 3000, type: 'CREDIT', category: 'Salary' },
      { id: 't3', date: '2026-11-16T10:00:00Z', description: 'TRANSF PROPRIA', amount: -200, type: 'DEBIT', category: 'Transfer - Same ownership' },
      { id: 't4', date: '2026-11-10T10:00:00Z', description: 'PAGTO FATURA CARTAO', amount: -900, type: 'DEBIT', category: 'Credit card payment' }], next: null });
    if (url.includes('accountId=k1')) return resp({ results: [{ id: 'q1', date: '2026-11-12T10:00:00Z', description: 'POSTO', amount: 150, type: 'DEBIT', category: 'Gas stations' }], next: null });
    return resp({}, false);
  };
}

test('sem chaves: status não ligado e as ações não quebram', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z'); P.deps.env = {};
  const [, s] = await P.agir('u', { acao: 'pluggy_status' });
  assert.deepEqual([s.configurado, s.conectado], [false, false]);
  assert.equal((await P.agir('u', { acao: 'pluggy_sincronizar' }))[0], 503);
  delete P.deps.env;
});

test('token, conexão e sincronização', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  const chamadas = []; P.deps.env = { PLUGGY_CLIENT_ID: 'id', PLUGGY_CLIENT_SECRET: 'sec' }; P.deps.fetch = fakeFetch(chamadas);
  const A = (x) => P.agir('u', x);
  assert.equal((await A({ acao: 'pluggy_token' }))[1].token, 'tok');
  await A({ acao: 'pluggy_item_salvar', itemId: 'it1' });
  const [st, r] = await A({ acao: 'pluggy_sincronizar' });
  assert.equal(st, 200, JSON.stringify(r));
  assert.equal(r.novos, 4); // t3 (entre contas próprias) fica de fora
  const [, again] = await A({ acao: 'pluggy_sincronizar' });
  assert.equal(again.novos, 0, 'não duplica');
  const [, l] = await A({ acao: 'lanc_listar', mes: '2026-11' });
  const por = Object.fromEntries(l.lancamentos.map((x) => [x.descricao, x]));
  assert.equal(por['SUPERMERCADO BOM'].categoria, 'alimentacao');
  assert.equal(por.SALARIO.tipo, 'receita');
  assert.equal(por['PAGTO FATURA CARTAO'].categoria, 'fatura');
  assert.equal(por.POSTO.vencimento, '2026-12-08');
  const [, p] = await A({ acao: 'painel_resumo' });
  assert.equal(p.kpis.tenho, 1500.75);
  assert.deepEqual(p.proximas_contas.map((x) => [x.data, x.valor]), [['2026-12-08', 800.4]]);
  assert.equal(p.kpis.gasto_mes, 270.5, 'mercado + posto; pagamento de fatura não conta');
  assert.ok(!chamadas.some((u) => /sec/.test(u)), 'segredo nunca vai na URL');
  delete P.deps.env; delete P.deps.fetch;
});
