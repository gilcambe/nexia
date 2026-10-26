'use strict';
// Central (#1872): "Chaves e IAs" diz se a chave existe, sem nunca devolver o valor.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fornecedores } = require('../../netlify/functions/central/empresa');
const { FORNECEDORES } = require('../../central/fornecedores');

test('CENTRAL-CHAVES: estado da chave sem vazar o valor', () => {
  const r = fornecedores(FORNECEDORES, { GROQ_API_KEY: 'gsk_abc123' }, []);
  const txt = JSON.stringify(r);
  assert.ok(!txt.includes('gsk_abc123') && !txt.includes('abc1'));
  assert.equal(r.find((f) => f.id === 'groq').chaveEstado, 'existe');
  assert.equal(r.find((f) => f.id === 'gemini').chaveEstado, 'falta');
  assert.equal(r.find((f) => f.id === 'meta').chaveEstado, null);
});

test('CENTRAL-CHAVES: cartão na aba Sistema', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'src/pages/central/Sistema.tsx'), 'utf8');
  assert.ok(s.includes('Chaves e IAs') && s.includes('Existe, não testada'));
});
