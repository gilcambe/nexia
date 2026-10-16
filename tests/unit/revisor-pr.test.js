'use strict';
const test = require('node:test');
const assert = require('node:assert');
const r = require('../../scripts/revisor-pr.js');

const f = (filename, patch = '+ok') => ({ filename, patch });

test('RV1. área sensível, workflow, tamanho e inacabado geram motivos; PR comum não gera', () => {
  assert.deepStrictEqual(r.classificar({ files: [f('src/pages/Historico.tsx')], additions: 40, deletions: 2 }), []);
  assert.ok(r.classificar({ files: [f('netlify/functions/middleware.js')] }).length);
  assert.ok(r.classificar({ files: [f('firestore.rules')] }).length);
  assert.ok(r.classificar({ files: [f('wrangler.jsonc')] }).length);
  assert.ok(r.classificar({ files: [f('.github/workflows/x.yml')] }).some(m => /workflow/i.test(m)));
  assert.ok(r.classificar({ files: [f('src/a.ts')], additions: 2000 }).some(m => /Grande/.test(m)));
  assert.ok(r.classificar({ files: [f('src/a.ts', '+// TODO: depois')] }).some(m => /inacabado/.test(m)));
  assert.ok(r.classificar({ files: [f('tests/a.test.js'), f('src/b.ts')], additions: 3, deletions: 50 }).some(m => /Apaga/.test(m)));
});

test('RV2. texto de modelo não marca ninguém e respeita o tamanho', () => {
  assert.ok(!/@(?!\u200b)/.test(r.limpar('oi @dono @todos')));
  assert.strictEqual(r.limpar('x'.repeat(5000), 100).length, 100);
});

test('RV3. lerVeredito aceita JSON com texto em volta e rejeita o resto', () => {
  assert.strictEqual(r.lerVeredito('```json\n{"veredito":"nao","resumo":"só um modelo genérico","riscos":["a"]}\n```').veredito, 'nao');
  assert.strictEqual(r.lerVeredito('{"veredito":"não"}').veredito, 'nao');
  assert.strictEqual(r.lerVeredito('{"veredito":"talvez"}'), null);
  assert.strictEqual(r.lerVeredito('sem json'), null);
});

function apiFalsa({ prs, files, det, comentarios = [] }) {
  const chamadas = [];
  return {
    chamadas,
    async get(c) { return c.includes('/pulls?') ? prs : det; },
    async paginate(c) { return c.includes('/comments') ? comentarios : files; },
    async post(c, b) { chamadas.push(['POST', c, b]); },
    async del(c) { chamadas.push(['DEL', c]); },
  };
}
const pr = (o = {}) => ({ number: 7, title: 'x', body: 'y', labels: [], head: { ref: 'nexia/abc', sha: 'sha1', repo: { full_name: 'o/r' } }, ...o });

test('RV4. PR sensível ganha rótulo e comentário uma vez só; nunca ganha automerge', async () => {
  const api = apiFalsa({ prs: [pr()], files: [f('.github/workflows/a.yml')], det: { additions: 5, deletions: 0 } });
  const rs = await r.processar(api, { repo: 'o/r', log: () => {} });
  assert.deepStrictEqual(rs, [{ n: 7, acao: 'rotulado' }]);
  const alvo = api.chamadas.map(c => JSON.stringify(c)).join('\n');
  assert.match(alvo, /precisa-dono/);
  assert.doesNotMatch(alvo, /"automerge"/);
  const api2 = apiFalsa({ prs: [pr()], files: [f('.github/workflows/a.yml')], det: { additions: 5, deletions: 0 }, comentarios: [{ body: '<!-- revisor-cortex:sha1 -->' }] });
  assert.deepStrictEqual(await r.processar(api2, { repo: 'o/r', log: () => {} }), [{ n: 7, acao: 'ja-revisado' }]);
  assert.strictEqual(api2.chamadas.length, 0);
});

test('RV5. PR seguro, de fora do repositório ou de outra branch é ignorado', async () => {
  const seguro = apiFalsa({ prs: [pr()], files: [f('src/a.tsx')], det: { additions: 3, deletions: 0 } });
  assert.deepStrictEqual(await r.processar(seguro, { repo: 'o/r', log: () => {} }), []);
  const fork = apiFalsa({ prs: [pr({ head: { ref: 'nexia/a', sha: 's', repo: { full_name: 'outro/r' } } })], files: [f('scripts/a.js')], det: { additions: 1, deletions: 0 } });
  assert.deepStrictEqual(await r.processar(fork, { repo: 'o/r', log: () => {} }), []);
  const outra = apiFalsa({ prs: [pr({ head: { ref: 'main', sha: 's', repo: { full_name: 'o/r' } } })], files: [f('scripts/a.js')], det: { additions: 1, deletions: 0 } });
  assert.deepStrictEqual(await r.processar(outra, { repo: 'o/r', log: () => {} }), []);
});

test('RV6. veto só com REVISOR_VETO ligado e veredito "nao"; tira automerge e põe revisao-manual', async () => {
  const mk = () => apiFalsa({ prs: [pr({ labels: [{ name: 'automerge' }] })], files: [f('scripts/a.js')], det: { additions: 1, deletions: 0 } });
  const nao = async () => ({ veredito: 'nao', resumo: 'modelo genérico', riscos: [] });
  const sem = mk();
  assert.deepStrictEqual(await r.processar(sem, { repo: 'o/r', veto: false, ia: nao, log: () => {} }), [{ n: 7, acao: 'rotulado' }]);
  assert.ok(!sem.chamadas.some(c => c[0] === 'DEL'));
  const com = mk();
  assert.deepStrictEqual(await r.processar(com, { repo: 'o/r', veto: true, ia: nao, log: () => {} }), [{ n: 7, acao: 'veto' }]);
  assert.ok(com.chamadas.some(c => c[0] === 'DEL' && /labels\/automerge$/.test(c[1])));
  assert.ok(com.chamadas.some(c => JSON.stringify(c).includes('revisao-manual')));
  const sim = mk();
  await r.processar(sim, { repo: 'o/r', veto: true, ia: async () => ({ veredito: 'sim', resumo: '', riscos: [] }), log: () => {} });
  assert.ok(!sim.chamadas.some(c => c[0] === 'DEL'));
});
