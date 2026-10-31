'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../../sites/viajantepro/painel/nucleo.js');

test('VPPAINEL1. pendências, próximas viagens, roteiro em texto e link do app', () => {
  const v = { data_saida: '2026-11-10', data_retorno: '2026-11-20', voos: [{ trecho: 'GRU → LIS' }], documentos: [{ titulo: 'Seguro viagem' }], emergencia: {} };
  assert.deepStrictEqual(P.pendencias(v), ['hotel', 'passaporte/documento', 'localizador do voo', 'telefone 24h']);
  assert.deepStrictEqual(P.proximas([v, { data_saida: '2027-03-01' }], '2026-11-01').length, 1);
  assert.strictEqual(P.viajandoAgora([v], '2026-11-15').length, 1);
  const txt = '2026-11-11 Lisboa\n10:00 | Torre de Belém | Av. Brasília\n | Jantar | Bairro Alto\nLivre';
  const r = P.roteiroDeTexto(txt);
  assert.strictEqual(r[0].itens.length, 3);
  assert.deepStrictEqual(P.roteiroDeTexto(P.roteiroParaTexto(r)), r);
  assert.strictEqual(P.linkApp('https://viajantepro.pages.dev/', 'a'.repeat(32)), 'https://viajantepro.pages.dev/app/?t=' + 'a'.repeat(32));
  assert.match(P.linkWhatsApp('5511999998888', 'Ana', 'https://x/app/?t=1'), /^https:\/\/wa\.me\/5511999998888\?text=Ol%C3%A1%20Ana/);
});
