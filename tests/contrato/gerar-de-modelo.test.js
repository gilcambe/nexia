'use strict';
// Contrato #3620 (Fábrica F3): scripts/gerar-de-modelo.js. Um teste por regra da issue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { preencher, gerar } = require('../../scripts/gerar-de-modelo');

const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));
function modelo() {
  const m = tmp('gm-modelo-');
  fs.writeFileSync(path.join(m, 'modelo.json'), JSON.stringify({ nome: 't', versao: '1.0.0', variaveis: ['nome', 'cor'] }));
  fs.writeFileSync(path.join(m, 'index.html'), '<h1>{{nome}}</h1><p>{{nome}}</p>');
  fs.mkdirSync(path.join(m, 'css'));
  fs.writeFileSync(path.join(m, 'css', 'estilo.css'), 'a{color:{{cor}}}');
  fs.writeFileSync(path.join(m, 'logo.png'), Buffer.from([0x89, 0x50, 0x7b, 0x7b, 0x6e, 0x7d, 0x7d]));
  fs.writeFileSync(path.join(m, '.env'), 'SEGREDO=1');
  fs.writeFileSync(path.join(m, '.env.local'), 'SEGREDO=2');
  return m;
}
const V = { nome: 'Clínica Sorriso', cor: '#0a7' };

test('R1. preencher troca todas as ocorrências', () => {
  assert.equal(preencher('Olá {{nome}}', { nome: 'Ana' }), 'Olá Ana');
  assert.equal(preencher('{{nome}} e {{nome}}', { nome: 'Ana' }), 'Ana e Ana');
});

test('R2. variável sem valor: erro "faltou:" com todas, separadas por vírgula', () => {
  assert.throws(() => preencher('{{nome}} {{cidade}} {{nome}}', {}), { message: 'faltou: nome, cidade' });
});

test('R3. valor extra não usado é ignorado', () => {
  assert.equal(preencher('{{nome}}', { nome: 'A', sobra: 'x' }), 'A');
});

test('R4. gerar lê modelo.json e cobra as variáveis da lista', () => {
  assert.throws(() => gerar(modelo(), { nome: 'A' }, path.join(tmp('gm-d-'), 'novo')), { message: 'faltou: cor' });
});

test('R5. gerar copia com subpastas, preenche só texto e copia o resto igual', () => {
  const m = modelo(), d = path.join(tmp('gm-d-'), 'novo');
  gerar(m, V, d);
  assert.equal(fs.readFileSync(path.join(d, 'index.html'), 'utf8'), '<h1>Clínica Sorriso</h1><p>Clínica Sorriso</p>');
  assert.equal(fs.readFileSync(path.join(d, 'css', 'estilo.css'), 'utf8'), 'a{color:#0a7}');
  assert.deepEqual(fs.readFileSync(path.join(d, 'logo.png')), fs.readFileSync(path.join(m, 'logo.png')));
});

test('R6. não copia modelo.json nem .env*, e recusa destino ocupado', () => {
  const m = modelo(), d = path.join(tmp('gm-d-'), 'novo');
  gerar(m, V, d);
  for (const n of ['modelo.json', '.env', '.env.local']) assert.equal(fs.existsSync(path.join(d, n)), false, n);
  const ocupado = tmp('gm-ocupado-');
  fs.writeFileSync(path.join(ocupado, 'x.txt'), 'x');
  assert.throws(() => gerar(m, V, ocupado), { message: 'destino ocupado' });
  const vazio = tmp('gm-vazio-');
  assert.doesNotThrow(() => gerar(m, V, vazio));
});

test('R7. roda pela linha de comando', () => {
  const m = modelo(), d = path.join(tmp('gm-d-'), 'novo'), v = path.join(tmp('gm-v-'), 'v.json');
  fs.writeFileSync(v, JSON.stringify(V));
  const saida = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/gerar-de-modelo.js'), m, v, d], { encoding: 'utf8' });
  assert.match(saida, /Pronto: 3 arquivo/);
  assert.equal(fs.existsSync(path.join(d, 'index.html')), true);
});
