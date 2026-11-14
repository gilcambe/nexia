// tests/unit/contrato-security-agent.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// caminho relativo ao diretório deste teste
const SECURITY_AGENT_PATH = path.join(__dirname, '../../agents/security_agent.js');
const GROQ_MODELO_PATH = path.join(__dirname, '../../lib/groq-modelo.js');

// Importa o agente e a constante RESERVA
const securityAgent = require(SECURITY_AGENT_PATH);
const { RESERVA } = require(GROQ_MODELO_PATH);

// Caso comum: o agente deve expor o modelo configurado igual à constante RESERVA
test('security_agent deve usar RESERVA como modelo', () => {
  // Assume que o agente exporta um objeto com a propriedade "modelo" ou "model"
  const modelo = securityAgent.modelo ?? securityAgent.model;
  assert.ok(modelo !== undefined, 'O agente deve ter a propriedade modelo ou model');
  assert.strictEqual(modelo, RESERVA, 'O modelo do agente deve ser igual à constante RESERVA');
});

// Caso de borda: o arquivo fonte não deve conter a string removida
test('arquivo security_agent.js não contém mais a string fixa do modelo', () => {
  const src = fs.readFileSync(SECURITY_AGENT_PATH, 'utf8');
  assert.ok(!src.includes('llama-3.3-70b-versatile'), "O código ainda contém a string 'llama-3.3-70b-versatile'");
});

// Entrada inválida: requerer um caminho inexistente deve lançar erro
test('requisição de módulo inexistente lança erro', () => {
  const inexistente = path.join(__dirname, '../../agents/nao_existe.js');
  assert.throws(() => require(inexistente), {
    code: 'MODULE_NOT_FOUND'
  }, 'Requerer um módulo inexistente deve lançar MODULE_NOT_FOUND');
});
