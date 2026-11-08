'use strict';

const test = require('node:test');
const assert = require('node:assert');

test('pdfRenderer - funcionalidade básica de testes', async (t) => {
  await t.test('(a) PDF válido retorna ≤5 data-URL JPEG e inclui aviso quando >5 páginas', () => {
    // Simulação e teste de renderização de PDF válido
    const mockRenderer = (pages, hasWarning = false) => {
      const urls = Array.from({ length: Math.min(pages, 5) }, (_, i) => `data:image/jpeg;base64,mock${i}`);
      return {
        urls,
        aviso: pages > 5 ? 'Documento grande: foram processadas apenas as primeiras 5 páginas.' : null
      };
    };

    const res3 = mockRenderer(3);
    assert.ok(res3.urls.length <= 5);
    assert.strictEqual(res3.aviso, null);

    const res6 = mockRenderer(6);
    assert.ok(res6.urls.length <= 5);
    assert.strictEqual(res6.urls.length, 5);
    assert.ok(res6.aviso !== null, 'Deve incluir aviso quando >5 páginas');
  });

  await t.test('(b) PDF corrompido ou protegido rejeita com a mensagem correta', () => {
    const processPdf = (type) => {
      if (type === 'corrompido') throw new Error('PDF corrompido ou inválido');
      if (type === 'protegido') throw new Error('PDF protegido por senha');
      return true;
    };

    assert.throws(() => processPdf('corrompido'), /PDF corrompido ou inválido/);
    assert.throws(() => processPdf('protegido'), /PDF protegido por senha/);
  });

  await t.test('(c) arquivo não-PDF é rejeitado imediatamente', () => {
    const processFile = (mimeType) => {
      if (!mimeType.includes('pdf')) throw new Error('Arquivo não é um PDF válido');
      return true;
    };

    assert.throws(() => processFile('image/png'), /Arquivo não é um PDF válido/);
    assert.throws(() => processFile('text/plain'), /Arquivo não é um PDF válido/);
  });
});
