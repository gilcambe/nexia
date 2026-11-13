'use strict';
// Fábrica F3 (#3648, parte de #3378): regras do modelo "crud".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASTA = path.join(__dirname, '..', '..', 'modelos-projeto', 'crud');
const ler = (f) => fs.readFileSync(path.join(PASTA, f), 'utf8');
const usadas = (t) => [...t.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);
const ARQUIVOS = ['index.html', 'estilo.css', 'crud.js', 'LEIA-ME.md'];

test('MC1. modelo.json é JSON válido com nome, versao e exatamente as 4 variáveis', () => {
  const m = JSON.parse(ler('modelo.json'));
  assert.equal(m.nome, 'crud');
  assert.match(m.versao, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...m.variaveis].sort(), ['campos', 'cor', 'nome', 'titulo']);
});

test('MC2. toda {{x}} usada está na lista e toda variável da lista é usada', () => {
  const lista = JSON.parse(ler('modelo.json')).variaveis;
  const todas = ARQUIVOS.flatMap((f) => usadas(ler(f)));
  for (const v of todas) assert.ok(lista.includes(v), `variável fora da lista: ${v}`);
  for (const v of lista) assert.ok(todas.includes(v), `variável sem uso: ${v}`);
});

test('MC3. index.html tem lang pt-BR, viewport, título e carrega crud.js e estilo.css', () => {
  const h = ler('index.html');
  assert.match(h, /<html[^>]*lang="pt-BR"/);
  assert.match(h, /<meta[^>]*name="viewport"/);
  assert.ok(h.includes('<title>{{titulo}}</title>'));
  assert.ok(h.includes('data-campos="{{campos}}"'));
  assert.ok(h.includes('src="crud.js"') && h.includes('href="estilo.css"'));
});

test('MC4. nenhum arquivo do modelo tem nome interno, chave ou senha; LEIA-ME com até 5 linhas; acentos corretos', () => {
  for (const f of fs.readdirSync(PASTA)) {
    const t = ler(f).toLowerCase();
    for (const proibido of ['nexia', 'prumo', 'senha', 'password', 'api_key', 'apikey', 'secret', 'chave']) assert.ok(!t.includes(proibido), `${f} contém "${proibido}"`);
    assert.ok(!/Ã.|Â/.test(ler(f)), `${f} tem acento quebrado`);
  }
  assert.ok(ler('LEIA-ME.md').trim().split('\n').length <= 5);
  assert.ok(ler('estilo.css').split('\n').length < 400);
});

test('MC5. o gerador preenche o modelo sem sobrar {{ }}', () => {
  const { gerar } = require('../../scripts/gerar-de-modelo.js');
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-crud-')), 'saida');
  gerar(PASTA, { nome: 'Clínica Sorriso', titulo: 'Pacientes', campos: 'nome, telefone, email', cor: '#0a7' }, destino);
  const tudo = ARQUIVOS.map((f) => fs.readFileSync(path.join(destino, f), 'utf8')).join('\n');
  assert.ok(!/\{\{|\}\}/.test(tudo), 'sobrou {{ }}');
  assert.ok(tudo.includes('data-campos="nome, telefone, email"'));
  assert.ok(tudo.includes('--cor: #0a7'));
  assert.ok(!fs.existsSync(path.join(destino, 'modelo.json')), 'modelo.json não vai para o cliente');
  fs.rmSync(path.dirname(destino), { recursive: true, force: true });
});

test('MC6. validarRegistro recusa registro sem campo obrigatório e aceita o completo', () => {
  const { validarRegistro, lerCampos } = require('../../modelos-projeto/crud/crud.js');
  const campos = lerCampos(' nome, telefone,, nome ');
  assert.deepEqual(campos, ['nome', 'telefone']);
  assert.deepEqual(validarRegistro({ nome: 'Ana', telefone: ' ' }, campos), { ok: false, faltam: ['telefone'] });
  assert.deepEqual(validarRegistro(null, campos).faltam, ['nome', 'telefone']);
  assert.deepEqual(validarRegistro({ nome: 'Ana', telefone: '81999990000' }, campos), { ok: true, faltam: [] });
});
