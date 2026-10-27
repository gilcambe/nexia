// Teste unitário: valida a lista de produtos da Central.
import { describe, it, ok, equal } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUTOS } from '../../central/produtos.js';

descritivos: null;

describe('central/produtos.js', () => {
  it('todos os itens possuem o campo tipo', () => {
    for (const item of PRODUTOS) {
      assert.ok('tipo' in item, `item ${item.id} sem campo tipo`);
    }
  });

  it('itens kernex, vault e sitekit estão presentes', () => {
    const ids = PRODUTOS.map((p) => p.id);
    assert.ok(ids.includes('kernex'), 'kernex não está presente');
    assert.ok(ids.includes('vault'), 'vault não está presente');
    assert.ok(ids.includes('sitekit'), 'sitekit não está presente');
  });
});
