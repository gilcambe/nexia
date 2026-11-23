'use strict';
// Contrato #4202 (Body Coach, chat): resposta reserva casa palavra inteira e histórico enviado à IA é limpo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar(nome) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-contrato-'));
  const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
  fs.writeFileSync(path.join(dir, `${nome}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return import(pathToFileURL(path.join(dir, `${nome}.mjs`)).href);
}

const ANA = { nome: 'Ana', objetivos: ['Hipertrofia'], sexo: 'F', local: 'Academia', treinoHoje: 'A', prontidao: 80, status: 'pronto', peso: 64, kcal: 900, kcalMeta: 1700, proteina: 60, proteinaMeta: 130, hora: 9 };
const DOR = /procure um profissional|Dor não é para aguentar/;
const CANSACO = /treino mais leve|dormiu pouco|Só de aparecer|Respeita o corpo/;
const varias = (f, t) => Array.from({ length: 6 }, () => f(t, ANA));

test('dor/lesão só com palavra inteira: "dormi", "adorei", "condor" não viram resposta de dor', async () => {
  const { respostaLocal } = await carregar('respostaLocal');
  for (const t of ['dormi bem hoje', 'adorei o treino de ontem', 'quero dormir cedo', 'eu adoro agachamento', 'vi um condor']) {
    for (const r of varias(respostaLocal, t)) assert.doesNotMatch(r, DOR, t);
  }
  for (const t of ['estou com dor no joelho', 'meu ombro está doendo', 'machuquei o pé', 'acho que tive uma lesão', 'doeu muito ontem', 'tenho dores nas costas']) {
    for (const r of varias(respostaLocal, t)) assert.match(r, DOR, t);
  }
});

test('cansaço/sono só com palavra inteira; "dormi bem" não é cansaço', async () => {
  const { respostaLocal } = await carregar('respostaLocal');
  for (const t of ['estou cansada', 'que sono', 'estou exausto', 'sem energia hoje', 'bateu uma preguiça']) {
    for (const r of varias(respostaLocal, t)) assert.match(r, CANSACO, t);
  }
  for (const t of ['dormi bem hoje', 'dormi 8 horas']) {
    for (const r of varias(respostaLocal, t)) assert.doesNotMatch(r, CANSACO, t);
  }
});

test('historicoParaIA: entrada {id, speaker, text, local}; sai {role user|assistant, content}; ignora saudação, vazio e local', async () => {
  const { historicoParaIA } = await carregar('historicoIA');
  const msgs = [
    { id: 'c-greet', speaker: 'coach', text: 'Olá!' },
    { id: 'u1', speaker: 'user', text: 'fiz 12 com 70' },
    { id: 'c1', speaker: 'coach', text: 'Boa! Sobe 2 kg.' },
    { id: 'c2', speaker: 'coach', text: 'resposta reserva', local: true },
    { id: 'u2', speaker: 'user', text: '   ' },
    { id: 'u3', speaker: 'user', text: 'e agora?' },
  ];
  assert.deepEqual(historicoParaIA(msgs), [
    { role: 'user', content: 'fiz 12 com 70' },
    { role: 'assistant', content: 'Boa! Sobe 2 kg.' },
    { role: 'user', content: 'e agora?' },
  ]);
  const muitas = Array.from({ length: 15 }, (_, i) => ({ id: `u${i}`, speaker: 'user', text: `m${i}` }));
  const r = historicoParaIA(muitas);
  assert.equal(r.length, 10);
  assert.equal(r[0].content, 'm5');
  assert.equal(r[9].content, 'm14');
  assert.deepEqual(historicoParaIA([]), []);
});
