const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-recupe-'));
  const srcEx = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/exerciseDb.ts'), 'utf8');
  const outEx = ts.transpileModule(srcEx, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(dir, 'exerciseDb.mjs'), outEx);

  const srcRec = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/recuperacao.ts'), 'utf8');
  const outRec = ts.transpileModule(srcRec, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from '\.\/exerciseDb'/g, "from './exerciseDb.mjs'");
  fs.writeFileSync(path.join(dir, 'recuperacao.mjs'), outRec);

  return await import(pathToFileURL(path.join(dir, 'recuperacao.mjs')).href);
}

test('sem treinos recentes deve retornar 100 para todos os grupos', async () => {
  const { calcularRecuperacao } = await carregar();
  const rec = calcularRecuperacao([]);
  for (const val of Object.values(rec)) {
    assert.equal(val, 100);
  }
});

test('treino acabado de fazer deve reduzir pontos proporcionalmente às séries', async () => {
  const { calcularRecuperacao } = await carregar();
  const agora = new Date('2026-03-30T10:00:00Z');
  const treinos = [
    {
      done_at: '2026-03-30T10:00:00Z',
      series_por_grupo: { peito: 4, triceps: 3 }
    }
  ];

  const rec = calcularRecuperacao(treinos, agora);
  // 4 series de peito * 8 = 32% de desgaste => 68% de recuperacao
  assert.equal(rec.peito, 68);
  // 3 series de triceps * 8 = 24% de desgaste => 76% de recuperacao
  assert.equal(rec.triceps, 76);
  // Outros grupos sem treino recente ficam 100%
  assert.equal(rec.costas, 100);
  assert.equal(rec.quadriceps, 100);
});

test('após decorridas várias horas, a recuperação deve evoluir (~2%/h)', async () => {
  const { calcularRecuperacao } = await carregar();
  const dataTreino = new Date('2026-03-30T10:00:00Z');
  const agora10hDepois = new Date('2026-03-30T20:00:00Z');

  const treinos = [
    {
      done_at: dataTreino.toISOString(),
      series_por_grupo: { biceps: 5 } // 5 * 8 = 40% desgaste inicial => 60%
    }
  ];

  const recImediata = calcularRecuperacao(treinos, dataTreino);
  assert.equal(recImediata.biceps, 60);

  // Biceps é pequeno: ganha ~2.25%/h. Em 10h ganha +22.5% de recuperacao
  // Desgaste restante: 40 - 22.5 = 17.5 => ~83% recuperado
  const rec10h = calcularRecuperacao(treinos, agora10hDepois);
  assert.equal(rec10h.biceps, 83);
});

test('statusRecuperacao classifica corretamente em verde/amarelo/vermelho', async () => {
  const { statusRecuperacao } = await carregar();
  const s100 = statusRecuperacao(100);
  assert.equal(s100.estado, 'descansado');
  assert.equal(s100.corBg, 'bg-emerald-500');

  const s65 = statusRecuperacao(65);
  assert.equal(s65.estado, 'moderado');
  assert.equal(s65.corBg, 'bg-amber-500');

  const s30 = statusRecuperacao(30);
  assert.equal(s30.estado, 'fatigado');
  assert.equal(s30.corBg, 'bg-rose-500');
});

test('extrairSeriesPorGrupo trata objetos e campos ausentes adequadamente', async () => {
  const { extrairSeriesPorGrupo } = await carregar();
  const res = extrairSeriesPorGrupo({ series_por_grupo: { ombros: 4, abdomen: 2 } });
  assert.deepEqual(res, { ombros: 4, abdomen: 2 });
});
