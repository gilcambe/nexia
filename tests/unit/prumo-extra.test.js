'use strict';
// Prumo Fases 2 a 4 (#2971-#2978): holerite, orçamento, avaliação, consultor, milhas.
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../../netlify/functions/prumo-lib/extra.js');
const p = require('../../netlify/functions/prumo.js');

test('holerite: líquido maior que bruto é recusado; válido é aceito', () => {
  assert.equal(x.validarHolerite({ mes: '2026-10', bruto: 5000, liquido: 6000 }).ok, false);
  const v = x.validarHolerite({ mes: '2026-10', bruto: '7.000,00', liquido: 5200, descontos: [{ nome: 'INSS', valor: 800 }] });
  assert.equal(v.ok, true);
  assert.equal(v.item.bruto, 7000);
});

test('orçamento: sobra e alerta de categoria', () => {
  const orc = x.validarOrcamento({ fixas: [{ nome: 'Aluguel', valor: 2000, dia: 5 }], guardar: [{ objetivo_id: 'o1', valor: 1000 }], limites: { mercado: 1000, cassino: 5 } }).item;
  assert.deepEqual(Object.keys(orc.limites), ['mercado']);
  const r = x.montarOrcamento(5000, orc, { total: 1500, por_categoria: { mercado: 900 } });
  assert.equal(r.sobra, 500);
  assert.deepEqual(r.alertas, [{ categoria: 'mercado', gasto: 900, limite: 1000 }]);
});

test('avaliação: concentração, FGC e prazo curto com ações', () => {
  const ano = new Date().getFullYear();
  const itens = [
    { nome: 'CDB', banco: 'Inter', tipo: 'renda_fixa', valor: 300000 },
    { nome: 'PETR4', banco: 'XP', tipo: 'acoes', valor: 10000, objetivo_id: 'carro' },
  ];
  const r = x.avaliarCarteira(itens, [{ id: 'carro', nome: 'Carro', prazo: `${ano + 1}-01` }], 0);
  const t = r.pontos.map((q) => q.texto).join(' | ');
  assert.match(t, /um só tipo/);
  assert.match(t, /FGC/);
  assert.match(t, /prazo curto/);
  assert.match(r.aviso, /não é recomendação oficial/);
  assert.ok(r.nota < 10);
});

test('consultor: contexto só com números, sem dados pessoais, até 6000 caracteres', () => {
  const carteira = Array.from({ length: 200 }, (_, i) => ({ nome: 'Item ' + i, banco: 'B', tipo: 'outro', valor: i, email: 'a@b.com', cpf: '123' }));
  const c = x.contextoConsultor({ carteira });
  assert.ok(c.length <= 6000);
  assert.doesNotMatch(c, /a@b\.com|cpf/i);
  assert.match(c, /Patrimônio total/);
});

test('pontos: vencendo em 10 dias avisa; em 60 dias não', () => {
  assert.equal(x.validarPontos({ programa: 'Livelo', saldo: 1.5 }).ok, false);
  const itens = [{ id: 'a', programa: 'Livelo', saldo: 10000, validade: '2026-11-12' }, { id: 'b', programa: 'Smiles', saldo: 5000, validade: '2027-01-01' }];
  assert.deepEqual(x.pontosVencendo(itens, '2026-11-02T10:00:00Z').map((q) => q.id), ['a']);
});

test('agir: holerite, orçamento, pontos e consultor ponta a ponta (banco em memória, IA falsa)', async () => {
  const dados = new Map();
  const col = (c) => ({
    doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
  });
  const antes = { ...p.deps };
  let pedido = null;
  Object.assign(p.deps, {
    db: () => ({ collection: col }),
    agora: () => new Date('2026-11-02T12:00:00Z'),
    listFor: () => [{ provider: 'anthropic', model: 'x' }, { provider: 'groq', model: 'g' }],
    getRouter: () => ({ capabilities: () => ({ available: true, vision: true }), chat: async (d, req) => { pedido = req; return { text: 'Sim, subiu.' }; } }),
  });
  try {
    assert.equal((await p.agir('u1', { acao: 'holerite_salvar', mes: '2026-11', bruto: 7000, liquido: 5000 }))[0], 200);
    assert.equal((await p.agir('u1', { acao: 'orcamento_salvar', fixas: [{ nome: 'Aluguel', valor: 2000 }] }))[0], 200);
    const r = await p.agir('u1', { acao: 'orcamento_resumo', mes: '2026-11' });
    assert.equal(r[1].sobra, 3000);
    assert.equal((await p.agir('u1', { acao: 'pontos_salvar', programa: 'Livelo', saldo: 10000, validade: '2026-11-20' }))[0], 200);
    const av = await p.agir('u1', { acao: 'avisos' });
    assert.equal(av[1].avisos[0].tipo, 'pontos');
    const c = await p.agir('u1', { acao: 'consultor', mensagem: 'Meu patrimônio aumentou?' });
    assert.equal(c[0], 200);
    assert.match(c[1].resposta, /Não é recomendação oficial/);
    assert.match(pedido.system, /líquido R\$ 5\.000,00/);
  } finally { Object.assign(p.deps, antes); }
});
