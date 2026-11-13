'use strict';
// #3532: "Refazer carteira a partir destes prints", aviso "não bate com o print" (> R$ 1) e escolha de banco.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const p = require('../../netlify/functions/prumo.js');
const { conferirTotais } = require('../../prumo/carteira.js');

function bancoFalso() {
  const dados = new Map(); let n = 0;
  const col = (nome) => ({
    doc: (id) => ({ set: async (v) => { dados.set(`${nome}/${id}`, { ...v }); }, delete: async () => { dados.delete(`${nome}/${id}`); }, collection: (c) => col(`${nome}/${id}/${c}`), get: async () => ({ exists: dados.has(`${nome}/${id}`), data: () => dados.get(`${nome}/${id}`) }) }),
    add: async (v) => { const id = 'x' + (++n); dados.set(`${nome}/${id}`, { ...v }); return { id }; },
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(nome + '/') && !k.slice(nome.length + 1).includes('/')).map(([k, v]) => ({ id: k.slice(nome.length + 1), data: () => v })) }),
    where: () => col(nome), orderBy: () => col(nome), limit: () => col(nome),
  });
  return { collection: col };
}

test('RP1. so_print apaga só o que veio de print; o digitado à mão fica', async () => {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-13T12:00:00Z');
  try {
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'Poupança', tipo: 'renda_fixa', valor: 100, origem: 'mao' });
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'Tesouro', tipo: 'renda_fixa', valor: 50 }); // antigo, sem origem e sem ticker: fica
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'CDB LIQUIDEZ DIARIA', tipo: 'renda_fixa', valor: 900, origem: 'print' });
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'MXRF11', ticker: 'MXRF11', tipo: 'fiis', valor: 30, quantidade: 3 }); // antigo de print
    const r = await p.agir('u1', { acao: 'carteira_limpar', confirmar: 'LIMPAR', so_print: true });
    assert.equal(r[0], 200); assert.equal(r[1].apagados, 2);
    const ficou = (await p.agir('u1', { acao: 'carteira_listar' }))[1].itens.map((i) => i.nome).sort();
    assert.deepEqual(ficou, ['Poupança', 'Tesouro']);
    assert.equal((await p.agir('u1', { acao: 'carteira_listar' }))[1].itens.find((i) => i.nome === 'Poupança').origem, 'mao');
  } finally { Object.assign(p.deps, antes); }
});

test('RP2. diferença maior que R$ 1 = não bate; até R$ 1 = confere', () => {
  const a = conferirTotais([{ total_print: 1000, itens: 1 }], [{ valor: 998.5 }], [false]);
  assert.equal(a[0].confere, false); assert.equal(a[0].diferenca, -1.5);
  const b = conferirTotais([{ total_print: 1000, itens: 1 }], [{ valor: 999.2 }], [false]);
  assert.equal(b[0].confere, true);
});

test('RP3. tela tem botão Refazer, aviso vermelho e escolha de banco', () => {
  const s = fs.readFileSync(path.join(__dirname, '../../prumo/carteira.js'), 'utf8');
  assert.match(s, /Refazer carteira a partir destes prints/);
  assert.match(s, /so_print: true/);
  assert.match(s, /Não bate com o print/);
  assert.match(s, /#ec7063/);
  assert.match(s, /aplicar-banco/);
  assert.match(s, /origem: 'print'/);
});
