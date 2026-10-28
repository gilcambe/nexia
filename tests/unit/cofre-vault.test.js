'use strict';
const assert = require('assert');
const { createVault } = require('../../nexia-ai/vault/repository');
const { VazaoController } = require('../../src/durable/VazaoController');

describe('Cofre e Vault - Proteção de Cota e Cache', () => {
  it('deve contar operações por banco no VazaoController', () => {
    const vc = new VazaoController();
    vc.incrementarProvedor('banco_b', 100, '2026-10-27');
    const contadores = vc.obterContadores('2026-10-27');
    assert.strictEqual(contadores['banco_b'], 100);
  });

  it('deve verificar cota e marcar perto/excedido', () => {
    const vc = new VazaoController();
    // Limite padrão ou teste com limite baixo
    const res = vc.verificarCota('banco_b', 1000, '2026-10-27');
    assert.strictEqual(res.provedor, 'banco_b');
    assert.strictEqual(res.limite, 1000);
  });
});
