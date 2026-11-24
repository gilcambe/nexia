// Onda 3: aviso de platô, semana de pico segura, teste físico do mês e mapa do corpo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const APP = path.join(__dirname, '../../apps/body-coach/src');
async function carregar(rel) {
  const js = ts.transpileModule(fs.readFileSync(path.join(APP, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onda3-'));
  fs.writeFileSync(path.join(dir, 'm.mjs'), js);
  return import(pathToFileURL(path.join(dir, 'm.mjs')).href);
}
const DIA = 86400000;
const t = (diasAtras, kg, reps, agora) => ({ done_at: new Date(agora - diasAtras * DIA).toISOString(), melhores: { Supino: { weight: kg, reps } } });

test('platô: 3+ treinos e 3+ semanas sem melhorar dispara; quem sobe não', async () => {
  const { acharPlatos } = await carregar('lib/plato.ts');
  const agora = Date.parse('2026-11-24T12:00:00Z');
  const parado = [t(40, 60, 8, agora), t(30, 60, 8, agora), t(20, 60, 7, agora), t(10, 57.5, 8, agora), t(3, 60, 8, agora)];
  const p = acharPlatos(parado, agora);
  assert.equal(p.length, 1);
  assert.equal(p[0].exercicio, 'Supino');
  assert.ok(p[0].semanas >= 3);
  assert.ok(p[0].dica.length > 10);
  const subindo = [t(40, 60, 8, agora), t(30, 62.5, 8, agora), t(20, 65, 8, agora), t(10, 67.5, 8, agora), t(3, 70, 8, agora)];
  assert.equal(acharPlatos(subindo, agora).length, 0);
  assert.equal(acharPlatos([], agora).length, 0);
  // parou de treinar há mais de 3 semanas: não incomoda
  assert.equal(acharPlatos(parado.map((x) => ({ ...x, done_at: new Date(Date.parse(x.done_at) - 60 * DIA).toISOString() })), agora).length, 0);
});

test('semana de pico: 8 dias, nunca corta água, carbo sobe nos 2 últimos dias', async () => {
  const { planoSemanaPico, AVISO_PICO } = await carregar('lib/semanaPico.ts');
  const p = planoSemanaPico(new Date('2026-12-20T12:00:00'), 80);
  assert.equal(p.length, 8);
  assert.ok(p.every((d) => d.agua_l === p[0].agua_l && d.agua_l >= 3));
  const c = Object.fromEntries(p.map((d) => [d.dia, d.carbo_g]));
  assert.ok(c[-1] > c[-3] && c[-2] > c[-4]);
  assert.match(AVISO_PICO, /sem diur[eé]tico/);
  assert.doesNotMatch(JSON.stringify(p), /diur[eé]tico|cortar a [aá]gua|jejum/i);
});

test('teste físico: compara com o anterior (tempo de corrida: menor é melhor) e lê min:seg', async () => {
  const { compararTeste, lerTempo, mmss } = await carregar('lib/testeFisico.ts');
  const d = compararTeste({ id: 'b', em: '', valores: { flexoes: 30, corrida: 360 } }, { id: 'a', em: '', valores: { flexoes: 25, corrida: 390 } });
  assert.equal(d.flexoes, 5);
  assert.equal(d.corrida, 30);
  assert.equal(d.prancha, null);
  assert.equal(lerTempo('6:30'), 390);
  assert.equal(lerTempo('45'), 45);
  assert.equal(mmss(390), '6:30');
});

test('mapa do corpo e ferramentas novas estão ligados', () => {
  const evo = fs.readFileSync(path.join(APP, 'pages/evolution/page.tsx'), 'utf8');
  assert.match(evo, /<MapaCorpo series=\{volumeSemana\} \/>/);
  assert.match(evo, /<AvisoPlato uid=/);
  const fer = fs.readFileSync(path.join(APP, 'pages/ferramentas/page.tsx'), 'utf8');
  assert.match(fer, /id: 'teste-fisico'/);
  assert.match(fer, /id: 'semana-pico'/);
});
