import { hasContentViolation, filterAIResponse } from '../src/utils/contentFilter.js';
import { aiPromptService } from '../src/services/aiPromptService.js';

// Testes para hasContentViolation
console.log('Testando hasContentViolation...');

// Teste 1: Texto sem violação
const textWithoutViolation = 'Olá, tudo bem?';
const result1 = hasContentViolation(textWithoutViolation);
console.log(`Texto sem violação: "${textWithoutViolation}" -> ${result1}`);
if (result1 !== false) {
  throw new Error(`Teste 1 falhou: Esperava false, recebeu ${result1}`);
}

// Teste 2: Texto com violação (palavra proibida)
const textWithViolation = 'Esta frase contém palavraproibida no meio';
const result2 = hasContentViolation(textWithViolation);
console.log(`Texto com violação: "${textWithViolation}" -> ${result2}`);
if (result2 !== true) {
  throw new Error(`Teste 2 falhou: Esperava true, recebeu ${result2}`);
}

// Teste 3: Texto com violação (case insensitive)
const textWithViolationCase = 'Esta frase tem PALAVRAPROIBIDA em maiúsculas';
const result3 = hasContentViolation(textWithViolationCase);
console.log(`Texto com violação (case insensitive): "${textWithViolationCase}" -> ${result3}`);
if (result3 !== true) {
  throw new Error(`Teste 3 falhou: Esperava true, recebeu ${result3}`);
}

// Teste 4: Texto com múltiplas violações
const textWithMultipleViolations = 'Esta frase tem palavraproibida e também ofensaexemplo';
const result4 = hasContentViolation(textWithMultipleViolations);
console.log(`Texto com múltiplas violações: "${textWithMultipleViolations}" -> ${result4}`);
if (result4 !== true) {
  throw new Error(`Teste 4 falhou: Esperava true, recebeu ${result4}`);
}

// Teste 5: Texto nulo
const result5 = hasContentViolation(null);
console.log(`Texto nulo -> ${result5}`);
if (result5 !== false) {
  throw new Error(`Teste 5 falhou: Esperava false, recebeu ${result5}`);
}

// Testes para filterAIResponse
console.log('\nTestando filterAIResponse...');

// Teste 6: Resposta sem violação
const responseWithoutViolation = 'Esta é uma resposta normal e segura';
const result6 = filterAIResponse(responseWithoutViolation);
console.log(`Resposta sem violação: "${responseWithoutViolation}" -> "${result6}"`);
if (result6 !== responseWithoutViolation) {
  throw new Error(`Teste 6 falhou: Esperava a resposta original, recebeu "${result6}"`);
}

// Teste 7: Resposta com violação
const responseWithViolation = 'Esta resposta contém palavraproibida';
const result7 = filterAIResponse(responseWithViolation);
console.log(`Resposta com violação: "${responseWithViolation}" -> "${result7}"`);
if (result7 !== 'Desculpe, não posso ajudar com isso.') {
  throw new Error(`Teste 7 falhou: Esperava mensagem de recusa, recebeu "${result7}"`);
}

// Testes para aiPromptService
console.log('\nTestando aiPromptService...');

// Teste 8: Prompt sem violação
async function test8() {
  const promptWithoutViolation = 'Como posso melhorar minha saúde?';
  const result8 = await aiPromptService(promptWithoutViolation);
  console.log(`Prompt sem violação: "${promptWithoutViolation}" -> "${result8}"`);
  if (result8 !== 'Resposta gerada para: Como posso melhorar minha saúde?') {
    throw new Error(`Teste 8 falhou: Esperava resposta gerada, recebeu "${result8}"`);
  }
}

// Teste 9: Prompt com violação
async function test9() {
  const promptWithViolation = 'Quero saber sobre palavraproibida';
  const result9 = await aiPromptService(promptWithViolation);
  console.log(`Prompt com violação: "${promptWithViolation}" -> "${result9}"`);
  if (result9 !== 'Desculpe, não posso ajudar com isso.') {
    throw new Error(`Teste 9 falhou: Esperava mensagem de recusa, recebeu "${result9}"`);
  }
}

// Executar testes assíncronos
async function runAsyncTests() {
  try {
    await test8();
    await test9();
    console.log('\nTodos os testes passaram com sucesso!');
  } catch (error) {
    console.error('\nTeste falhou:', error.message);
    process.exit(1);
  }
}

runAsyncTests();
