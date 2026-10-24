'use strict';
// Cortex travava em tarefas de arquivos grandes (painel do Splash, 160 KB): o get_file mandava o arquivo
// inteiro para a IA grátis, que estourava contexto/cota por minuto, e a tarefa travava em 12 tentativas.
const test = require('node:test');
const assert = require('node:assert');
const { createGithubAdapter, recortar, LEITURA } = require('../../nexia-ai/github-adapter');
const { createFakeGithub } = require('../fake-github');

const GRANDE = Array.from({ length: 3000 }, (_, i) => `linha ${i + 1} ${i === 2400 ? 'function alvoUnico() {}' : 'x'.repeat(20)}`).join('\n');

function setup() {
  const gh = createFakeGithub({ files: { 'README.md': '# nexia\n', 'src/app.js': 'console.log(1);\n', 'sites/grande.html': GRANDE } });
  return { gh, a: createGithubAdapter({ repo: { owner: 'gilcambe', repo: 'nexia', default_branch: 'develop' }, env: gh.env, fetchImpl: gh.fetchImpl }) };
}

test('GRANDE1: arquivo acima de 40 KB vem só o começo, com dica para ler em partes', async () => {
  const { a } = setup();
  assert.ok(Buffer.byteLength(GRANDE) > LEITURA.grande);
  const r = await a.getFile({ path: 'sites/grande.html' });
  assert.strictEqual(r.partial, true);
  assert.strictEqual(r.total_lines, 3000);
  assert.strictEqual(r.end_line, LEITURA.linhasInicio);
  assert.ok(r.content.length < 20000);
  assert.match(r.hint, /edit_files/);
  const p = await a.getFile({ path: 'sites/grande.html', start_line: 2390, end_line: 2410 });
  assert.match(p.content, /alvoUnico/);
  assert.strictEqual(p.content.split('\n').length, 21);
  const longe = await a.getFile({ path: 'sites/grande.html', start_line: 1, end_line: 3000 });
  assert.strictEqual(longe.end_line, LEITURA.maxLinhas, 'no máximo 400 linhas por leitura');
});

test('GRANDE2: busca (find) devolve só os trechos com contexto', async () => {
  const { a } = setup();
  const r = await a.getFile({ path: 'sites/grande.html', find: 'alvoUnico' });
  assert.strictEqual(r.matches.length, 1);
  assert.strictEqual(r.matches[0].line, 2401);
  assert.match(r.matches[0].content, /alvoUnico/);
  assert.strictEqual(r.matches[0].content.split('\n').length, 2 * LEITURA.contexto + 1);
});

test('GRANDE3: arquivo pequeno continua vindo inteiro (nada muda para as tarefas que já funcionam)', async () => {
  const { a } = setup();
  const r = await a.getFile({ path: 'src/app.js' });
  assert.strictEqual(r.content, 'console.log(1);\n');
  assert.strictEqual(r.partial, undefined);
  assert.strictEqual((await a.getFile({ path: 'src/app.js', find: 'console' })).matches.length, 1);
});

test('GRANDE4: arquivo grande lido em partes não pode ser reescrito inteiro (só edit_files)', async () => {
  const { a } = setup();
  await a.createBranch({ branch: 'nexia/grande' });
  await a.getFile({ path: 'sites/grande.html' });
  await assert.rejects(a.commitFiles({ branch: 'nexia/grande', message: 'm', files: [{ path: 'sites/grande.html', content: 'cortado' }] }), /edit_files/);
  const ok = await a.commitFiles({ branch: 'nexia/grande', message: 'm', files: [{ path: 'src/app.js', content: 'console.log(2);\n' }] });
  assert.ok(ok.commit);
});

test('GRANDE5: recortar limita linhas e trata pedido fora do arquivo', () => {
  const r = recortar('a\nb\nc', { start_line: 10 });
  assert.strictEqual(r.total_lines, 3);
  assert.strictEqual(recortar('a\nb\nc', { find: 'zzz' }).matches.length, 0);
});
