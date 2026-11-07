'use strict';
// Kernex Finance, fase 13: pasta anual e relatório para o contador.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const imp = require('../../netlify/functions/prumo-lib/impostos');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}
const L = (data, descricao, valor, tipo, categoria, extra = {}) => ({ data, descricao, estabelecimento: descricao, valor, tipo, categoria, ...extra });

test('KX1. relatório do ano só tem documentos daquele ano', () => {
  const ls = [L('2025-12-30', 'Antigo', 10, 'despesa', 'outros'), L('2026-03-10', 'Consulta', 300, 'despesa', 'saude'), L('2026-04-01', 'Salário', 5000, 'receita', 'renda'), L('2027-01-02', 'Futuro', 1, 'despesa', 'outros')];
  const r = imp.relatorio(ls, '2026', 'pf');
  assert.equal(r.linhas, 2);
  assert.ok(!r.csv.includes('Antigo') && !r.csv.includes('Futuro'));
  assert.equal(r.resumo.candidatos_dedutiveis.find((c) => c.categoria === 'saude').total, 300);
  assert.match(r.resumo.aviso, /Não transmite declaração/);
});

test('KX2. API: só do próprio usuário; PF e PJ separados; ano inválido recusado', async () => {
  await comBanco(async () => {
    const grava = (u, l) => p.agir(u, { acao: 'doc_confirmar', lancamentos: [l] });
    await grava('u1', { data: '2026-03-10', descricao: 'Consulta u1', valor: 300, tipo: 'despesa', categoria: 'saude' });
    await grava('u1', { data: '2026-03-11', descricao: 'Cliente PJ', valor: 9000, tipo: 'receita', categoria: 'renda', perfil: 'pj' });
    await grava('u2', { data: '2026-03-10', descricao: 'Segredo do u2', valor: 777, tipo: 'despesa', categoria: 'saude' });
    const r = (await p.agir('u1', { acao: 'imp_relatorio', ano: '2026' }))[1];
    assert.ok(!r.csv.includes('u2') && !r.csv.includes('Segredo') && !r.csv.includes('Cliente PJ'));
    assert.equal(r.linhas, 1);
    const pj = (await p.agir('u1', { acao: 'imp_pasta', ano: '2026', perfil: 'pj' }))[1];
    assert.equal(pj.receitas, 9000);
    assert.equal((await p.agir('u1', { acao: 'imp_pasta', ano: '26' }))[0], 400);
    const vazio = (await p.agir('u1', { acao: 'imp_pasta', ano: '2024' }))[1];
    assert.ok(vazio.lacunas.length);
  });
});

test('KX3. CSV: separador ; e proteção contra fórmula em planilha', () => {
  const r = imp.relatorio([L('2026-01-05', '=CMD("x")', 10.5, 'despesa', 'outros'), L('2026-01-06', 'Loja; X', 2, 'despesa', 'outros')], '2026', 'pf');
  const linhas = r.csv.split('\r\n');
  assert.ok(linhas[1].includes("'=CMD"));
  assert.ok(linhas[1].includes('10,5'));
  assert.ok(linhas[2].includes('"Loja; X"'));
});
