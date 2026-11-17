'use strict';
// Privacidade (17/11): toda coleção NOVA do usuário tem que entrar em COLECOES (prumo-lib/ajuda.js), senão
// "exportar/apagar meus dados" deixa dados para trás. Achado na integração: pagamentos, folhas_ponto, viagens, robos e
// robos_disparos estavam fora. E 'pontos' é das MILHAS: a folha de ponto do salário usa 'folhas_ponto'.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { COLECOES } = require('../../netlify/functions/prumo-lib/ajuda');

// Coleções globais (não são do usuário) ficam de fora.
const GLOBAIS = new Set(['prumo_users', 'cotacoes', 'prumo_familias', 'convites', 'prumo_convites']);

test('toda coleção usada pelo Finance está no apagar/exportar meus dados', () => {
  const dir = path.join(__dirname, '../../netlify/functions/prumo-lib');
  const arquivos = [...fs.readdirSync(dir).map((f) => path.join(dir, f)), path.join(__dirname, '../../netlify/functions/prumo.js')];
  const usadas = new Set();
  for (const f of arquivos) for (const m of fs.readFileSync(f, 'utf8').matchAll(/collection\('([a-z_]+)'\)/g)) usadas.add(m[1]);
  const faltam = [...usadas].filter((c) => !GLOBAIS.has(c) && !COLECOES.includes(c));
  assert.deepEqual(faltam, [], `coloque em COLECOES (prumo-lib/ajuda.js): ${faltam.join(', ')}`);
});

test('folha de ponto do salário não grava na coleção das milhas', () => {
  const s = fs.readFileSync(path.join(__dirname, '../../netlify/functions/prumo-lib/salario.js'), 'utf8');
  assert.doesNotMatch(s, /collection\('pontos'\)/);
  assert.match(s, /collection\('folhas_ponto'\)/);
});
