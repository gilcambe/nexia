// Onda 2: chat/voz anotam a série no treino ("fiz 12 com 30 kg"), comandos de voz, drop-set/rest-pause e bi-set.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const LIB = path.join(__dirname, '../../apps/body-coach/src/lib');
async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onda2-'));
  for (const f of ['cargasDoTexto', 'serieFalada', 'ouvir']) {
    const src = fs.readFileSync(path.join(LIB, `${f}.ts`), 'utf8').replace(/from '\.\/cargasDoTexto'/, "from './cargasDoTexto.mjs'");
    fs.writeFileSync(path.join(dir, `${f}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  return {
    ...(await import(pathToFileURL(path.join(dir, 'serieFalada.mjs')).href)),
    ...(await import(pathToFileURL(path.join(dir, 'ouvir.mjs')).href)),
  };
}
const NOMES = ['Supino reto com barra', 'Agachamento livre', 'Rosca direta', 'Leg press 45'];

test('lê séries escritas ou faladas', async () => {
  const { lerSeries } = await carregar();
  const casos = {
    'fiz 12 reps com 30 kg': [[12, 30]],
    'fiz 12 com 30': [[12, 30]],
    '30 kg 12 reps': [[12, 30]],
    'doze repetições com trinta quilos': [[12, 30]],
    'vinte e cinco kg 10 reps': [[10, 25]],
    '12,5 kg 15 vezes': [[15, 12.5]],
    '12 com 30 e 10 com 35': [[12, 30], [10, 35]],
    '3 séries de 12 com 30kg': [[12, 30], [12, 30], [12, 30]],
    '4x12: 20/25/30/35': [[12, 20], [12, 25], [12, 30], [12, 35]],
    'fiz 15 repetições': [[15, 0]],
  };
  for (const [frase, esperado] of Object.entries(casos)) {
    const r = lerSeries(frase, NOMES);
    assert.ok(r, frase);
    assert.deepEqual(r.series.map((s) => [s.reps, s.weight]), esperado, frase);
  }
});

test('acha o exercício citado pelo nome principal', async () => {
  const { lerSeries } = await carregar();
  assert.equal(lerSeries('3x10 40kg no supino', NOMES).exercicio, 'Supino reto com barra');
  assert.equal(lerSeries('agachamento 8x60', NOMES).exercicio, 'Agachamento livre');
  assert.equal(lerSeries('leg press 10 com 120', NOMES).exercicio, 'Leg press 45');
  assert.equal(lerSeries('fiz 12 com 30', NOMES).exercicio, null);
});

test('não confunde pergunta, comida, cardio ou conversa com série', async () => {
  const { lerSeries } = await carregar();
  for (const f of ['quantas calorias tem 2 ovos com 100g?', 'comi 200 g de arroz', 'corri 5 km em 30 min', 'bom dia coach', 'posso fazer 3x12?', 'hoje to cansado, dormi 5 horas', 'fiz 2 series', '']) {
    assert.equal(lerSeries(f, NOMES), null, f);
  }
});

test('comandos de voz no treino', async () => {
  const { comandoDaFrase } = await carregar();
  assert.equal(comandoDaFrase('Próximo'), 'proximo');
  assert.equal(comandoDaFrase('pular'), 'pular');
  assert.equal(comandoDaFrase('repete a mesma carga'), 'repetir');
  assert.equal(comandoDaFrase('fiz 12 com 30'), null);
});

test('treino: drop-set/rest-pause, bi-set, voz e chat ligados', () => {
  const pag = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/pages/workout/page.tsx'), 'utf8');
  assert.match(pag, /newSet\.tecnica === 'drop'/);
  assert.match(pag, /startRest\(15\)/);
  assert.match(pag, /exercise\.biset \? session\.exercises\[exIndex \+ 1\]/);
  assert.match(pag, /data-testid="falar-serie"/);
  assert.match(pag, /setTreinoAtivo\(\(series, nome\)/);
  const coach = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/components/feature/CoachContext.tsx'), 'utf8');
  assert.match(coach, /anotarDoTexto\(trimmed, user\?\.id\)/);
});
