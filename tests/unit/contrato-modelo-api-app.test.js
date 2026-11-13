'use strict';
// Fábrica F3 (#3649, parte de #3378): regras do modelo "api-app" (Worker grátis + página).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const PASTA = path.join(__dirname, '..', '..', 'modelos-projeto', 'api-app');
const ler = (f) => fs.readFileSync(path.join(PASTA, f), 'utf8');
const usadas = (t) => [...t.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);
const ARQUIVOS = ['worker.js', 'wrangler.toml', 'publico/index.html', 'LEIA-ME.md'];

async function carregarWorker(pasta = PASTA) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'api-app-')), 'worker.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(pasta, 'worker.js'), 'utf8'));
  return import(pathToFileURL(tmp).href);
}

test('MA1. modelo.json é JSON válido com nome, versao e exatamente as 3 variáveis', () => {
  const m = JSON.parse(ler('modelo.json'));
  assert.equal(m.nome, 'api-app');
  assert.match(m.versao, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...m.variaveis].sort(), ['nome', 'slug', 'titulo']);
});

test('MA2. toda {{x}} usada está na lista e toda variável da lista é usada', () => {
  const lista = JSON.parse(ler('modelo.json')).variaveis;
  const todas = ARQUIVOS.flatMap((f) => usadas(ler(f)));
  for (const v of todas) assert.ok(lista.includes(v), `variável fora da lista: ${v}`);
  for (const v of lista) assert.ok(todas.includes(v), `variável sem uso: ${v}`);
});

test('MA3. página com lang pt-BR e viewport; wrangler sem account_id e sem chave', () => {
  const h = ler('publico/index.html');
  assert.match(h, /<html[^>]*lang="pt-BR"/);
  assert.match(h, /<meta[^>]*name="viewport"/);
  const w = ler('wrangler.toml');
  assert.match(w, /main = "worker.js"/);
  assert.doesNotMatch(w, /account_id|api_token|\btoken\b/i);
});

test('MA4. sem nome interno, chave ou senha; LEIA-ME até 5 linhas', () => {
  for (const f of ARQUIVOS.concat('modelo.json')) {
    const t = ler(f).toLowerCase();
    for (const proibido of ['nexia', 'prumo', 'senha', 'password', 'api_key', 'apikey', 'secret', 'chave']) assert.ok(!new RegExp(`\\b${proibido}\\b`).test(t), `${f} contém "${proibido}"`);
  }
  assert.ok(ler('LEIA-ME.md').trim().split('\n').length <= 5);
});

test('MA5. o gerador preenche tudo (inclusive wrangler.toml) sem sobrar {{ }}', () => {
  const { gerar } = require('../../scripts/gerar-de-modelo.js');
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-api-')), 'saida');
  gerar(PASTA, { nome: 'Agenda Teste', titulo: 'Minha agenda', slug: 'agenda-teste' }, destino);
  const tudo = ARQUIVOS.map((f) => fs.readFileSync(path.join(destino, f), 'utf8')).join('\n');
  assert.ok(!/\{\{|\}\}/.test(tudo), 'sobrou {{ }}');
  assert.match(fs.readFileSync(path.join(destino, 'wrangler.toml'), 'utf8'), /name = "agenda-teste"/);
  fs.rmSync(path.dirname(destino), { recursive: true, force: true });
});

test('MA6. Worker: /saude, POST/GET /itens, validação e 404', async () => {
  const w = (await carregarWorker()).default;
  const pedir = (p, o) => w.fetch(new Request('https://x.dev' + p, o), {});
  const s = await (await pedir('/saude')).json();
  assert.equal(s.ok, true); assert.equal(typeof s.nome, 'string');
  assert.equal((await pedir('/itens', { method: 'POST', body: '{"texto":"  "}' })).status, 400);
  assert.equal((await pedir('/itens', { method: 'POST', body: 'não é json' })).status, 400);
  const novo = await pedir('/itens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto: 'Primeiro' }) });
  assert.equal(novo.status, 201);
  const lista = await (await pedir('/itens')).json();
  assert.equal(lista.itens.at(-1).texto, 'Primeiro');
  assert.equal((await pedir('/itens', { method: 'DELETE' })).status, 405);
  assert.equal((await pedir('/nada')).status, 404);
});
