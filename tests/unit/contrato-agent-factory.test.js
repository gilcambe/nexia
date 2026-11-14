// tests/unit/agent-factory.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Caminho relativo ao diretório do teste
const AGENT_FACTORY_PATH = path.join(__dirname, '../../core/agent-factory.js');

test('core/agent-factory.js não contém mais o modelo fixo e exporta createAgent', (t) => {
  // 1. O arquivo de origem não deve conter a string antiga do modelo
  const source = fs.readFileSync(AGENT_FACTORY_PATH, 'utf8');
  assert.ok(!source.includes('llama-3.3-70b-versatile'), 'O código ainda contém a string "llama-3.3-70b-versatile"');

  // 2. O código deve referenciar a nova abstração (comGroq ou RESERVA)
  const usesComGroq = source.includes('comGroq') || source.includes('RESERVA');
  assert.ok(usesComGroq, 'O código não faz referência a comGroq nem a RESERVA');

  // 3. O módulo deve exportar a função createAgent (ou equivalente) que ainda pode ser invocada sem erro
  const agentFactory = require(AGENT_FACTORY_PATH);
  // A exportação pode ser direta ou via objeto; aceitamos ambos os estilos
  const createAgent = typeof agentFactory === 'function' ? agentFactory : agentFactory.createAgent;
  assert.ok(typeof createAgent === 'function', 'O módulo não exporta uma função createAgent');

  // 4. Chamar a função com um config mínimo não deve lançar erro e deve retornar um objeto
  const result = createAgent({});
  assert.ok(result && typeof result === 'object', 'createAgent não retornou um objeto esperado');
});
