'use strict';
// Kernex Finance: PDF vira imagens no celular (até 5 páginas no total).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pdf = require('../../prumo/pdf.js');

test('reconhece PDF pelo tipo ou pela extensão', () => {
  assert.equal(pdf.ehPdf({ type: 'application/pdf', name: 'x' }), true);
  assert.equal(pdf.ehPdf({ type: '', name: 'Fatura.PDF' }), true);
  assert.equal(pdf.ehPdf({ type: 'image/jpeg', name: 'a.jpg' }), false);
});

test('no máximo 5 imagens: PDF de 7 páginas lê 5 e avisa', () => {
  assert.deepEqual(pdf.planejar([{ pdf: true, paginas: 7 }]), { plano: [5], cortou: true });
});

test('foto + PDF de 3 páginas + foto = 5, sem cortar', () => {
  assert.deepEqual(pdf.planejar([{ pdf: false }, { pdf: true, paginas: 3 }, { pdf: false }]), { plano: [1, 3, 1], cortou: false });
});

test('PDF que passa do limite junto com fotos é cortado e avisa', () => {
  assert.deepEqual(pdf.planejar([{ pdf: false }, { pdf: false }, { pdf: true, paginas: 4 }]), { plano: [1, 1, 3], cortou: true });
});

test('tela Documentos aceita PDF e o app guarda pdf.js no cache', () => {
  const raiz = path.join(__dirname, '../../prumo');
  assert.match(fs.readFileSync(path.join(raiz, 'documentos.js'), 'utf8'), /accept="image\/\*,application\/pdf/);
  assert.doesNotMatch(fs.readFileSync(path.join(raiz, 'documentos.js'), 'utf8'), /PDF em breve/);
  assert.match(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'), /\/prumo\/pdf\.js/);
  assert.match(fs.readFileSync(path.join(raiz, 'pdf.js'), 'utf8'), /pdf\.js\/3\.11\.174\//);
});
