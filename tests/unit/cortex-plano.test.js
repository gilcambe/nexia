'use strict';
// Planejador do Cortex: pedido grande vira plano de partes pequenas que rodam juntas (decisões puras, sem rede).
const test = require('node:test');
const assert = require('node:assert');
const P = require('../../scripts/cortex-plano');
const { decidir, planejarComIA } = require('../../scripts/cortex-fila');

const AGORA = Date.parse('2026-10-25T18:00:00Z');
const parte = (n, meta, labels = []) => ({
  number: n, title: `[Parte ${meta.k}/${meta.n || 3} de #${meta.pai}] x`, author_association: 'CONTRIBUTOR', user: { login: 'github-actions[bot]' },
  updated_at: '2026-10-25T17:59:00Z', body: P.corpoDaParte({ tarefa: 'faça a parte '.repeat(5), arquivos: meta.arquivos, depende: meta.depende || [], pronto: 'teste passando bem' }, meta.k, meta.n || 3, meta.pai, [{ arquivos: ['src/a.ts'] }]),
  labels: ['cortex-fila', 'cortex-parte', ...labels].map(name => ({ name })),
});

test('PL1. classifica: pequeno, grande por texto+arquivos e grande por arquivo enorme', () => {
  assert.equal(P.classificar({ corpo: 'Troque o texto do botão em `apps/a/b.tsx`.' }).tamanho, 'pequeno');
  const muitos = 'Crie uma tela nova completa. ' + ['a', 'b', 'c', 'd', 'e', 'f'].map(x => `src/${x}.ts`).join(' ');
  assert.equal(P.classificar({ corpo: muitos }).tamanho, 'grande');
  const r = P.classificar({ corpo: 'Crie um painel novo em `sites/splash/painel.html`.', tamanhos: { 'sites/splash/painel.html': 160000 } });
  assert.equal(r.tamanho, 'grande');
  assert.match(r.motivos.join(' '), /arquivo grande/);
});

test('PL2. valida o plano: dependência só para trás, mesmo arquivo vira dependência, recusa parte sem critério', () => {
  const ok = P.validarPlano([
    { titulo: 'a', tarefa: 'x'.repeat(40), arquivos: ['src/a.ts'], depende: [], pronto: 'teste a passa' },
    { titulo: 'b', tarefa: 'y'.repeat(40), arquivos: ['src/b.ts'], depende: [], pronto: 'teste b passa' },
    { titulo: 'c', tarefa: 'z'.repeat(40), arquivos: ['src/a.ts'], depende: [], pronto: 'teste c passa' },
  ]);
  assert.deepEqual(ok.map(p => p.depende), [[], [], [1]]);
  assert.equal(P.validarPlano([{ tarefa: 'x'.repeat(40), arquivos: ['a/b.js'], depende: [2], pronto: 'pronto ok ok' }, { tarefa: 'y'.repeat(40), arquivos: ['a/c.js'], depende: [], pronto: 'pronto ok ok' }]), null, 'depende de parte futura');
  assert.equal(P.validarPlano([{ tarefa: 'x'.repeat(40), arquivos: ['a/b.js'], depende: [] }, { tarefa: 'y'.repeat(40), arquivos: ['a/c.js'], depende: [], pronto: 'pronto ok ok' }]), null, 'sem critério de pronto');
});

test('PL3. partes independentes saem JUNTAS; a dependente espera; mesmo arquivo nunca roda junto', () => {
  const a = parte(101, { pai: 100, k: 1, arquivos: ['src/a.ts'] });
  const b = parte(102, { pai: 100, k: 2, arquivos: ['src/b.ts'] });
  const c = parte(103, { pai: 100, k: 3, arquivos: ['src/c.ts'], depende: [1] });
  const r = decidir({ issues: [a, b, c], runs: [], agora: AGORA });
  assert.deepEqual(r.map(x => [x.tipo, x.numero, x.pista]), [['despachar', 101, 1], ['despachar', 102, 2]]);
  assert.doesNotMatch(r[0].tarefa, /cortex-plano/, 'o cabeçalho do plano não vai para a IA');
  // Parte 1 concluída (saiu da fila), mas o PR dela ainda está aberto: a 3 espera o PR entrar.
  const prs = [{ arquivos: ['src/a.ts'], criadoEm: '2026-10-25T17:30:00Z' }];
  assert.deepEqual(decidir({ issues: [c], runs: [], agora: AGORA, prs }).length, 0);
  assert.deepEqual(decidir({ issues: [c], runs: [], agora: AGORA }).map(x => x.numero), [103]);
  // PR esquecido há mais de 1 h não segura a fila para sempre.
  assert.deepEqual(decidir({ issues: [c], runs: [], agora: AGORA, prs: [{ arquivos: ['src/a.ts'], criadoEm: '2026-10-25T10:00:00Z' }] }).map(x => x.numero), [103]);
  const outra = parte(201, { pai: 200, k: 1, arquivos: ['src/a.ts'] }, ['cortex-rodando', 'pista-1']);
  assert.deepEqual(decidir({ issues: [outra, a], runs: [{ id: 1, name: 'Cortex #201', status: 'in_progress', created_at: '2026-10-25T17:50:00Z' }], agora: AGORA }).length, 0);
});

test('PL4. parte grande vai ao Jules (não ocupa pista); sem resposta rápida volta ao Cortex', () => {
  assert.equal(P.vaiParaJules({ grande: false, arquivos: ['s/p.html'] }, { 's/p.html': 100000 }), true);
  const j = parte(301, { pai: 300, k: 1, arquivos: ['s/p.html'] }, ['cortex-jules']);
  assert.deepEqual(decidir({ issues: [j], runs: [], agora: AGORA }), []);
  assert.deepEqual(decidir({ issues: [{ ...j, updated_at: '2026-10-25T14:00:00Z' }], runs: [], agora: AGORA }).map(x => x.tipo), ['jules-volta']);
});

test('PL5. revisão do PR da parte e placar de tempo', () => {
  const meta = P.lerPlano(parte(1, { pai: 9, k: 1, arquivos: ['src/a.ts'] }).body);
  assert.deepEqual(P.revisarDiff(meta, [{ filename: 'src/a.ts', additions: 20, deletions: 2 }, { filename: 'tests/unit/a.test.js', additions: 10 }]), []);
  assert.match(P.revisarDiff(meta, [{ filename: 'src/a.ts', additions: 5 }, { filename: 'server.js', additions: 1 }]).join(), /fora do plano: server\.js/);
  assert.match(P.revisarDiff(meta, [{ filename: 'src/a.ts', additions: 900 }]).join(), /linhas/);
  const t = P.medirTempo('2026-10-25T10:00:00Z', [
    { number: 1, created_at: '2026-10-25T10:00:00Z', closed_at: '2026-10-25T10:30:00Z' },
    { number: 2, created_at: '2026-10-25T10:00:00Z', closed_at: '2026-10-25T10:40:00Z' },
  ]);
  assert.deepEqual([t.totalMin, t.somaMin, t.pico], [40, 70, 2]);
});

test('PL6. planejador: IA boa vira plano; todas falham = plano simples por arquivo (nunca trava)', async () => {
  const boa = JSON.stringify([
    { titulo: 'a', tarefa: 'x'.repeat(40), arquivos: ['src/a.ts'], depende: [], pronto: 'teste a passa' },
    { titulo: 'b', tarefa: 'y'.repeat(40), arquivos: ['src/b.ts'], depende: [1], pronto: 'teste b passa' },
  ]);
  const ia = text => ({ capabilities: () => ({ available: true }), chat: async () => ({ text }) });
  assert.match((await planejarComIA('t', ia(boa), [{ model: 'm' }])).origem, /plano da IA/);
  const r = await planejarComIA('Mude `src/a.ts`, `src/b.ts` e `src/c.ts`.', ia('sem json'), [{}]);
  assert.equal(r.partes.length, 3);
  assert.ok(r.partes.every(p => !p.depende.length), 'plano simples roda tudo junto');
  assert.equal(await planejarComIA('pedido sem arquivo', ia('nada'), [{}]), null);
});

test('PL7. teste real #1538: rascunho da própria parte não a segura; falha de parte leva corpo para conferir entrega', () => {
  const a = parte(401, { pai: 400, k: 1, arquivos: ['docs/cortex/jules.md'] }, ['tentativa-3']);
  const prs = [{ arquivos: ['docs/cortex/jules.md'], criadoEm: '2026-10-25T17:30:00Z' }];
  assert.deepEqual(decidir({ issues: [a], runs: [], agora: AGORA, prs }).map(x => x.numero), [401]);
  const rodando = parte(402, { pai: 400, k: 2, arquivos: ['docs/cortex/x.md'] }, ['cortex-rodando', 'pista-1', 'tentativa-1']);
  const [r] = decidir({ issues: [rodando], runs: [{ id: 9, name: 'Cortex #402', status: 'completed', conclusion: 'failure' }], agora: AGORA });
  assert.deepEqual([r.tipo, r.parte, /docs\/cortex\/x\.md/.test(r.corpo)], ['reenfileirar', true, true]);
});
