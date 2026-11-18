'use strict';
// 17/11, celular do dono: "Não consegui abrir este PDF" sem motivo. A mensagem agora diz o porquê, e o cabeçalho é lido
// ANTES do pdf.js (ele leva o buffer para o worker e o deixa vazio).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const s = fs.readFileSync(path.join(__dirname, '../../prumo/pdf.js'), 'utf8');

test('PDF que não abre diz o motivo e o tamanho', () => {
  const iCab = s.indexOf('const cab ='); const iDoc = s.indexOf('lib.getDocument');
  assert.ok(iCab > 0 && iCab < iDoc, 'cabeçalho lido antes de entregar os bytes ao pdf.js');
  assert.match(s, /não é PDF: /);
  assert.match(s, /O celular não entregou o arquivo/);
  assert.match(s, /O arquivo veio vazio/);
  assert.match(s, /Este PDF tem senha/);
});
