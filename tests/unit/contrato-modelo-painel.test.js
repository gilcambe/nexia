'use strict';
// Fábrica F3 (#3647, parte de #3378): regras do modelo "painel".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASTA = path.join(__dirname, '..', '..', 'modelos-projeto', 'painel');
const ler = (f) => fs.readFileSync(path.join(PASTA, f), 'utf8');
const usadas = (t) => [...t.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);
const ARQUIVOS = ['index.html', 'estilo.css', 'painel.js', 'LEIA-ME.md', 'dados-exemplo.json'];

test('MP1. modelo.json é JSON válido com nome, versao e exatamente as 3 variáveis', () => {
  const m = JSON.parse(ler('modelo.json'));
  assert.equal(m.nome, 'painel');
  assert.match(m.versao, /^\d+\.\d+\.\d+$/);
  assert.deepEqual([...m.variaveis].sort(), ['cor', 'nome', 'titulo']);
});

test('MP2. toda {{x}} usada está na lista e toda variável da lista é usada', () => {
  const lista = JSON.parse(ler('modelo.json')).variaveis;
  const todas = ARQUIVOS.flatMap((f) => usadas(ler(f)));
  for (const v of todas) assert.ok(lista.includes(v), `variável fora da lista: ${v}`);
  for (const v of lista) assert.ok(todas.includes(v), `variável sem uso: ${v}`);
});

test('MP3. index.html tem lang pt-BR, viewport e carrega painel.js e estilo.css', () => {
  const h = ler('index.html');
  assert.match(h, /<html[^>]*lang="pt-BR"/);
  assert.match(h, /<meta[^>]*name="viewport"/);
  assert.ok(h.includes('src="painel.js"') && h.includes('href="estilo.css"'));
});

test('MP4. sem nome interno, chave ou senha; LEIA-ME até 5 linhas; dados de exemplo válidos', () => {
  for (const f of fs.readdirSync(PASTA)) {
    const t = ler(f).toLowerCase();
    for (const proibido of ['nexia', 'prumo', 'senha', 'password', 'api_key', 'apikey', 'secret', 'chave']) assert.ok(!new RegExp(`\\b${proibido}\\b`).test(t), `${f} contém "${proibido}"`);   // palavra inteira ("desenhar" não é senha)
  }
  assert.ok(ler('LEIA-ME.md').trim().split('\n').length <= 5);
  const d = JSON.parse(ler('dados-exemplo.json'));
  assert.ok(d.series.length > 0 && d.series.every((s) => typeof s.rotulo === 'string' && typeof s.valor === 'number'));
});

test('MP5. o gerador preenche o modelo sem sobrar {{ }}', () => {
  const { gerar } = require('../../scripts/gerar-de-modelo.js');
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-painel-')), 'saida');
  gerar(PASTA, { nome: 'Loja Teste', titulo: 'Vendas', cor: '#0a7' }, destino);
  const tudo = ARQUIVOS.map((f) => fs.readFileSync(path.join(destino, f), 'utf8')).join('\n');
  assert.ok(!/\{\{|\}\}/.test(tudo), 'sobrou {{ }}');
  assert.ok(tudo.includes('--cor: #0a7'));
  fs.rmSync(path.dirname(destino), { recursive: true, force: true });
});

test('MP6. desenharBarras: uma barra por item, maior valor = barra mais alta, texto escapado, vazio = aviso', () => {
  const { desenharBarras, resumo } = require('../../modelos-projeto/painel/painel.js');
  const svg = desenharBarras([{ rotulo: 'A', valor: 10 }, { rotulo: '<b>', valor: 40 }, { rotulo: 'C', valor: -5 }]);
  const alturas = [...svg.matchAll(/class="barra"[^>]*height="(\d+)"/g)].map((m) => Number(m[1]));
  assert.equal(alturas.length, 3);
  assert.equal(Math.max(...alturas), alturas[1]); assert.equal(alturas[2], 0);
  assert.ok(svg.includes('&lt;b&gt;') && !svg.includes('<b>'));
  assert.match(desenharBarras([]), /Sem dados/);
  assert.deepEqual(resumo([{ rotulo: 'A', valor: 10 }, { rotulo: 'B', valor: 30 }]), { total: 40, maior: 'B', media: 20 });
});
