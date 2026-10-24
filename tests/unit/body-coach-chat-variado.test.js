// Chat do Body Coach: respostas variadas e com os dados da pessoa (pedido de 24/10/2026: "as respostas do chat são sempre as mesmas").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-chat-'));
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/respostaLocal.ts'), 'utf8');
  fs.writeFileSync(path.join(dir, 'r.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return import(pathToFileURL(path.join(dir, 'r.mjs')).href);
}

const ANA = { nome: 'Ana', objetivos: ['Perda de gordura', 'Hipertrofia'], sexo: 'F', local: 'Em casa com halteres', treinoHoje: 'A · Pernas e glúteos', prontidao: 80, status: 'pronto', peso: 64.2, kcal: 900, kcalMeta: 1700, proteina: 60, proteinaMeta: 130, hora: 9 };

test('a mesma pergunta 3 vezes nunca recebe a mesma resposta seguida', async () => {
  const { respostaLocal } = await carregar();
  for (const p of ['oi', 'estou cansada', 'quanto posso comer?', 'e o treino de hoje?']) {
    const r = [respostaLocal(p, ANA), respostaLocal(p, ANA), respostaLocal(p, ANA)];
    assert.notEqual(r[0], r[1], p); assert.notEqual(r[1], r[2], p);
  }
});

test('usa o nome, o objetivo, o treino de hoje e os números da pessoa', async () => {
  const { respostaLocal } = await carregar();
  const todas = Array.from({ length: 8 }, () => respostaLocal('treino de hoje', ANA)).join(' ');
  assert.match(todas, /Pernas e glúteos/);
  assert.match(todas, /secar e ganhar músculo/);
  assert.match(Array.from({ length: 4 }, () => respostaLocal('quanto falta de proteina', ANA)).join(' '), /70 g/);
  assert.match(respostaLocal('bom dia', { ...ANA, nome: 'Zé' }), /Zé|E aí|Opa|Fala/);
});

test('servidor: prompt pede personalização por sexo, idade, local e variedade; conversa com temperatura maior', () => {
  const fn = fs.readFileSync(path.join(__dirname, '../../netlify/functions/body-coach-ai.js'), 'utf8');
  assert.match(fn, /Cada pessoa é única: use sexo, idade, objetivos/);
  assert.match(fn, /nunca comece duas respostas do mesmo jeito/);
  assert.match(fn, /temperature: 0\.85/);
  const ctx = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/components/feature/CoachContext.tsx'), 'utf8');
  for (const campo of ['objetivos:', 'sexo:', 'onde_treina:', 'rotina:', 'treino_de_hoje:']) assert.ok(ctx.includes(campo), campo);
});
