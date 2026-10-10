// Ferramentas do Body Coach, lote 2: periodização, carga, treinos prontos, o que comer, contador por câmera, retrospectiva, saúde e loja.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-ferr2-'));
  const arqs = { dietPlan: '../../apps/body-coach/src/lib/dietPlan.ts', cargaSugerida: '../../apps/body-coach/src/lib/cargaSugerida.ts' };
  for (const n of ['calculadoras', 'conquistas', 'periodizacao', 'historicoCarga', 'treinosProntos', 'oQueComer', 'contadorReps', 'retrospectiva', 'dicas', 'loja']) arqs[n] = `../../apps/body-coach/src/lib/ferramentas/${n}.ts`;
  for (const [nome, rel] of Object.entries(arqs)) {
    const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    let out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    out = out.replace(/from '\.\.\/dietPlan'/g, "from './dietPlan.mjs'").replace(/from '\.\/(\w+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out);
  }
  const m = {};
  for (const nome of Object.keys(arqs)) m[nome] = await import(pathToFileURL(path.join(dir, `${nome}.mjs`)).href);
  return m;
}

test('periodização: blocos de 3 semanas + descarga', async () => {
  const { periodizacao: p } = await carregar();
  const s = p.montarPeriodizacao('hipertrofia', 12);
  assert.equal(s.length, 12);
  assert.deepEqual(s.filter((x) => x.deload).map((x) => x.semana), [4, 8, 12]);
  assert.equal(s[0].fase, 'Adaptação');
  assert.notEqual(s[8].fase, s[0].fase);
  assert.equal(p.montarPeriodizacao('forca', 5).length, 4);
  assert.equal(p.semanaAtual('2026-10-01', new Date(2026, 9, 16)), 3);
  assert.equal(p.objetivoDoPerfil('Perder gordura'), 'emagrecimento');
});

test('histórico de carga por exercício e volume semanal', async () => {
  const { historicoCarga: h } = await carregar();
  const t = [
    { done_at: '2026-09-01T10:00:00Z', volume_kg: 3000, melhores: { Supino: { weight: 60, reps: 10 }, Remada: { weight: 50, reps: 10 } } },
    { done_at: '2026-09-08T10:00:00Z', volume_kg: 3200, melhores: { Supino: { weight: 70, reps: 8 } } },
    { done_at: '2026-09-15T10:00:00Z', volume_kg: 3400, melhores: { Supino: { weight: 65, reps: 10 } } },
  ];
  const l = h.historicoPorExercicio(t);
  assert.equal(l[0].nome, 'Supino');
  assert.equal(l[0].sessoes, 3);
  assert.equal(l[0].recorde.carga, 70);
  assert.ok(l[0].variacaoPct > 0);
  const v = h.volumeSemanal(t, 8, new Date('2026-09-20T12:00:00Z'));
  assert.equal(v.length, 8);
  assert.equal(v.reduce((s, x) => s + x.kg, 0), 9600);
});

test('treinos prontos têm blocos válidos e planos de corrida terminam em prova', async () => {
  const { treinosProntos: t } = await carregar();
  assert.ok(t.TREINOS_PRONTOS.length >= 12);
  for (const tr of t.TREINOS_PRONTOS) {
    assert.ok(tr.blocos.length > 3 && tr.blocos.every((b) => b.seg > 0 && b.nome), tr.id);
    assert.ok(t.duracaoMin(tr) >= 3 && t.duracaoMin(tr) <= 40, `${tr.id} ${t.duracaoMin(tr)} min`);
  }
  assert.equal(new Set(t.TREINOS_PRONTOS.map((x) => x.id)).size, t.TREINOS_PRONTOS.length);
  for (const c of t.CATEGORIAS_PRONTOS) assert.ok(t.TREINOS_PRONTOS.some((x) => x.categoria === c), c);
  const tab = t.TREINOS_PRONTOS.find((x) => x.id === 'tabata');
  assert.equal(tab.blocos.filter((b) => b.seg === 20).length, 8);
  for (const p of t.PLANOS_CORRIDA) assert.match(p.semanas[p.semanas.length - 1].treinos[2], /PROVA/);
  assert.equal(t.kcalTreinoPronto(tab, 80, 3600), 720);
});

test('o que comer agora respeita o que falta', async () => {
  const { oQueComer: o } = await carregar();
  const s = o.sugerirRefeicao({ kcal: 600, p: 40, c: 60, g: 15 }, {}, [], 13);
  assert.ok(s.length >= 1);
  for (const x of s) assert.ok(x.kcal <= 720 && x.p >= 15, JSON.stringify(x));
  assert.equal(o.sugerirRefeicao({ kcal: 50, p: 5, c: 0, g: 0 }).length, 0);
  const veg = o.sugerirRefeicao({ kcal: 600, p: 40, c: 60, g: 15 }, { restrictions: ['Vegetariano'] }, [], 13);
  assert.ok(veg.every((x) => !x.itens.some((a) => ['frango', 'patinho', 'alcatra', 'peixe', 'atum', 'sardinha'].includes(a.id))), JSON.stringify(veg.map((x) => x.itens.map((a) => a.id))));
});

test('contador por câmera: ângulo, repetição completa e curta', async () => {
  const { contadorReps: c } = await carregar();
  assert.equal(Math.round(c.angulo({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
  const ex = c.EXERCICIOS_CAMERA.find((e) => e.id === 'agachamento');
  let e = c.estadoInicial();
  for (const a of [175, 150, 120, 95, 90, 120, 165, 175]) e = c.passo(e, a, ex);
  assert.equal(e.reps, 1);
  for (const a of [150, 130, 125, 150, 170]) e = c.passo(e, a, ex);
  assert.equal(e.reps, 1);
  assert.equal(e.parciais, 1);
  assert.match(e.aviso, /Amplitude/);
  for (const a of [140, 99, 170]) e = c.passo(e, a, ex);
  assert.equal(e.reps, 2);
});

test('retrospectiva do mês', async () => {
  const { retrospectiva: r } = await carregar();
  const t = [
    { done_at: '2026-08-20T10:00:00Z', duration_min: 60, melhores: { Supino: { weight: 60, reps: 8 } } },
    { done_at: '2026-09-02T10:00:00Z', duration_min: 60, volume_kg: 3000, kcal: 300, melhores: { Supino: { weight: 70, reps: 6 } } },
    { done_at: '2026-09-03T10:00:00Z', duration_min: 30, volume_kg: 1000, cardio: [{ km: 5 }], melhores: { Supino: { weight: 65, reps: 8 } } },
  ];
  const x = r.retrospectiva(t, 2026, 8);
  assert.equal(x.treinos, 2);
  assert.equal(x.horas, 1.5);
  assert.equal(x.kg, 4000);
  assert.equal(x.km, 5);
  assert.deepEqual(x.recordes, ['Supino: 70 kg']);
  assert.equal(x.maiorSequencia, 2);
  assert.equal(x.comparacao, 100);
  assert.equal(x.kcal, 480);
});

test('saúde: pressão, glicemia e dica do dia; loja recomenda pelo perfil', async () => {
  const { dicas: d, loja: l } = await carregar();
  assert.equal(d.classificarPressao(120, 80).nome, 'Normal');
  assert.match(d.classificarPressao(145, 85).nome, /estágio 1/);
  assert.match(d.classificarPressao(185, 100).nome, /estágio 3/);
  assert.equal(d.classificarGlicemia(110, true).nome, 'Alterada (pré-diabetes)');
  assert.equal(d.classificarGlicemia(130, false).nome, 'Normal');
  assert.ok(d.DICAS.length >= 30 && d.dicaDoDia(new Date(2026, 0, 1)).titulo);
  const rec = l.recomendados({ objetivo: 'Hipertrofia', modalidades: ['Corrida'], marcadoresBaixos: ['vitamina_d'], suplementos: ['Creatina'] });
  assert.ok(rec.some((p) => p.id === 'whey') && rec.some((p) => p.id === 'vitd'));
  assert.ok(!rec.some((p) => p.id === 'creatina'));
  assert.match(l.linkAmazon('whey protein'), /^https:\/\/www\.amazon\.com\.br\/s\?k=whey\+protein$/);
  assert.match(l.linkMercadoLivre('whey protein'), /lista\.mercadolivre\.com\.br\/whey-protein$/);
});
