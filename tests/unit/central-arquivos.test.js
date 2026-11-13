'use strict';
// C2-F3 (PC 2, 13/11): arquivos da empresa só em C:\KERNEX; o agente manda o índice e abre só o que está lá dentro.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMaquinas, caminhoOk } = require('../../nexia-ai/maquinas');

function driverMemoria() {
  const docs = new Map();
  return {
    docs,
    async get(paths) { const m = new Map(); for (const p of paths) if (docs.has(p)) m.set(p, JSON.parse(JSON.stringify(docs.get(p)))); return m; },
    async list(_parent, col) { return [...docs.entries()].filter(([p]) => p.startsWith(col + '/') && p.split('/').length === 2).map(([path, d]) => ({ path, ...d })); },
    async apply(ops) { for (const o of ops) docs.set(o.path, { fields: o.fields, create_time: o.create_time }); },
  };
}

test('AR1. só caminho relativo dentro de C:\\KERNEX (sem "..", sem unidade, sem barra no começo)', () => {
  for (const c of ['Clientes\\Joao\\logo.png', 'Marketing/post 1.jpg', 'a..b.txt']) assert.ok(caminhoOk(c), c);
  for (const c of ['..\\Windows\\x', 'Clientes\\..\\..\\x', 'C:\\Windows\\x', '\\\\pc\\x', '/etc/passwd', 'a\u0000b', '', null]) assert.ok(!caminhoOk(c), String(c));
});

test('AR2. índice guarda só nome/tamanho/data (máx. 2000) e descarta caminho perigoso', async () => {
  const d = driverMemoria();
  const m = createMaquinas({ env: {}, driver: d });
  const r = await m.salvarArquivos('PC2', { arquivos: [{ c: 'Clientes\\Joao\\logo.png', t: 1200, m: '2026-11-13T06:00:00Z', conteudo: 'segredo' }, { c: '..\\x', t: 1 }] });
  assert.equal(r.arquivos, 1);
  const { maquinas } = await m.lerArquivos();
  assert.equal(maquinas[0].maquina, 'PC2');
  assert.deepEqual(maquinas[0].itens, [{ c: 'Clientes\\Joao\\logo.png', t: 1200, m: '2026-11-13T06:00:00Z' }]);
  assert.equal(maquinas[0].total, 2);
});

test('AR3. pedido de abrir vai para a fila da máquina certa, sai 1 vez só e recusa caminho fora', async () => {
  const m = createMaquinas({ env: {}, driver: driverMemoria() });
  assert.ok((await m.pedirAbrir('PC1', 'Clientes\\Joao\\contrato.pdf')).ok);
  assert.match((await m.pedirAbrir('PC1', 'C:\\Windows\\system32\\cmd.exe')).erro, /KERNEX/);
  assert.match((await m.pedirAbrir('../x', 'a.txt')).erro, /máquina/);
  assert.deepEqual(await m.pegarAbrir('PC2'), []);
  assert.deepEqual(await m.pegarAbrir('PC1'), ['Clientes\\Joao\\contrato.pdf']);
  assert.deepEqual(await m.pegarAbrir('PC1'), [], 'não abre duas vezes');
});

test('AR4. agente: cria C:\\KERNEX, só lista lá dentro, confere o caminho final e só MOSTRA (não executa)', () => {
  const ps = fs.readFileSync(path.join(__dirname, '../../tools/agente-maquina/agente.ps1'), 'utf8');
  assert.match(ps, /'C:\\KERNEX'/);
  assert.match(ps, /'Clientes', 'Projetos', 'Marketing', 'Documentos-Kernex'/);
  assert.match(ps, /GetFullPath\(\(Join-Path \$raizK \$c\)\)/);
  assert.match(ps, /StartsWith\(\$raizK, \[StringComparison\]::OrdinalIgnoreCase\)/);
  assert.match(ps, /explorer\.exe' -ArgumentList "\/select,/);
  assert.doesNotMatch(ps, /Start-Process -FilePath \$cheio/);
  const casca = fs.readFileSync(path.join(__dirname, '../../src/pages/central/kernex/Casca.tsx'), 'utf8');
  assert.match(casca, /tela === "arquivos" \? <Arquivos \/>/);
});
