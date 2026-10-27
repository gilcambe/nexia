'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

let moduloCache = null;

async function carregarModulos() {
  if (moduloCache) return moduloCache;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fact-ext-integ-'));

  const files = [
    ['src/config/aiProviders.ts', 'aiProviders.mjs'],
    ['src/services/factExtractor.ts', 'factExtractor.mjs'],
    ['src/services/memoryService.ts', 'memoryService.mjs'],
    ['src/chat/responseHandler.ts', 'responseHandler.mjs'],
  ];

  for (const [relPath, outName] of files) {
    let src = fs.readFileSync(path.join(__dirname, '../../', relPath), 'utf8');
    src = src.replace(/['"]\.\.\/config\/aiProviders(?:\.ts)?['"]/g, "'./aiProviders.mjs'");
    src = src.replace(/['"]\.\.\/services\/factExtractor(?:\.ts)?['"]/g, "'./factExtractor.mjs'");
    src = src.replace(/['"]\.\.\/services\/memoryService(?:\.ts)?['"]/g, "'./memoryService.mjs'");
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    fs.writeFileSync(path.join(dir, outName), out);
  }

  const responseHandler = await import(pathToFileURL(path.join(dir, 'responseHandler.mjs')).href);
  const memoryService = await import(pathToFileURL(path.join(dir, 'memoryService.mjs')).href);

  moduloCache = { responseHandler, memoryService };
  return moduloCache;
}

test('Integration Test: confirma chamada assíncrona (waitUntil) e persistência de fatos', async () => {
  const { responseHandler, memoryService } = await carregarModulos();
  memoryService.clearInMemoryFacts();

  let waitUntilCalled = false;
  let capturedPromise = null;

  const mockWaitUntil = (promise) => {
    waitUntilCalled = true;
    capturedPromise = promise;
  };

  const mockRunner = async (config, systemPrompt, userPrompt) => {
    assert.equal(config.provider, 'groq');
    assert.equal(config.model, 'llama-3.1-8b-instant');
    return JSON.stringify([
      'Usuário é Gildivan Bezerra',
      'Minha senha é 12345', // Dado sensível
      'Localização: São Paulo',
      'Preferência: usa dark mode',
    ]);
  };

  const result = responseHandler.handlePostResponse({
    responseText: 'Seu perfil foi atualizado com sucesso!',
    userMessage: 'Meu nome é Gildivan Bezerra, moro em São Paulo e prefiro usar dark mode.',
    tenantId: 'tenant_integ',
    userId: 'user_integ_1',
    conversationId: 'conv_integ_1',
    waitUntil: mockWaitUntil,
    extractorOptions: {
      chatRunner: mockRunner,
    },
  });

  // 1. Confirma que a execução assíncrona foi disparada imediatamente
  assert.equal(result.asyncTriggered, true);
  assert.equal(waitUntilCalled, true);
  assert.ok(capturedPromise instanceof Promise);

  // 2. Aguarda a resolução do processo assíncrono em segundo plano
  const savedRecords = await capturedPromise;

  // 3. Confirma a persistência e valida as restrições da issue
  assert.ok(savedRecords.length <= 3);
  assert.equal(savedRecords.length, 3);

  // Nenhum campo proibido/sensível (senha) está nos registros salvos
  for (const rec of savedRecords) {
    assert.ok(!rec.fact.toLowerCase().includes('senha'));
    assert.ok(rec.salvo_em);
    assert.ok(rec.usado_em);
    assert.equal(rec.tenantId, 'tenant_integ');
    assert.equal(rec.userId, 'user_integ_1');
  }

  // Confirma busca via memoryService
  const storedFacts = await memoryService.getFacts('user_integ_1', 'tenant_integ', 'conv_integ_1');
  assert.equal(storedFacts.length, 3);
  assert.equal(storedFacts[0].fact, 'Usuário é Gildivan Bezerra');
});
