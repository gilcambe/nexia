'use strict';
// Testes de integração para pedidos de esquecimento e apagar memória (Issue #1708)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const CHAT_DIR = path.join(__dirname, '..', '..', 'src', 'chat');
const CONTROLLERS_DIR = path.join(__dirname, '..', '..', 'src', 'controllers');

test('1708a. detecção de intenções de esquecimento (esqueça isso, apagar tudo, etc)', () => {
  const codeIntents = fs.readFileSync(path.join(CHAT_DIR, 'intents.ts'), 'utf8');
  const jsIntents = ts.transpileModule(codeIntents, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: 'ES2022' }
  }).outputText;

  const moduleObj = { exports: {} };
  const fn = new Function('module', 'exports', jsIntents);
  fn(moduleObj, moduleObj.exports);
  const { ehEsquecer, detectForgetIntent } = moduleObj.exports;

  // Frases de remoção específica
  assert.equal(ehEsquecer('esqueça isso'), true);
  assert.equal(ehEsquecer('não guarde essa informação'), true);
  assert.equal(ehEsquecer('apagar essa memoria'), true);

  // Frases de limpeza total
  assert.equal(ehEsquecer('apagar tudo'), true);
  assert.equal(ehEsquecer('limpar memoria'), true);
  assert.equal(ehEsquecer('esquecer tudo'), true);

  // Frases normais não devem ser classificadas como esquecimento
  assert.equal(ehEsquecer('qual a capital da França?'), false);
  assert.equal(ehEsquecer('crie uma tela de login'), false);

  // Detalhes da intenção
  assert.deepEqual(detectForgetIntent('apagar tudo'), { isForget: true, type: 'total' });
  assert.deepEqual(detectForgetIntent('esqueça isso'), { isForget: true, type: 'specific', query: 'esqueça isso' });
});

test('1708b. teste de integração de apagamento total e confirmação', async () => {
  const codeIntents = fs.readFileSync(path.join(CHAT_DIR, 'intents.ts'), 'utf8');
  const jsIntents = ts.transpileModule(codeIntents, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: 'ES2022' } }).outputText;
  const moduleIntents = { exports: {} };
  new Function('module', 'exports', jsIntents)(moduleIntents, moduleIntents.exports);

  const codeController = fs.readFileSync(path.join(CONTROLLERS_DIR, 'memoryController.ts'), 'utf8');
  const jsController = ts.transpileModule(codeController, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: 'ES2022' } }).outputText;
  const moduleController = { exports: {} };
  new Function('module', 'exports', jsController)(moduleController, moduleController.exports);

  const codeHandler = fs.readFileSync(path.join(CHAT_DIR, 'handler.ts'), 'utf8');
  const jsHandler = ts.transpileModule(codeHandler, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: 'ES2022' } }).outputText;

  const moduleHandler = { exports: {} };
  const requireMock = (id) => {
    if (id === './intents') return moduleIntents.exports;
    if (id === '../controllers/memoryController') return moduleController.exports;
    throw new Error(`Modulo nao encontrado: ${id}`);
  };
  new Function('module', 'exports', 'require', jsHandler)(moduleHandler, moduleHandler.exports, requireMock);

  const { handleChatMessage } = moduleHandler.exports;

  // Caso de apagamento total
  const resTotal = await handleChatMessage('apagar tudo', 'user123', 'nexia', 'conv1');
  assert.equal(resTotal.handled, true);
  assert.equal(resTotal.isForget, true);
  assert.equal(resTotal.result.type, 'total');
  assert.match(resTotal.reply, /apagada com sucesso|limpa com sucesso/i);

  // Caso de remoção de fato específico
  const resSpec = await handleChatMessage('esqueça isso', 'user123', 'nexia', 'conv1');
  assert.equal(resSpec.handled, true);
  assert.equal(resSpec.isForget, true);
  assert.equal(resSpec.result.type, 'specific');
  assert.match(resSpec.reply, /removida da/i);

  // Mensagem normal
  const resNormal = await handleChatMessage('como vai você?', 'user123', 'nexia', 'conv1');
  assert.equal(resNormal.handled, false);
  assert.equal(resNormal.isForget, false);
});
