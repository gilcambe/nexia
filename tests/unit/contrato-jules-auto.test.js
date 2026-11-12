const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Importa a função a ser testada. Ajuste o nome da exportação caso seja diferente.
const { processJulesQuota } = require('../../cloudflare/jules-auto');

describe('processJulesQuota', () => {
  it('deve disparar o workflow Gemini e abrir PR quando a cota do Jules se esgota e o limite diário ainda não foi atingido', () => {
    const calls = { dispatch: 0, pr: 0 };
    const fakeContext = {
      // Simula que já foram realizados 2 disparos hoje (limite = 5).
      getDailyDispatchCount: () => 2,
      dispatchWorkflow: (workflowFile, inputs) => {
        calls.dispatch++;
        // Verifica o nome correto do workflow e o input da issue.
        assert.strictEqual(workflowFile, 'gemini-ajudante.yml');
        assert.strictEqual(inputs.issue, 42);
      },
      createPR: (branch, title, body) => {
        calls.pr++;
        // O nome da branch deve conter o número da issue.
        assert.ok(branch.startsWith('nexia/gemini-42'));
        // O título do PR deve referenciar a issue.
        assert.ok(title.includes('#42'));
      }
    };

    const result = processJulesQuota(42, fakeContext);
    // Espera que a função indique sucesso.
    assert.strictEqual(result, true);
    // Ambas as chamadas externas devem ter ocorrido exatamente uma vez.
    assert.strictEqual(calls.dispatch, 1);
    assert.strictEqual(calls.pr, 1);
  });

  it('não deve disparar workflow nem criar PR quando o limite diário de 5 execuções já foi atingido', () => {
    const calls = { dispatch: 0, pr: 0 };
    const fakeContext = {
      getDailyDispatchCount: () => 5,
      dispatchWorkflow: () => { calls.dispatch++; },
      createPR: () => { calls.pr++; }
    };

    const result = processJulesQuota(13, fakeContext);
    // Espera falha/negação porque o limite já foi atingido.
    assert.strictEqual(result, false);
    // Nenhuma chamada externa deve ter ocorrido.
    assert.strictEqual(calls.dispatch, 0);
    assert.strictEqual(calls.pr, 0);
  });

  it('lança TypeError quando o número da issue é inválido', () => {
    const fakeContext = {
      getDailyDispatchCount: () => 0,
      dispatchWorkflow: () => {},
      createPR: () => {}
    };
    // Passa null como issue, o que deve gerar exceção.
    assert.throws(() => processJulesQuota(null, fakeContext), TypeError);
  });
});