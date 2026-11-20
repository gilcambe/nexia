'use strict';
// Dono 19-20/11: o total da fatura (vence no mês seguinte) tem que aparecer em "Próximos meses"/"Próximas contas".
// fatura_gravar guarda o total no vencimento; as compras lidas do mesmo vencimento não somam de novo; pagar a fatura
// não conta como gasto do mês. doc_ler devolve o total e o vencimento da fatura lida.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

test('fatura_gravar: aparece no mês do vencimento, sem somar as compras de novo', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  const A = (x) => P.agir('u', x);
  await A({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-05', vencimento: '2026-12-08', descricao: 'Loja', valor: 300, tipo: 'despesa', categoria: 'compras' }] });
  assert.equal((await A({ acao: 'fatura_gravar', nome: 'Cartão A', valor: '1.250,40', vencimento: '2026-12-08' }))[0], 200);
  await A({ acao: 'fatura_gravar', nome: 'Cartão A', valor: 1260.4, vencimento: '2026-12-08' }); // regravar troca o valor
  const [, p] = await A({ acao: 'painel_resumo' });
  const dez = p.proximos_meses[0];
  assert.equal(dez.mes, '2026-12');
  assert.deepEqual(dez.itens.map((x) => [x.nome, x.valor]), [['Fatura Cartão A', 1260.4]]);
  assert.deepEqual(p.proximas_contas.map((x) => x.valor), [1260.4]);
  assert.equal(p.kpis.gasto_mes, 300);
  assert.equal((await A({ acao: 'fatura_gravar', valor: 10 }))[0], 400);
});

test('doc_ler devolve o total e o vencimento da fatura', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  P.deps.perguntarVisao = async () => JSON.stringify({ tipo_documento: 'fatura', instituicao: 'Banco X', total_documento: '1.234,56', vencimento_documento: '08/12/2026',
    lancamentos: [{ data: '2026-11-03', descricao: 'Mercado', valor: 100, tipo: 'despesa', categoria: 'alimentacao' }] });
  const img = 'data:image/png;base64,' + Buffer.from('x'.repeat(200)).toString('base64');
  const [st, r] = await P.agir('u', { acao: 'doc_ler', imagens: [img] });
  delete P.deps.perguntarVisao;
  assert.equal(st, 200, JSON.stringify(r));
  assert.deepEqual(r.fatura, { total: 1234.56, vencimento: '2026-12-08', instituicao: 'Banco X' });
});

test('dono 20/11: duas faturas lidas de uma vez entram sozinhas no mês do vencimento', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  const lidos = [
    { tipo_documento: 'fatura', instituicao: 'Banco X', total_documento: '1.000,10', vencimento_documento: '2026-12-06', lancamentos: [{ data: '2026-11-03', descricao: 'Mercado', valor: 100, tipo: 'despesa', categoria: 'alimentacao', conta_ou_cartao: 'final 1111' }] },
    { tipo_documento: 'fatura', instituicao: 'Banco X', total_documento: 200.2, vencimento_documento: '2026-12-10', lancamentos: [{ data: '2026-11-04', descricao: 'Farmácia', valor: 50, tipo: 'despesa', categoria: 'saude', conta_ou_cartao: 'final 2222' }] },
  ];
  let i = 0; P.deps.perguntarVisao = async () => JSON.stringify(lidos[i++]);
  const img = (n) => 'data:image/png;base64,' + Buffer.from(String(n).repeat(200)).toString('base64');
  const [st, r] = await P.agir('u', { acao: 'doc_ler', imagens: [img(1), img(2)] });
  delete P.deps.perguntarVisao;
  assert.equal(st, 200, JSON.stringify(r));
  assert.equal(r.faturas.length, 2);
  assert.ok(r.faturas.every((x) => x.gravada));
  assert.ok(r.prontos.every((l) => /^2026-12-/.test(l.vencimento)), 'compras herdam o vencimento da fatura');
  const [, p] = await P.agir('u', { acao: 'painel_resumo' });
  const dez = p.proximos_meses[0];
  assert.equal(dez.mes, '2026-12');
  assert.deepEqual(dez.itens.map((x) => x.valor).sort((a, c) => a - c), [200.2, 1000.1]);
});

test('dono 20/11: o administrador (master) não tem limite de leituras', async () => {
  const aj = require('../../netlify/functions/prumo-lib/ajuda.js');
  const b = banco(); const base = b.collection('prumo_users').doc('u');
  await base.collection('config').doc('uso').set({ mes: '2026-11', leituras: 60 });
  assert.equal((await aj.contarLeitura(base, '2026-11-20T12:00:00Z', 1)).ok, false);
  assert.equal((await aj.contarLeitura(base, '2026-11-20T12:00:00Z', 1, true)).ok, true);
});

test('dono 20/11: print sem total e sem vencimento usa a soma e o dia do cartão cadastrado', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  await b.collection('prumo_users').doc('u').collection('cartoes').doc('k1').set({ nome: 'Cartão final 1111', dia_vencimento: 6, limite: 1000 });
  P.deps.perguntarVisao = async () => JSON.stringify({ tipo_documento: 'outro', instituicao: 'Banco X', total_documento: null, vencimento_documento: null,
    lancamentos: [{ data: '2026-11-03', descricao: 'Mercado', valor: 100.5, tipo: 'despesa', categoria: 'alimentacao', conta_ou_cartao: 'final 1111' }, { data: '2026-11-04', descricao: 'Posto', valor: 50, tipo: 'despesa', categoria: 'transporte', conta_ou_cartao: 'final 1111' }] });
  const img = 'data:image/png;base64,' + Buffer.from('z'.repeat(200)).toString('base64');
  const [st, r] = await P.agir('u', { acao: 'doc_ler', imagens: [img] });
  delete P.deps.perguntarVisao;
  assert.equal(st, 200, JSON.stringify(r));
  assert.deepEqual(r.faturas.map((x) => [x.total, x.vencimento, x.gravada]), [[150.5, '2026-12-06', true]]);
  const [, p] = await P.agir('u', { acao: 'painel_resumo' });
  assert.deepEqual(p.proximos_meses[0].itens.map((x) => x.valor), [150.5]);
});

test('dono 20/11: print sem ano (IA chuta o ano passado) cai no mês certo e no cartão certo', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T19:00:00Z');
  const u = b.collection('prumo_users').doc('u');
  await u.collection('cartoes').doc('kv').set({ nome: 'CARTAO VISA X', dia_vencimento: 6, dia_fechamento: 30, limite: 5000 });
  await u.collection('cartoes').doc('km').set({ nome: 'CARTAO MASTER X', dia_vencimento: 10, dia_fechamento: 3, limite: 5000 });
  await u.collection('lancamentos').doc('fat-2025-12-06-banco-x').set({ data: '2025-12-06', vencimento: '2025-12-06', descricao: 'Fatura Banco X', valor: 1000.1, tipo: 'despesa', categoria: 'fatura', status: 'realizado' });
  const lidos = [
    { tipo_documento: 'fatura', instituicao: 'Banco X', total_documento: 1000.1, vencimento_documento: '2025-12-06', lancamentos: [{ data: '2025-11-14', descricao: 'Loja', valor: 1000.1, tipo: 'despesa', categoria: 'compras' }] },
    { tipo_documento: 'fatura', instituicao: 'Banco X', total_documento: 200.2, vencimento_documento: '2025-12-10', lancamentos: [{ data: '2025-11-15', descricao: 'Posto', valor: 200.2, tipo: 'despesa', categoria: 'transporte' }] },
  ];
  let i = 0; P.deps.perguntarVisao = async () => JSON.stringify(lidos[i++]);
  const img = (n) => 'data:image/png;base64,' + Buffer.from(String(n).repeat(200)).toString('base64');
  const [st, r] = await P.agir('u', { acao: 'doc_ler', imagens: [img(3), img(4)] });
  delete P.deps.perguntarVisao;
  assert.equal(st, 200, JSON.stringify(r));
  assert.deepEqual(r.faturas.map((x) => [x.vencimento, x.cartao_id, x.gravada]), [['2026-12-06', 'kv', true], ['2026-12-10', 'km', true]]);
  assert.ok(r.prontos.every((l) => l.data.startsWith('2026-11')), 'compras no ano certo');
  const [, p] = await P.agir('u', { acao: 'painel_resumo' });
  assert.deepEqual(p.proximos_meses[0].itens.map((x) => x.valor).sort((a, c) => a - c), [200.2, 1000.1]);
  assert.equal((await u.collection('lancamentos').doc('fat-2025-12-06-banco-x').get()).exists, false, 'a do ano errado sai');
  const [, cv] = await P.agir('u', { acao: 'cartao_visao' });
  const dez = (id) => cv.cartoes.find((k) => k.id === id).proximas.find((x) => x.mes === '2026-12').valor;
  assert.equal(dez('kv'), 1000.1); assert.equal(dez('km'), 200.2);
});

test('dono 20/11: fatura de um cartão que não existe cadastra o cartão sozinho', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T19:00:00Z');
  P.deps.perguntarVisao = async () => JSON.stringify({ tipo_documento: 'fatura', instituicao: 'Banco Y', cartao_nome: 'Gold', limite_documento: '8.000,00', total_documento: 300, vencimento_documento: '2026-12-15',
    lancamentos: [{ data: '2026-11-10', descricao: 'Loja', valor: 300, tipo: 'despesa', categoria: 'compras', conta_ou_cartao: 'final 4321' }] });
  const img = 'data:image/png;base64,' + Buffer.from('w'.repeat(200)).toString('base64');
  const [st, r] = await P.agir('u', { acao: 'doc_ler', imagens: [img] });
  delete P.deps.perguntarVisao;
  assert.equal(st, 200, JSON.stringify(r));
  const [, cl] = await P.agir('u', { acao: 'cartao_listar' });
  assert.equal(cl.cartoes.length, 1);
  assert.deepEqual([cl.cartoes[0].dia_vencimento, cl.cartoes[0].limite, cl.cartoes[0].final], [15, 8000, '4321']);
  assert.equal(r.faturas[0].cartao_novo, true);
});
