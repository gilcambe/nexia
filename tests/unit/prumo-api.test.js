'use strict';
// Prumo (#2924 carteira, #2925 cartões/gastos, #2926 listas, #2927 ler print, #2936 objetivos/histórico).
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');

// Banco falso no formato do firebase-init (collection/doc/get/set/delete).
function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (n) => col(`${caminho}/${id}/${n}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
  });
  return { collection: col, dados };
}

test('PR1. carteira: item válido entra; nome vazio, valor negativo e tipo inválido são recusados', () => {
  const ok = p.validarItemCarteira({ nome: 'CDB 120%', banco: 'Inter', tipo: 'renda_fixa', valor: '1.234,56', data_valor: '2026-11-01' });
  assert.equal(ok.ok, true);
  assert.equal(ok.item.valor, 1234.56);
  assert.equal(p.validarItemCarteira({ nome: '  ', valor: 10 }).ok, false);
  assert.equal(p.validarItemCarteira({ nome: 'X', valor: -1 }).ok, false);
  assert.equal(p.validarItemCarteira({ nome: 'X', valor: 1, tipo: 'loteria' }).ok, false);
});

test('PR2. sem login responde 401 com frase simples', async () => {
  const r = await p.handler({ httpMethod: 'POST', headers: {}, body: '{"acao":"carteira_listar"}' });
  assert.equal(r.statusCode, 401);
  assert.match(JSON.parse(r.body).error, /Entre com sua conta/);
});

test('PR3. gasto de 300 em 3x conta 100 por mês durante 3 meses e 0 no 4º', () => {
  const g = p.validarGasto({ cartao_id: 'c1', descricao: 'TV', valor: 300, data: '2026-11-05', categoria: 'casa', parcelas: 3 });
  assert.equal(g.ok, true);
  const gastos = [{ id: 'g1', ...g.item }];
  for (const mes of ['2026-11', '2026-12', '2027-01']) assert.equal(p.resumoMes(gastos, mes).total, 100, mes);
  assert.equal(p.resumoMes(gastos, '2027-02').total, 0);
  assert.equal(p.resumoMes(gastos, '2026-12').gastos[0].parcela, 2);
  assert.equal(p.validarGasto({ ...g.item, categoria: 'cassino' }).ok, false);
  assert.equal(p.validarCartao({ nome: 'Nubank', limite: 1000, dia_fechamento: 3, dia_vencimento: 40 }).ok, false);
});

test('PR4. lista: aviso só com lembrete vencido e item faltando', () => {
  const listas = [
    { id: 'a', nome: 'Mercado', lembrete: '2026-11-01T10:00:00Z', itens: [{ nome: 'Arroz', comprado: false }] },
    { id: 'b', nome: 'Feira', lembrete: '2026-11-01T10:00:00Z', itens: [{ nome: 'Banana', comprado: true }] },
    { id: 'c', nome: 'Farmácia', lembrete: '2026-12-01T10:00:00Z', itens: [{ nome: 'Remédio', comprado: false }] },
    { id: 'd', nome: 'Sem lembrete', itens: [{ nome: 'Pão' }] },
  ];
  const av = p.avisosPendentes(listas, '2026-11-02T09:00:00Z');
  assert.deepEqual(av.map((x) => x.id), ['a']);
  assert.equal(p.validarLista({ nome: 'X', itens: [{ nome: 'Y', qtd: 0 }] }).ok, false);
});

test('PR5. ler print: JSON dentro de cerca é lido; imagem grande ou inválida é recusada', () => {
  assert.deepEqual(p.extrairJson('Aqui:\n```json\n{"itens":[{"nome":"a {b}"}]}\n```'), { itens: [{ nome: 'a {b}' }] });
  assert.equal(p.extrairJson('sem json'), null);
  assert.equal(p.lerImagens([]).ok, false);
  assert.equal(p.lerImagens(['data:text/plain;base64,AAAA']).ok, false);
  const grande = 'data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024);
  assert.match(p.lerImagens([grande]).erro, /grande/);
  assert.equal(p.lerImagens(['data:image/png;base64,iVBORw0KGgo=']).ok, true);
});

test('PR6. ler print usa só IA grátis com visão e descarta item inválido', async () => {
  const usados = [];
  const deps = {
    listFor: () => [{ provider: 'anthropic', model: 'x' }, { provider: 'groq', model: 'sem-visao' }, { provider: 'gemini', model: 'flash' }],
    getRouter: () => ({
      capabilities: (d) => ({ available: true, vision: d.model !== 'sem-visao' }),
      chat: async (d) => { usados.push(d.provider); return { text: '{"itens":[{"nome":"Tesouro","tipo":"tesouro","valor":500,"data_valor":"2026-11-01"},{"nome":"","valor":1}]}' }; },
    }),
  };
  const r = await p.lerPrint([{ mime: 'image/png', data: 'AAAA' }], deps);
  assert.deepEqual(usados, ['gemini']);
  assert.equal(r.itens.length, 1);
  assert.equal(r.descartados.length, 1);
});

test('PR7. objetivo 25.000 de 100.000 = 25%; histórico mostra variação entre meses', () => {
  assert.equal(p.validarObjetivo({ nome: 'Casa', meta: 100000, prazo: '2030-01' }).ok, true);
  assert.equal(p.validarObjetivo({ nome: 'Casa', meta: 0, prazo: '2030-01' }).ok, false);
  const [o] = p.progressoObjetivos([{ id: 'o1', meta: 100000 }], [{ objetivo_id: 'o1', valor: 20000 }, { objetivo_id: 'o1', valor: 5000 }, { valor: 999 }]);
  assert.equal(o.percentual, 25);
  assert.equal(o.falta, 75000);
  const h = p.resumoHistorico([{ data: '2026-10-05', total: 900 }, { data: '2026-10-30', total: 1000 }, { data: '2026-11-02', total: 1100 }]);
  assert.deepEqual(h.map((m) => [m.mes, m.total, m.variacao]), [['2026-10', 1000, null], ['2026-11', 1100, 100]]);
  assert.equal(h[1].variacao_pct, 10);
});

test('PR8. agir: salvar na carteira grava a foto do dia e apagar objetivo solta os itens', async () => {
  const banco = bancoFalso();
  const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-02T12:00:00Z');
  try {
    const obj = await p.agir('u1', { acao: 'objetivo_salvar', nome: 'Viagem', meta: 1000, prazo: '2027-06' });
    assert.equal(obj[0], 200);
    const item = await p.agir('u1', { acao: 'carteira_salvar', nome: 'Poupança', tipo: 'poupanca', valor: 250, objetivo_id: obj[1].id });
    assert.equal(item[0], 200);
    const foto = banco.dados.get('prumo_users/u1/historico/2026-11-02');
    assert.equal(foto.total, 250);
    const lista = await p.agir('u1', { acao: 'objetivo_listar' });
    assert.equal(lista[1].objetivos[0].percentual, 25);
    await p.agir('u1', { acao: 'objetivo_apagar', id: obj[1].id });
    const cart = await p.agir('u1', { acao: 'carteira_listar' });
    assert.equal(cart[1].itens[0].objetivo_id, null);
    assert.equal((await p.agir('u1', { acao: 'xyz' }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'gasto_listar', mes: '11/2026' }))[0], 400);
  } finally { Object.assign(p.deps, antes); }
});
