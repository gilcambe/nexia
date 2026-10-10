// Ferramentas do Body Coach (apps/body-coach/src/lib/ferramentas): conquistas, calculadoras, GPS, ciclo, jejum e lista de compras.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-ferr-'));
  const arquivos = { dietPlan: '../../apps/body-coach/src/lib/dietPlan.ts' };
  for (const n of ['conquistas', 'calculadoras', 'gps', 'ciclo', 'jejum', 'listaCompras', 'frequencia', 'importarAtividade']) arquivos[n] = `../../apps/body-coach/src/lib/ferramentas/${n}.ts`;
  const mods = {};
  for (const [nome, rel] of Object.entries(arquivos)) {
    const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out.replace("from '../dietPlan'", "from './dietPlan.mjs'").replace("from './gps'", "from './gps.mjs'"));
  }
  for (const nome of Object.keys(arquivos)) mods[nome] = await import(pathToFileURL(path.join(dir, `${nome}.mjs`)).href);
  return mods;
}

test('conquistas: treinos, sequência e nível', async () => {
  const { conquistas } = await carregar();
  const agora = new Date(2026, 9, 10, 18);
  const treinos = [];
  for (let i = 0; i < 7; i++) treinos.push({ done_at: new Date(2026, 9, 10 - i, 6).toISOString(), duration_min: 60, volume_kg: 2000, melhores: { Supino: { weight: 100, reps: 3 } }, cardio: [{ km: 1 }] });
  const lista = conquistas.calcularConquistas({ treinos, refeicoes: 12, checkins: 7, avaliacoes: 1, agora });
  const ok = (id) => lista.find((c) => c.id === id).ok;
  assert.ok(ok('t1') && ok('s7') && ok('c100') && ok('v10') && ok('cedo') && ok('k5') && ok('r10') && ok('ck7') && ok('av1'));
  assert.ok(!ok('t10') && !ok('k42'));
  const seq = conquistas.sequencias(treinos.map((t) => new Date(t.done_at)), agora);
  assert.equal(seq.atual, 7);
  assert.equal(seq.maior, 7);
  const nv = conquistas.nivel(lista, 7, 12, 7);
  assert.ok(nv.nivel >= 2 && nv.noNivel < nv.proximo);
  assert.equal(conquistas.diasSemTreinar([new Date(2026, 9, 7, 20)], agora), 3);
  assert.equal(conquistas.diasSemTreinar([], agora), null);
});

test('calculadoras: 1RM, anilhas, zonas e ritmo', async () => {
  const { calculadoras: c } = await carregar();
  assert.equal(c.umRM(100, 1), 100);
  const rm = c.umRM(80, 8);
  assert.ok(rm > 98 && rm < 101, String(rm));
  assert.deepEqual(c.anilhasPorLado(100, 20).lado, [25, 15]);
  assert.deepEqual(c.anilhasPorLado(62.5, 20).lado, [20, 1.25]);
  assert.equal(c.anilhasPorLado(20, 20).lado.length, 0);
  const z = c.zonasFC(40);
  assert.equal(z.length, 5);
  assert.equal(z[4].ate, 180);
  assert.equal(c.ritmo(5, 25), '5:00 /km');
  const prev = c.preverProva(5, 25, 10);
  assert.ok(prev > 50 && prev < 54);
  assert.equal(c.formatarMin(125.5), '2h05min30s');
  const g = c.gastoDiario({ peso: 80, altura: 180, idade: 30, sexo: 'M', atividade: 1.55 });
  assert.equal(g.basal, 1780);
  assert.equal(c.aguaDia(80, 1), 3300);
});

test('GPS: soma o percurso e ignora ruído e saltos', async () => {
  const { gps } = await carregar();
  const t0 = 0;
  const pts = [
    { lat: -23.55, lon: -46.63, t: t0 },
    { lat: -23.551, lon: -46.63, t: t0 + 30000 }, // ~111 m
    { lat: -23.5510001, lon: -46.63, t: t0 + 31000 }, // ruído parado
    { lat: -23.6, lon: -46.63, t: t0 + 32000, acc: 10 }, // salto impossível
    { lat: -23.552, lon: -46.63, t: t0 + 60000, acc: 80 }, // impreciso
    { lat: -23.552, lon: -46.63, t: t0 + 90000 },
  ];
  const km = gps.percurso(pts);
  assert.ok(km > 0.2 && km < 0.24, String(km));
  assert.equal(gps.kcalPercurso(5, 70, 'corrida'), 350);
});

test('ciclo e jejum', async () => {
  const { ciclo, jejum } = await carregar();
  const ini = '2026-10-01';
  assert.equal(ciclo.faseDoCiclo(ini, 28, new Date(2026, 9, 3)).fase, 'menstrual');
  assert.equal(ciclo.faseDoCiclo(ini, 28, new Date(2026, 9, 8)).fase, 'folicular');
  assert.equal(ciclo.faseDoCiclo(ini, 28, new Date(2026, 9, 14)).fase, 'ovulatoria');
  const l = ciclo.faseDoCiclo(ini, 28, new Date(2026, 9, 25));
  assert.equal(l.fase, 'lutea');
  assert.equal(l.proxima.getDate(), 29);
  assert.equal(ciclo.faseDoCiclo(ini, 28, new Date(2026, 9, 30)).dia, 2);
  assert.equal(ciclo.faseDoCiclo('2026-12-01', 28, new Date(2026, 9, 30)), null);
  const p = jejum.progressoJejum({ inicio: 0, horas: 16 }, 8 * 3600000);
  assert.equal(p.pct, 50);
  assert.equal(p.faltaMin, 480);
  assert.equal(jejum.hhmm(485), '8h05');
});

test('lista de compras soma 7 dias do cardápio', async () => {
  const { listaCompras } = await carregar();
  const itens = listaCompras.listaDaSemana({ meals: 4 }, { kcal: 2200, proteina: 150, carbo: 250, gordura: 60 });
  assert.ok(itens.length >= 8, String(itens.length));
  for (const i of itens) assert.ok(/\d/.test(i.total) && i.grupo, JSON.stringify(i));
  const plano = listaCompras.listaDoPlano([{ itens: [{ nome: 'Arroz', qtd: '100 g' }] }, { itens: [{ nome: 'arroz', qtd: '50 g' }, { nome: 'Ovo', qtd: '2 un' }] }]);
  assert.equal(plano.length, 2);
  assert.equal(plano[0].total, '100 g + 50 g');
});

test('frequência cardíaca: leitura Bluetooth, calorias e média', async () => {
  const { frequencia: f } = await carregar();
  const dv8 = new DataView(new Uint8Array([0x00, 150]).buffer);
  const dv16 = new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer);
  assert.equal(f.lerBpm(dv8), 150);
  assert.equal(f.lerBpm(dv16), 300);
  const k = f.kcalPorMinuto(150, 80, 38, 'M');
  assert.ok(k > 13 && k < 16, String(k));
  assert.equal(f.kcalMusculacao(60, 80), 400);
  f.definirPerfilFC({ peso: 80, idade: 38, sexo: 'M' });
  f.zerarSessaoFC();
  for (let i = 0; i <= 60; i++) f.registrarLeitura(i % 2 ? 140 : 160, 1000 * i * 5); // 5 min, leitura a cada 5 s
  const e = f.estadoFC();
  assert.equal(e.maxima, 160);
  assert.ok(e.media >= 149 && e.media <= 151);
  assert.ok(e.kcal > 60 && e.kcal < 80, String(e.kcal));
});

test('importa GPX e TCX do relógio', async () => {
  const { importarAtividade: imp } = await carregar();
  const pts = [0, 1, 2, 3].map((i) => `<trkpt lat="${-23.55 - i * 0.001}" lon="-46.63"><ele>760</ele><time>2026-10-09T10:0${i}:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + i * 5}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).join('');
  const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="Garmin Connect"><trk><name>Corrida matinal</name><type>running</type><trkseg>${pts}</trkseg></trk></gpx>`;
  const a = imp.lerAtividade('treino.gpx', gpx);
  assert.equal(a.tipo, 'Corrida');
  assert.equal(a.minutos, 3);
  assert.ok(a.km > 0.3 && a.km < 0.35, String(a.km));
  assert.equal(a.fcMedia, 148);
  assert.equal(a.fcMaxima, 155);
  const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2026-10-09T07:00:00Z</Id><Lap StartTime="2026-10-09T07:00:00Z"><TotalTimeSeconds>3600</TotalTimeSeconds><DistanceMeters>25000</DistanceMeters><Calories>620</Calories><Track><Trackpoint><DistanceMeters>10</DistanceMeters><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint><Trackpoint><DistanceMeters>25000</DistanceMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const b = imp.lerAtividade('x.tcx', tcx);
  assert.equal(b.tipo, 'Bike');
  assert.equal(b.minutos, 60);
  assert.equal(b.km, 25);
  assert.equal(b.kcal, 620);
  assert.equal(b.fcMedia, 140);
  assert.throws(() => imp.lerAtividade('x.fit', 'binário'));
});
