'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { generateSpec, normalizeSpec } = require('../scripts/para-spec');

test('gera spec válido a partir de design.json em diretório temporário e normalizeSpec não lança', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'para-spec-'));
  try {
    const designPath = path.join(tmpDir, 'design.json');
    fs.writeFileSync(designPath, JSON.stringify({
      nome: 'Verde Vida',
      nicho: 'plantas e jardinagem',
      secoes: ['hero', 'produtos', 'sobre', 'contato'],
      cores: { primario: '#22c55e', secundario: '#a16207' },
      fonte: 'Inter',
    }, null, 2));

    const design = JSON.parse(fs.readFileSync(designPath, 'utf8'));
    const spec = generateSpec(design);

    assert.ok(spec, 'spec retornado deve existir');
    assert.strictEqual(spec.nome, 'Verde Vida');
    assert.strictEqual(spec.nicho, 'plantas e jardinagem');
    assert.ok(Array.isArray(spec.secoes), 'spec.secoes deve ser um array');

    // normalizeSpec não deve lançar para um spec válido
    assert.doesNotThrow(() => normalizeSpec(spec));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('normalizeSpec lança para spec inválido', () => {
  assert.throws(() => normalizeSpec(null), /spec deve ser um objeto/);
  assert.throws(() => normalizeSpec({}), /spec.nome é obrigatório/);
  assert.throws(() => normalizeSpec({ nome: 'X' }), /spec.secoes deve ser um array/);
});
