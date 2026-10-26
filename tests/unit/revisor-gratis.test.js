'use strict';
const test = require('node:test');
const assert = require('node:assert');
const r = require('../../scripts/revisor-gratis.js');

const pr = (o = {}) => ({ number: 1, title: 'NEXIA: x', body: 'Fecha #1850', base: { ref: 'develop' }, head: { ref: 'nexia/x', sha: 'abc', repo: { full_name: 'gilcambe/nexia' } }, labels: [], additions: 10, ...o });

test('REVISOR1: escolhe só PR nexia/ para develop, sem automerge, sem recusa e sem demo', () => {
  const lista = [pr({ number: 1 }), pr({ number: 2, labels: [{ name: 'automerge' }] }), pr({ number: 3, labels: [{ name: 'revisor-recusou' }] }),
    pr({ number: 4, head: { ref: 'claude/x', sha: 'a', repo: { full_name: 'gilcambe/nexia' } } }), pr({ number: 5, title: 'demo' }),
    pr({ number: 6, head: { ref: 'nexia/y', sha: 'a', repo: { full_name: 'outro/fork' } } }), pr({ number: 7, labels: [{ name: 'revisao-manual' }] })];
  assert.deepStrictEqual(r.escolher(lista).map(p => p.number), [1, 7]);
});

test('REVISOR2: CI verde exige o job principal e tudo concluído', () => {
  assert.ok(r.ciVerde([{ name: 'Typecheck, testes e build', status: 'completed', conclusion: 'success' }, { name: 'gitleaks', status: 'completed', conclusion: 'success' }]));
  assert.ok(!r.ciVerde([{ name: 'gitleaks', status: 'completed', conclusion: 'success' }]));
  assert.ok(!r.ciVerde([{ name: 'Typecheck, testes e build', status: 'completed', conclusion: 'failure' }]));
  assert.ok(!r.ciVerde([{ name: 'Typecheck, testes e build', status: 'in_progress' }]));
});

test('REVISOR3: barreiras objetivas (workflow, regras, segredo, tamanho) recusam sem gastar IA', () => {
  assert.match(r.barreira([{ filename: '.github/workflows/x.yml' }], pr()), /\.github/);
  assert.match(r.barreira([{ filename: 'firestore.rules' }], pr()), /firestore/);
  assert.match(r.barreira([{ filename: 'lib/a.js' }], pr({ additions: 5000 })), /grande/);
  assert.match(r.barreira([{ filename: 'lib/auth.js' }], pr()), /auth/);
  assert.match(r.barreira([{ filename: 'cloudflare/worker.js' }], pr()), /worker/);
  assert.match(r.barreira([{ filename: 'lib/a.js' }], pr({ additions: 401 })), /grande/);
  assert.strictEqual(r.barreira([{ filename: 'scripts/a.js' }, { filename: 'cloudflare/b.js' }], pr()), null);
});

test('REVISOR4: veredito JSON e decisão com 2 provedores', () => {
  const v = r.lerVeredito('ok {"aprovar": true, "nota": 9, "motivo": "certo", "problemas": []} fim');
  assert.deepStrictEqual(v, { aprovar: true, nota: 9, motivo: 'certo', problemas: [] });
  assert.strictEqual(r.lerVeredito('sem json'), null);
  const a = (provider, nota = 9, aprovar = true) => ({ provider, nota, aprovar, motivo: '', problemas: [] });
  assert.strictEqual(r.decidir([a('groq'), a('gemini')]).acao, 'aprovar');
  assert.strictEqual(r.decidir([a('groq', 10)]).acao, 'esperar');
  assert.strictEqual(r.decidir([a('groq'), a('groq')]).acao, 'esperar');
  assert.strictEqual(r.decidir([a('groq', 8)]).acao, 'esperar');
  assert.strictEqual(r.decidir([a('groq'), a('gemini', 5)]).acao, 'recusar');
  assert.strictEqual(r.decidir([a('groq', 9, false)]).acao, 'recusar');
  assert.strictEqual(r.decidir([null, null]).acao, 'esperar');
});

test('REVISOR5: issue do PR e diff cortado no limite', () => {
  assert.strictEqual(r.issueDoPr(pr()), 1850);
  assert.strictEqual(r.issueDoPr(pr({ body: 'Cópia literal do pedido #1831' })), 1831);
  const grande = Array.from({ length: 30 }, (_, i) => ({ filename: `f${i}.js`, status: 'modified', additions: 1, deletions: 0, patch: 'x'.repeat(3000) }));
  const d = r.montarDiff(grande);
  assert.ok(d.length < 50000 && /cortado/.test(d));
});
