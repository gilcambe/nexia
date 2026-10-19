'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { executar } = require('../../netlify/functions/body-coach-chat.js');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

function fakeDb() {
  const dados = {};
  const lista = (p) => Object.entries(dados[p] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (p) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[p] || {})[id], data: () => (dados[p] || {})[id] }),
      set: async (v, o) => { (dados[p] ||= {})[id] = o && o.merge ? { ...((dados[p] || {})[id] || {}), ...v } : v; },
    }),
    add: async (v) => { const id = `p${Math.random()}`; (dados[p] ||= {})[id] = v; return { id }; },
    where: (c, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(p).filter((d) => d.data()[c] === val) }) }) }),
    orderBy: () => ({ limit: (k) => ({ get: async () => ({ docs: lista(p).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}

test('convite em 2 toques: o dono cria 20% ou 30 dias grátis; o amigo usa uma vez', async () => {
  const db = fakeDb();
  // só o dono cria; e as ações de cupom chegam ao acesso.js pela API do app
  assert.equal((await executar({ acao: 'cupom_convite', tipo: 'pct', valor: 20 }, 'qualquer', db, {}))[0], 403);
  const [st, r] = await executar({ acao: 'cupom_convite', tipo: 'pct', valor: 20 }, 'dono', db, { master: true });
  assert.equal(st, 200);
  assert.match(r.cupom.codigo, /^CV[A-Z0-9]{6}$/);
  assert.equal(r.cupom.pct, 20);
  assert.equal((await executar({ acao: 'cupom_ver', codigo: r.cupom.codigo }, 'amigo', db, {}))[1].pct, 20);

  const [, d] = await executar({ acao: 'cupom_convite', tipo: 'dias', valor: 30 }, 'dono', db, { master: true });
  assert.equal(d.cupom.diasGratis, 30);
  const antes = Date.now();
  const [su, u] = await executar({ acao: 'cupom_usar', codigo: d.cupom.codigo }, 'amigo', db, { email: 'a@x.com' });
  assert.equal(su, 200);
  assert.equal(u.dias, 30);
  // 14 dias do teste + 30 do convite
  assert.ok(db.dados.bc_acesso.amigo.gratisAte >= antes + 43 * 86400000);
  // 1 uso só
  assert.equal((await executar({ acao: 'cupom_usar', codigo: d.cupom.codigo }, 'outro', db, {}))[0], 404);
});

test('telas: opções de convite na Home, link curto /c/CV… e convite entra sozinho depois do login', () => {
  const c = ler('pages/home/components/ConvidarAmigo.tsx');
  assert.match(c, /OPCOES_CONVITE\.map/);
  assert.match(c, /navigator\.share/);
  assert.match(ler('lib/acesso.ts'), /30 dias grátis/);
  assert.match(ler('pages/chat/Convite.tsx'), /cupomNoCaminho/);
  assert.match(ler('components/feature/PortaoAcesso.tsx'), /usarCupomGuardado\(\)/);
});
