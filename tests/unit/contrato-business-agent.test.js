const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

// caminho relativo ao diretório deste teste
const businessAgentPath = path.join(__dirname, '../../agents/business_agent.js');
const groqModeloPath = path.join(__dirname, '../../lib/groq-modelo.js');

const businessAgent = require(businessAgentPath);
const { RESERVA } = require(groqModeloPath);

// ------------------------------------------------------------
// Caso comum: a função pública retorna o modelo RESERVA
// ------------------------------------------------------------
// O módulo exporta, segundo a convenção do projeto, uma função chamada
// `createBusinessAgent` que devolve um objeto de agente.
// Caso o nome seja diferente, o teste falhará – isso indica que a
// implementação ainda não está alinhada ao contrato esperado.

test('createBusinessAgent deve retornar objeto com modelo RESERVA', t => {
  assert.ok(typeof businessAgent.createBusinessAgent === 'function', 'createBusinessAgent deve ser uma função');
  const agent = businessAgent.createBusinessAgent({});
  assert.ok(agent && typeof agent === 'object', 'deve retornar um objeto');
  assert.equal(agent.modelo, RESERVA, 'o campo modelo deve ser a constante RESERVA');
});

// ------------------------------------------------------------
// Borda: quando passa opções vazias ainda usa RESERVA
// ------------------------------------------------------------

test('modelo permanece RESERVA mesmo com opções vazias', t => {
  const agent = businessAgent.createBusinessAgent(); // sem argumento
  assert.equal(agent.modelo, RESERVA);
});

// ------------------------------------------------------------
// Entrada inválida: argumento não‑objeto deve lançar erro
// ------------------------------------------------------------

test('entrada inválida deve lançar', t => {
  assert.throws(() => businessAgent.createBusinessAgent(null), {
    name: 'Error'
  });
});

// ------------------------------------------------------------
// Verificação estática: o código fonte não contém a string antiga
// ------------------------------------------------------------

test('arquivo não contém o modelo fixo antigo', t => {
  const src = fs.readFileSync(businessAgentPath, 'utf8');
  assert.ok(!src.includes('llama-3.3-70b-versatile'), 'código ainda contém referência ao modelo removido');
});
