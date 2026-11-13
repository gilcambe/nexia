'use strict';
// Fábrica F3 (#3650, parte de #3378): regras do modelo "hostinger-php" (site PHP sem banco).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASTA = path.join(__dirname, '..', '..', 'modelos-projeto', 'hostinger-php');
const ler = (f) => fs.readFileSync(path.join(PASTA, f), 'utf8');
const usadas = (t) => [...t.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);
const ARQUIVOS = ['index.php', 'topo.php', 'rodape.php', 'contato.php', 'estilo.css', '.htaccess', 'LEIA-ME.md'];

test('MH1. todos os arquivos do pedido existem; variáveis exatas', () => {
  for (const f of ARQUIVOS.concat('modelo.json')) assert.ok(fs.existsSync(path.join(PASTA, f)), `falta ${f}`);
  assert.deepEqual([...JSON.parse(ler('modelo.json')).variaveis].sort(), ['cor', 'nome', 'titulo', 'whatsapp']);
});

test('MH2. toda {{x}} usada está na lista e toda variável da lista é usada', () => {
  const lista = JSON.parse(ler('modelo.json')).variaveis;
  const todas = ARQUIVOS.flatMap((f) => usadas(ler(f)));
  for (const v of todas) assert.ok(lista.includes(v), `variável fora da lista: ${v}`);
  for (const v of lista) assert.ok(todas.includes(v), `variável sem uso: ${v}`);
});

test('MH3. topo com lang pt-BR e viewport; páginas incluem topo e rodapé; saída escapada', () => {
  const t = ler('topo.php');
  assert.match(t, /<html[^>]*lang="pt-BR"/);
  assert.match(t, /<meta[^>]*name="viewport"/);
  for (const p of ['index.php', 'contato.php']) {
    assert.match(ler(p), /include __DIR__ \. '\/topo\.php'/);
    assert.match(ler(p), /include __DIR__ \. '\/rodape\.php'/);
  }
  const c = ler('contato.php');
  assert.match(c, /htmlspecialchars/);
  assert.doesNotMatch(c, /mysqli|PDO|fopen|file_put_contents|mail\(/, 'contato não grava nem envia nada');
  assert.doesNotMatch(c, /echo \$_(POST|GET)/, 'nunca imprime entrada sem escapar');
});

test('MH4. sem nome interno, chave ou senha; LEIA-ME até 5 linhas', () => {
  for (const f of ARQUIVOS.concat('modelo.json')) {
    const t = ler(f).toLowerCase();
    for (const proibido of ['nexia', 'prumo', 'senha', 'password', 'api_key', 'apikey', 'secret', 'chave']) assert.ok(!new RegExp(`\\b${proibido}\\b`).test(t), `${f} contém "${proibido}"`);
  }
  assert.ok(ler('LEIA-ME.md').trim().split('\n').length <= 5);
});

test('MH5. o gerador preenche tudo sem sobrar {{ }} e leva o .htaccess', () => {
  const { gerar } = require('../../scripts/gerar-de-modelo.js');
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-php-')), 'saida');
  gerar(PASTA, { nome: 'Pousada Teste', titulo: 'Pousada à beira-mar', whatsapp: '5581999990000', cor: '#0a7' }, destino);
  const tudo = ARQUIVOS.map((f) => fs.readFileSync(path.join(destino, f), 'utf8')).join('\n');
  assert.ok(!/\{\{|\}\}/.test(tudo), 'sobrou {{ }}');
  assert.ok(tudo.includes('https://wa.me/5581999990000'));
  assert.ok(!fs.existsSync(path.join(destino, 'modelo.json')));
  fs.rmSync(path.dirname(destino), { recursive: true, force: true });
});

test('MH6. .htaccess nega modelo.json e .env e desliga listagem de pastas', () => {
  const h = ler('.htaccess');
  assert.match(h, /Options -Indexes/);
  const m = h.match(/<FilesMatch "([^"]+)">\s*Require all denied/);
  assert.ok(m, 'bloco FilesMatch com Require all denied');
  const re = new RegExp(m[1]);
  for (const f of ['modelo.json', '.env', '.env.local']) assert.ok(re.test(f), `${f} deveria ser bloqueado`);
  for (const f of ['index.php', 'estilo.css']) assert.ok(!re.test(f), `${f} não pode ser bloqueado`);
});
