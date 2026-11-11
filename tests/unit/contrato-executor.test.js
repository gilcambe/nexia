'use strict';
// Executor de contrato: o teste decide. IA falsa simula os erros reais medidos (nada gravado, trecho errado, arquivo proibido).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { lerContrato, executar } = require('../../nexia-ai/contrato/executor');

function repo() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-contrato-'));
  fs.mkdirSync(path.join(raiz, 'lib'));
  fs.mkdirSync(path.join(raiz, 'tests'));
  fs.writeFileSync(path.join(raiz, 'lib', 'soma.js'), "'use strict';\nmodule.exports = (a, b) => a - b;\n");
  fs.writeFileSync(path.join(raiz, 'tests', 'soma.test.js'), "const t=require('node:test');const a=require('node:assert');const s=require('../lib/soma');t('soma',()=>a.equal(s(2,3),5));\n");
  return raiz;
}
// Dentro do node --test o filho herda NODE_TEST_CONTEXT e sempre sai 0: limpa.
const semContexto = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
const rodar = raiz => async cmd => {
  try { execFileSync(process.execPath, cmd.split(' ').slice(1), { cwd: raiz, stdio: 'pipe', timeout: 60000, env: semContexto() }); return { ok: true, saida: '' }; }
  catch (e) { return { ok: false, saida: String(e.stdout || '') + String(e.stderr || '') }; }
};
const CORPO = 'Corrigir a soma.\n\nArquivos: `lib/soma.js`\nTeste: `node --test tests/soma.test.js`\n';
const roteiro = respostas => { const vistos = []; return { vistos, chat: async (m, req) => { vistos.push({ m: m.model, u: req.messages[0].content }); const r = respostas.shift(); if (r instanceof Error) throw r; return { text: r || '' }; } }; };
const M = [{ provider: 'gratis', model: 'a' }, { provider: 'gratis', model: 'b' }];
const CERTO = 'ARQUIVO: lib/soma.js\n<<<<<<< SEARCH\na - b\n=======\na + b\n>>>>>>> REPLACE\n';

test('CT1. contrato: lê arquivos e teste; recusa sem teste, shell livre e teste editável pela IA', () => {
  const c = lerContrato(CORPO);
  assert.deepEqual([c.ok, c.arquivos, c.teste, c.testes], [true, ['lib/soma.js'], 'node --test tests/soma.test.js', ['tests/soma.test.js']]);
  assert.match(c.pedido, /Corrigir a soma/);
  assert.equal(lerContrato('Faça X.\nArquivos: `a.js`').ok, false);
  assert.equal(lerContrato('Arquivos: `a.js`\nTeste: `node --test x.test.js; rm -rf /`').ok, false);
  assert.equal(lerContrato('Arquivos: `a.js`, `t/x.test.js`\nTeste: `node --test t/x.test.js`').ok, false);
});

test('CT2. erro real "nada gravado": a IA recebe o motivo e, na 2ª tentativa, o teste passa', async () => {
  const raiz = repo();
  const r = roteiro(['Vou analisar o arquivo primeiro.', CERTO]);
  const out = await executar({ contrato: lerContrato(CORPO), raiz, router: r, modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(out.ok, true);
  assert.equal(out.tentativas, 2);
  assert.deepEqual(out.arquivos, ['lib/soma.js']);
  assert.match(r.vistos[1].u, /Nenhuma mudança aplicada/);
  assert.match(fs.readFileSync(path.join(raiz, 'lib', 'soma.js'), 'utf8'), /a \+ b/);
});

test('CT3. arquivo proibido e trecho errado são recusados; IA que falha sobe de degrau (outra IA começa do zero)', async () => {
  const raiz = repo();
  const r = roteiro([
    'ARQUIVO: tests/soma.test.js\n```js\nrequire("node:test")("x",()=>{});\n```\n',     // tenta "passar" mexendo no teste
    'ARQUIVO: lib/soma.js\n<<<<<<< SEARCH\nnão existe\n=======\nx\n>>>>>>> REPLACE\n',
    CERTO,
  ]);
  const out = await executar({ contrato: lerContrato(CORPO), raiz, router: r, modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(out.ok, true);
  assert.equal(out.modelo, 'gratis/b');
  assert.match(r.vistos[1].u, /fora dos arquivos permitidos/);
  assert.match(fs.readFileSync(path.join(raiz, 'tests', 'soma.test.js'), 'utf8'), /s\(2,3\),5/, 'o teste não foi alterado');
});

test('CT4. sem nenhuma IA acertando: falha honesta e os arquivos voltam ao original', async () => {
  const raiz = repo();
  const errado = 'ARQUIVO: lib/soma.js\n<<<<<<< SEARCH\na - b\n=======\na * b\n>>>>>>> REPLACE\n';
  const out = await executar({ contrato: lerContrato(CORPO), raiz, router: roteiro([errado, errado, new Error('429 sem cota')]), modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(out.ok, false);
  assert.match(out.motivo, /nenhuma IA/);
  assert.match(fs.readFileSync(path.join(raiz, 'lib', 'soma.js'), 'utf8'), /a - b/);
});

test('CT5. teste que já passa antes não prova nada: contrato recusado sem gastar IA', async () => {
  const raiz = repo();
  fs.writeFileSync(path.join(raiz, 'lib', 'soma.js'), 'module.exports = (a, b) => a + b;\n');
  const r = roteiro([CERTO]);
  const out = await executar({ contrato: lerContrato(CORPO), raiz, router: r, modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(out.ok, false);
  assert.match(out.motivo, /já passa/);
  assert.equal(r.vistos.length, 0);
});

test('CT6. todas as IAs sem resposta (429/402): resultado é "sem cota", não falha da tarefa', async () => {
  const raiz = repo();
  const out = await executar({ contrato: lerContrato(CORPO), raiz, router: roteiro([new Error('groq 429'), new Error('google 429')]), modelos: M, rodarTeste: rodar(raiz) });
  assert.equal(out.ok, false);
  assert.equal(out.sem_cota, true);
  assert.match(out.motivo, /sem cota/);
});
