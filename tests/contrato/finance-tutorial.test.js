'use strict';
// Contrato (melhorias 5 e 20, dono 19/11): tutorial de 1 minuto com números de exemplo (nada gravado) e aviso de
// "vence em X dias" nas contas a pagar dos próximos 3 dias, no Início.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');

test('tutorial: 4 passos, só exemplo, sem chamar o servidor', () => {
  const s = ler('tutorial.js');
  assert.doesNotMatch(s, /MB\.api\(/, 'não grava nada');
  const window = { MB: {} };
  vm.runInNewContext(s, { window, document: {}, localStorage: { getItem: () => null, setItem() {} } });
  assert.equal(window.MB.tutorial.PASSOS.length, 4);
  assert.match(ler('perfil.js'), /id="kp-tut"/); // redesign: "Como usar" mora no Perfil
  assert.match(ler('sw.js'), /'\/prumo\/tutorial\.js'/);
});
