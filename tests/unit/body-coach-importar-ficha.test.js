'use strict';
// Importar ficha (Body Coach): a resposta da IA vira FichaCoach válida; lixo vira null, sem lançar erro.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-ficha-'));
  const raiz = path.join(__dirname, '../../apps/body-coach/src/lib/coach');
  const js = src => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  // fichaCoach.ts puxa o app inteiro; para o teste basta o idDoNome verdadeiro (copiado da linha do arquivo).
  const linha = fs.readFileSync(path.join(raiz, 'fichaCoach.ts'), 'utf8').split('\n').find(l => l.startsWith('export const idDoNome'));
  assert.ok(linha, 'idDoNome continua em fichaCoach.ts');
  fs.writeFileSync(path.join(dir, 'fichaCoach.mjs'), js(linha));
  fs.writeFileSync(path.join(dir, 'importarFicha.mjs'), js(fs.readFileSync(path.join(raiz, 'importarFicha.ts'), 'utf8')).replace(/from ['"]\.\/fichaCoach['"]/, "from './fichaCoach.mjs'"));
  return import(pathToFileURL(path.join(dir, 'importarFicha.mjs')).href);
}

test('JSON com cerca e texto em volta vira ficha no formato do app (titulo, reps, grupo, carga em texto)', async () => {
  const { fichaDoJson } = await carregar();
  const ia = 'Aqui está:\n```json\n{"nome":"Hipertrofia","dias":[{"titulo":"Peito","exercicios":[{"nome":"Supino reto","series":4,"reps":"8-10","descanso":90,"carga":"40 kg"},{"nome":"Crucifixo","reps":12}]}]}\n```\nBons treinos!';
  const f = fichaDoJson(ia);
  assert.equal(f.nome, 'Hipertrofia');
  assert.equal(f.obs, '');
  assert.equal(f.dias.length, 1);
  assert.equal(f.dias[0].titulo, 'Peito');
  assert.deepEqual(f.dias[0].exercicios[0], { id: 'livre-supino-reto', nome: 'Supino reto', grupo: '', series: 4, reps: '8-10', descanso: 90, carga: '40 kg', obs: '' });
  assert.equal(f.dias[0].exercicios[1].series, 3);
  assert.equal(f.dias[0].exercicios[1].reps, '12');
  assert.equal(f.dias[0].exercicios[1].descanso, 60);
});

test('limites: 7 dias, 15 exercícios, séries 1-10, descanso 15-600; título padrão por posição', async () => {
  const { fichaDoJson } = await carregar();
  const ex = Array.from({ length: 20 }, (_, i) => ({ nome: `Ex ${i}`, series: 50, descanso: 2 }));
  const dias = Array.from({ length: 9 }, () => ({ exercicios: ex }));
  const f = fichaDoJson(JSON.stringify({ dias }));
  assert.equal(f.nome, 'Ficha importada');
  assert.equal(f.dias.length, 7);
  assert.equal(f.dias[0].exercicios.length, 15);
  assert.equal(f.dias[0].titulo, 'Treino A');
  assert.equal(f.dias[1].titulo, 'Treino B');
  assert.equal(f.dias[0].exercicios[0].series, 10);
  assert.equal(f.dias[0].exercicios[0].descanso, 15);
  assert.equal(fichaDoJson(JSON.stringify({ dias: [{ exercicios: [{ nome: 'X', series: 0, descanso: 9999 }] }] })).dias[0].exercicios[0].descanso, 600);
});

test('sem nome descarta o exercício, dia vazio some, nada útil ou texto qualquer devolve null', async () => {
  const { fichaDoJson } = await carregar();
  const f = fichaDoJson(JSON.stringify({ dias: [{ titulo: 'Vazio', exercicios: [{ series: 3 }] }, { titulo: 'Pernas', exercicios: [{ nome: '' }, { nome: 'Agachamento' }] }] }));
  assert.equal(f.dias.length, 1);
  assert.equal(f.dias[0].titulo, 'Pernas');
  assert.equal(f.dias[0].exercicios.length, 1);
  assert.equal(fichaDoJson('não achei nenhuma ficha'), null);
  assert.equal(fichaDoJson('{"dias":[]}'), null);
  assert.equal(fichaDoJson('{quebrado'), null);
  assert.equal(fichaDoJson(undefined), null);
});
