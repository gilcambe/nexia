'use strict';
// Melhoria 27 do Cortex (17/11/2026): a #3885 passou no teste do contrato (que só lia o TEXTO do arquivo) com
// "const btn" declarado 2 vezes em prumo/app.js: o Finance saiu do ar. Agora o executor roda node --check em todo
// .js mudado; se não compila, desfaz aquela mudança e a IA recebe o erro com a linha.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { aplicar, executar, lerContrato } = require('../../nexia-ai/contrato/executor');

const F = '```';
function cenario() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'sint-'));
  fs.mkdirSync(path.join(raiz, 'src')); fs.mkdirSync(path.join(raiz, 'tests'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), 'const x = 1;\nmodule.exports = x;\n');
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  return raiz;
}
const c = () => lerContrato('Faça\nArquivos: `src/a.js`, `src/b.css`\nTeste: `node --test tests/a.test.js`');

test('aplicar: JS que não compila é desfeito e vira recusa com a linha do erro', () => {
  const raiz = cenario();
  const r = aplicar(`ARQUIVO: src/a.js\n${F}js\nconst btn = 1;\nconst btn = 2;\nmodule.exports = btn;\n${F}`, c(), raiz);
  assert.deepStrictEqual(r.aplicados, []);
  assert.ok(r.recusas.some((x) => /src\/a\.js: erro de sintaxe/.test(x) && /linha \d+/.test(x) && /SyntaxError/.test(x)), r.recusas.join(' | '));
  assert.strictEqual(fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8'), 'const x = 1;\nmodule.exports = x;\n', 'voltou ao que era');
});

test('aplicar: SEARCH/REPLACE que quebra a sintaxe também é desfeito; arquivo novo quebrado é apagado', () => {
  const raiz = cenario();
  const r = aplicar(`src/a.js\n<<<<<<< SEARCH\nconst x = 1;\n=======\nconst x = (1;\n>>>>>>> REPLACE`, c(), raiz);
  assert.deepStrictEqual(r.aplicados, []);
  assert.strictEqual(fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8'), 'const x = 1;\nmodule.exports = x;\n');
  const c2 = lerContrato('Faça\nArquivos: `src/novo.js`\nTeste: `node --test tests/a.test.js`');
  const r2 = aplicar(`ARQUIVO: src/novo.js\n${F}js\nfunction (\n${F}`, c2, raiz);
  assert.deepStrictEqual(r2.aplicados, []);
  assert.strictEqual(fs.existsSync(path.join(raiz, 'src/novo.js')), false, 'arquivo novo que não compila não fica');
});

test('aplicar: JS válido e arquivo que não é JS passam normalmente', () => {
  const raiz = cenario();
  const r = aplicar(`ARQUIVO: src/a.js\n${F}js\nconst y = 2;\nmodule.exports = y;\n${F}\nARQUIVO: src/b.css\n${F}css\n.a{color:red\n${F}`, c(), raiz);
  assert.deepStrictEqual(r.aplicados.sort(), ['src/a.js', 'src/b.css']);
});

test('executar: a IA recebe o erro de sintaxe e acerta na tentativa seguinte', async () => {
  const raiz = cenario();
  const respostas = [`ARQUIVO: src/a.js\n${F}js\nconst btn = 1;\nconst btn = 10;\nmodule.exports = btn;\n${F}`, `ARQUIVO: src/a.js\n${F}js\nmodule.exports = 10;\n${F}`];
  const pedidos = [];
  const router = { chat: async (m, msgs) => { pedidos.push(JSON.stringify(msgs)); return { text: respostas.shift() || '', stop_reason: 'stop' }; } };
  const r = await executar({ contrato: lerContrato('Faça\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`'), raiz, router, memoria: false, porModelo: 2, extrasMax: 0, revisor: false,
    modelos: [{ provider: 'k', model: 'm' }], log: () => {},
    rodarTeste: async () => (/= 10;/.test(fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8')) ? { ok: true, saida: 'ok' } : { ok: false, saida: '✖ x (1ms)\nℹ fail 1', completo: '✖ x (1ms)\nℹ fail 1' }) });
  assert.strictEqual(r.ok, true);
  assert.ok(pedidos.length >= 2);
  assert.match(pedidos[1], /erro de sintaxe/, 'a 2ª chamada leva o erro de sintaxe para a IA');
});
