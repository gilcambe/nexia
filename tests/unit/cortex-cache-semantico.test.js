'use strict';
// #830 (Melhoria C12): cache semântico de respostas e de leitura de arquivos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCache, chave } = require('../../nexia-ai/model-router/cache');
const { createGithubAdapter } = require('../../nexia-ai/github-adapter');

test('C12a. mesma pergunta com espaços/maiúsculas diferentes dá a mesma chave', () => {
  const a = chave({ system: 'Sistema', messages: [{ role: 'user', content: 'Como  estamos?\n' }] });
  const b = chave({ system: 'sistema ', messages: [{ role: 'user', content: 'como estamos?' }] });
  const c = chave({ system: 'sistema', messages: [{ role: 'user', content: 'o que falta?' }] });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('C12b. com arquivo, o cache volta na rodada seguinte e respeita as 24 h', () => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c12-')), 'sub', 'cache.json');
  let t = 1000;
  const c1 = createCache({ arquivo, agora: () => t });
  c1.set('k', { text: 'oi' });
  const c2 = createCache({ arquivo, agora: () => t });
  assert.deepEqual(c2.get('k'), { text: 'oi' });
  t += 25 * 3600e3;
  assert.equal(createCache({ arquivo, agora: () => t }).get('k'), undefined);
  assert.equal(createCache().get('k'), undefined, 'sem arquivo, nada muda (só memória)');
});

test('C12c. leitura repetida do mesmo arquivo usa a memória; escrita limpa', async () => {
  let gets = 0;
  const conteudo = Buffer.from('x').toString('base64');
  const fetchImpl = async (url, init) => {
    if ((init.method || 'GET') === 'GET') gets++;
    return { ok: true, status: 200, json: async () => ({ type: 'file', path: 'a/b.js', sha: 's', size: 1, encoding: 'base64', content: conteudo }) };
  };
  const a = createGithubAdapter({ repo: { owner: 'o', repo: 'r' }, fetchImpl, auth: { mode: 'app', headersFor: async () => ({}) } });
  await a.getFile({ path: 'a/b.js', ref: 'develop' });
  await a.getFile({ path: 'a/b.js', ref: 'develop' });
  assert.equal(gets, 1);
  await a.getFile({ path: 'a/b.js', ref: 'outra' });
  assert.equal(gets, 2, 'outro ref é outra leitura');
});
