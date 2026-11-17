'use strict';
// Contrato: "Limpar e refazer a carteira" também na aba INVESTIR (dono 17/11: "não mostra o limpar a carteira, pois os
// valores estão errados"). O botão existe só na tela Carteira (14ª aba, escondida); quem vê os valores errados está em
// Investir. Pronto quando prumo/investimentos.js mostra, no cartão "Seus ativos", o botão #limpar-carteira (só com
// ativos), que pede confirmação escrevendo LIMPAR (igual à Carteira), chama carteira_limpar e recarrega a aba.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const js = fs.readFileSync(path.join(__dirname, '../../prumo/investimentos.js'), 'utf8');

test('Investir tem o botão "Limpar e refazer a carteira" (#limpar-carteira), só quando há ativos', () => {
  assert.match(js, /id="limpar-carteira"/, 'crie <button id="limpar-carteira"> no cartão "Seus ativos"');
  assert.match(js, /Limpar e refazer a carteira/);
  assert.match(js, /v\.itens\.length\s*\?[\s\S]{0,4000}id="limpar-carteira"/, 'o botão só aparece quando há ativos (dentro do v.itens.length ? ...)');
});

test('pede confirmação escrevendo LIMPAR, chama carteira_limpar e recarrega a aba', () => {
  const i = js.indexOf("'#limpar-carteira'") >= 0 ? js.indexOf("'#limpar-carteira'") : js.indexOf('"#limpar-carteira"');
  assert.ok(i > 0, "ligue o clique com el.querySelector('#limpar-carteira')");
  const trecho = js.slice(i, i + 900);
  assert.match(trecho, /prompt\(/, 'pergunte com prompt(...) e só siga se a pessoa escrever LIMPAR');
  assert.match(trecho, /toUpperCase\(\)\s*!==\s*'LIMPAR'|!==\s*'LIMPAR'/);
  assert.match(trecho, /MB\.api\(\s*'carteira_limpar'\s*,\s*\{\s*confirmar:\s*'LIMPAR'\s*\}\s*\)/);
  assert.match(trecho, /MB\.telas\.investimentos\(el\)|render\(|recarregar\(/, 'depois de limpar, mostre a aba de novo');
});
