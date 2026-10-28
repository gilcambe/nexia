/**
 * @file tests/unit/memoryIntent.test.ts
 * @brief Testes de integração/unidade para detecção de intenções e remoção de memória.
 */

import { strict as assert } from 'assert';
import { handleChatMessage } from '../../src/chat/handler';
import { addUserFact, getUserFacts, clearUserMemory } from '../../src/controllers/memoryController';

async function runTests() {
  const userId = 'test-user-integration';
  
  // Limpa o estado inicial
  await clearUserMemory(userId);

  // Adiciona fatos de teste
  await addUserFact(userId, 'Gosto de café sem açúcar');
  await addUserFact(userId, 'Trabalho com desenvolvimento Node.js');

  let facts = await getUserFacts(userId);
  assert.equal(facts.length, 2, 'Deveria ter 2 fatos');

  // Testa remoção de fato específico
  const responseForget = await handleChatMessage('esqueça isso Gosto de café', userId);
  assert(responseForget.includes('Removi o fato'), 'A resposta deve confirmar a remoção');

  facts = await getUserFacts(userId);
  assert.equal(facts.length, 1, 'Deveria restar apenas 1 fato');

  // Testa apagamento total
  const responseClear = await handleChatMessage('apagar tudo', userId);
  assert(responseClear.includes('toda a sua memória foi apagada'), 'A resposta deve confirmar a limpeza total');

  facts = await getUserFacts(userId);
  assert.equal(facts.length, 0, 'A memória deve estar totalmente vazia');

  // Teste: mensagem ambígua (não corresponde a nenhum padrão)
  const responseAmbiguous = await handleChatMessage('talvez seja melhor esquecer alguma coisa', userId);
  assert(responseAmbiguous.includes('não entendi') || responseAmbiguous.includes('outra forma'), 'Mensagem ambígua deve retornar desconhecido');

  // Teste: edge case - esqueça isso sem fato específico
  const responseNoFact = await handleChatMessage('esqueça isso', userId);
  assert(responseNoFact.includes('qual fato'), 'Esqueça isso sem fato deve pedir o fato');

  // Teste: padrão de limpeza total com variantes
  const responseClear2 = await handleChatMessage('limpar tudo', userId);
  assert(responseClear2.includes('toda a sua memória foi apagada'), 'Limpar tudo deve limpar memória');

  console.log('✅ Todos os testes de intenção e memória passaram com sucesso!');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes de memória:', err);
  process.exit(1);
});
