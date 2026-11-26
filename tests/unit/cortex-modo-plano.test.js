const test = require('node:test');
const assert = require('node:assert');

// Como o orchestrator e dependências podem estar na estrutura do projeto, 
// vamos importar ou simular a lógica testando o fluxo do modo_plano conforme especificado.
// Se o orchestrator real for usado ou uma simulação robusta:
const orchestrator = require('../../nexia-ai/orchestrator/index.js');

test('Cenário 1: Execução com modo_plano: true para em waiting_approval e não chama escrita', async () => {
  const gatewayMock = {
    create_branch: async () => { throw new Error('Não deveria chamar create_branch no modo plano'); },
    commit: async () => { throw new Error('Não deveria chamar commit no modo plano'); }
  };

  const architectMock = {
    plan: async () => ({ plano: 'Plano de teste criado', steps: ['step1'] })
  };

  // Executando o fluxo com modo_plano ativado
  const result = await orchestrator.run({
    prompt: 'Criar funcionalidade X',
    modo_plano: true,
    gateway: gatewayMock,
    architect: architectMock
  });

  assert.strictEqual(result.status, 'waiting_approval');
  assert.ok(result.question && result.question.includes('Plano'));
});

test('Cenário 2: Execução sem modo_plano segue normalmente e executa o gateway', async () => {
  let branchCriada = false;
  let commitRealizado = false;

  const gatewayMock = {
    create_branch: async () => { branchCriada = true; return { ok: true }; },
    commit: async () => { commitRealizado = true; return { ok: true }; }
  };

  const architectMock = {
    plan: async () => ({ plano: 'Plano direto', steps: ['step1'] })
  };

  const result = await orchestrator.run({
    prompt: 'Corrigir bug Y',
    modo_plano: false,
    gateway: gatewayMock,
    architect: architectMock
  });

  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(branchCriada, true);
  assert.strictEqual(commitRealizado, true);
});

test('Cenário 3: Resume após aprovação no modo plano continua a execução', async () => {
  let commitRealizado = false;

  const gatewayMock = {
    create_branch: async () => ({ ok: true }),
    commit: async () => { commitRealizado = true; return { ok: true }; }
  };

  // Simula o retorno de uma execução pausada e seu posterior resume
  const pausedState = {
    status: 'waiting_approval',
    question: 'Plano pendente',
    context: { prompt: 'Tarefa Z' }
  };

  const result = await orchestrator.resume({
    state: pausedState,
    approved: true,
    gateway: gatewayMock
  });

  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(commitRealizado, true);
});
