// Onda 1: histórico com calendário (apagar/corrigir treino), presença ao apagar, mais treinos prontos, atalhos e modo escuro.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const presenca = require('../../netlify/functions/body-coach/presenca');

const APP = path.join(__dirname, '../../apps/body-coach');
async function carregar(rel, extra = '') {
  const src = extra + fs.readFileSync(path.join(APP, rel), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onda1-'));
  const arq = path.join(dir, 'm.mjs');
  fs.writeFileSync(arq, js);
  return import(pathToFileURL(arq).href);
}

test('juntar: banco primeiro, celular só o que falta, mais novo primeiro', async () => {
  const { juntar } = await carregar('src/lib/historicoTreinos.ts');
  const banco = [{ _docId: 'a', id: 'a', title: 'Treino A', done_at: '2026-11-20T10:00:00.000Z' }];
  const cel = [
    { id: 'a', title: 'Treino A', done_at: '2026-11-20T10:00:00.000Z' },
    { title: 'Treino B', done_at: '2026-11-22T10:00:00.000Z' },
  ];
  const l = juntar(banco, cel);
  assert.equal(l.length, 2);
  assert.equal(l[0].title, 'Treino B');
  assert.equal(l[1]._docId, 'a');
});

test('gradeDoMes: começa na segunda e fecha semanas inteiras', async () => {
  const { gradeDoMes } = await carregar('src/lib/historicoTreinos.ts');
  const g = gradeDoMes(2026, 10); // novembro/2026 começa num domingo
  assert.equal(g.length % 7, 0);
  assert.equal(g.slice(0, 6).every((x) => x === null), true);
  assert.equal(g[6], '2026-11-01');
  assert.equal(g.filter(Boolean).length, 30);
});

test('presença: apagar tira o treino mais perto daquela hora com o mesmo título', () => {
  const agora = Date.now();
  const eu = { historico: [{ em: agora, titulo: 'Treino A', min: 50, kcal: 300 }, { em: agora - 86400000, titulo: 'Treino A', min: 40, kcal: 200 }] };
  const r = presenca.apagar(eu, agora + 60000, 'Treino A');
  assert.equal(r.removido.min, 50);
  assert.equal(r.historico.length, 1);
  assert.equal(presenca.apagar(eu, agora, 'Outro').removido, null);
  assert.equal(presenca.apagar({}, agora, 'X').historico.length, 0);
});

test('treinos prontos: mais core e HIIT de esteira, bike, escada, elíptico e remo; ids únicos', async () => {
  const { TREINOS_PRONTOS, duracaoMin } = await carregar('src/lib/ferramentas/treinosProntos.ts');
  const ids = TREINOS_PRONTOS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(TREINOS_PRONTOS.filter((t) => t.categoria === 'Abdômen').length >= 7);
  for (const id of ['esteira-30-30', 'bike-hiit', 'escada-hiit', 'eliptico-hiit', 'remo-hiit', 'hiit-sem-impacto']) assert.ok(ids.includes(id), id);
  for (const t of TREINOS_PRONTOS) { assert.ok(t.blocos.length > 0, t.id); assert.ok(duracaoMin(t) > 0, t.id); }
  const e = TREINOS_PRONTOS.find((t) => t.id === 'esteira-30-30');
  assert.equal(e.blocos.filter((b) => b.nome.startsWith('TIRO')).length, 12);
});

test('atalhos no ícone e botão de modo escuro existem', () => {
  const m = JSON.parse(fs.readFileSync(path.join(APP, 'public/manifest.webmanifest'), 'utf8'));
  assert.ok(m.shortcuts.length >= 3);
  assert.ok(m.shortcuts.every((s) => s.url.startsWith('/body-coach/')));
  const perfil = fs.readFileSync(path.join(APP, 'src/pages/profile/page.tsx'), 'utf8');
  assert.match(perfil, /<ModoEscuro \/>/);
  assert.match(fs.readFileSync(path.join(APP, 'src/main.tsx'), 'utf8'), /aplicarTema\(\)/);
});
