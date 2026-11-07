'use strict';
// Kernex Finance, fase 6: Open Finance só com tela e adaptador vazio (nada pago ativo, nunca senha).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('../../netlify/functions/prumo.js');
const of = require('../../netlify/functions/prumo-lib/openfinance');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v && JSON.parse(JSON.stringify(v)) }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = p.deps.db;
  p.deps.db = () => banco;
  try { await fn(banco); } finally { p.deps.db = antes; of.usarProvedor(null); }
}

test('OF1. sem provedor: status diz "em breve" e nenhuma conexão', async () => {
  await comBanco(async () => {
    const [st, r] = await p.agir('u1', { acao: 'openfinance_status' });
    assert.equal(st, 200);
    assert.equal(r.ativo, false);
    assert.equal(r.provedor, null);
    assert.deepEqual(r.conexoes, []);
    assert.match(r.aviso, /Em breve/);
  });
});

test('OF2. conectar sem provedor não contrata nada e manda usar Documentos', async () => {
  await comBanco(async () => {
    const [st, r] = await p.agir('u1', { acao: 'openfinance_conectar' });
    assert.equal(st, 409);
    assert.match(r.error, /Documentos/);
  });
});

test('OF3. senha do banco é sempre recusada', async () => {
  await comBanco(async () => {
    const [st, r] = await p.agir('u1', { acao: 'openfinance_conectar', senha: '1234' });
    assert.equal(st, 400);
    assert.match(r.error, /nunca/);
  });
});

test('OF4. tela Bancos existe, está nas abas e no cache; pesquisa de preços documentada', () => {
  const raiz = path.join(__dirname, '../..');
  assert.match(fs.readFileSync(path.join(raiz, 'prumo/index.html'), 'utf8'), /data-aba="conexoes"/);
  assert.match(fs.readFileSync(path.join(raiz, 'prumo/sw.js'), 'utf8'), /conexoes\.js/);
  assert.doesNotMatch(fs.readFileSync(path.join(raiz, 'prumo/conexoes.js'), 'utf8'), /type="password"/);
  const doc = fs.readFileSync(path.join(raiz, 'docs/kernex-finance-open-finance.md'), 'utf8');
  assert.match(doc, /Pluggy/);
  assert.match(doc, /Fonte/);
});
