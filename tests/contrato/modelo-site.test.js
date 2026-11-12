'use strict';
// Fábrica F3 (#3621, parte de #3378): regras do modelo "site".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..', '..', 'modelos-projeto', 'site');
const ler = (f) => fs.readFileSync(path.join(PASTA, f), 'utf8');
const usadas = (t) => [...t.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);

test('MS1. modelo.json é JSON válido com nome, versao e exatamente as 5 variáveis', () => {
  const m = JSON.parse(ler('modelo.json'));
  assert.equal(m.nome, 'site');
  assert.match(m.versao, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...m.variaveis].sort(), ['cor', 'descricao', 'nome', 'titulo', 'whatsapp']);
});

test('MS2. toda {{x}} usada está na lista e toda variável da lista é usada', () => {
  const lista = JSON.parse(ler('modelo.json')).variaveis;
  const todas = [...usadas(ler('index.html')), ...usadas(ler('estilo.css'))];
  for (const v of todas) assert.ok(lista.includes(v), `variável fora da lista: ${v}`);
  for (const v of lista) assert.ok(todas.includes(v), `variável sem uso: ${v}`);
});

test('MS3. index.html tem lang pt-BR, viewport e link do WhatsApp', () => {
  const h = ler('index.html');
  assert.match(h, /<html[^>]*lang="pt-BR"/);
  assert.match(h, /<meta[^>]*name="viewport"/);
  assert.ok(h.includes('href="https://wa.me/{{whatsapp}}"'));
  assert.ok(h.includes('<title>{{titulo}}</title>'));
});

test('MS4. nenhum arquivo do modelo tem nome interno, chave ou senha', () => {
  for (const f of fs.readdirSync(PASTA)) {
    const t = ler(f).toLowerCase();
    for (const proibido of ['nexia', 'prumo', 'senha', 'password', 'api_key', 'apikey', 'secret']) {
      assert.ok(!t.includes(proibido), `${f} contém "${proibido}"`);
    }
  }
});

test('MS5. o gerador preenche o modelo sem sobrar {{ }}', () => {
  const os = require('os');
  const { gerar } = require('../../scripts/gerar-de-modelo.js');
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-site-')), 'saida');
  gerar(PASTA, { nome: 'Loja Teste', titulo: 'Bem-vindo', descricao: 'Texto', whatsapp: '5581999990000', cor: '#0a7' }, destino);
  const h = fs.readFileSync(path.join(destino, 'index.html'), 'utf8');
  const c = fs.readFileSync(path.join(destino, 'estilo.css'), 'utf8');
  assert.ok(!/\{\{|\}\}/.test(h + c), 'sobrou {{ }} no site gerado');
  assert.ok(h.includes('https://wa.me/5581999990000'));
  assert.ok(c.includes('--cor: #0a7'));
  assert.ok(!fs.existsSync(path.join(destino, 'modelo.json')), 'modelo.json não vai para o cliente');
  fs.rmSync(path.dirname(destino), { recursive: true, force: true });
});