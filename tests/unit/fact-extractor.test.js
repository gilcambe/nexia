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

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fact-ext-unit-'));

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

  const aiProviders = await import(pathToFileURL(path.join(dir, 'aiProviders.mjs')).href);
  const factExtractor = await import(pathToFileURL(path.join(dir, 'factExtractor.mjs')).href);
  const memoryService = await import(pathToFileURL(path.join(dir, 'memoryService.mjs')).href);

  moduloCache = { aiProviders, factExtractor, memoryService };
  return moduloCache;
}

test('1. aiProviders: retorna configuração padrão para Groq llama-3.1-8b-instant', async () => {
  const { aiProviders } = await carregarModulos();
  const config = aiProviders.getAIProviderConfig();
  assert.equal(config.provider, 'groq');
  assert.equal(config.model, 'llama-3.1-8b-instant');
  assert.equal(config.temperature, 0.1);
  assert.equal(config.maxTokens, 500);
});

test('2. isSensitiveFact: identifica e bloqueia dados sensíveis e proibidos (PII, CPFs, senhas, chaves, saúde detalhada)', async () => {
  const { factExtractor } = await carregarModulos();
  assert.equal(factExtractor.isSensitiveFact('Minha senha é 123456'), true);
  assert.equal(factExtractor.isSensitiveFact('CPF do cliente: 123.456.789-00'), true);
  assert.equal(factExtractor.isSensitiveFact('Minha API Key sk-123456789012345678901234'), true);
  assert.equal(factExtractor.isSensitiveFact('Laudo médico com diagnóstico de câncer'), true);
  assert.equal(factExtractor.isSensitiveFact('Número do cartão de crédito 1234-5678-9012-3456'), true);

  // Fatos permitidos e duráveis
  assert.equal(factExtractor.isSensitiveFact('Nome do usuário: Gildivan'), false);
  assert.equal(factExtractor.isSensitiveFact('Localização: São Paulo - SP'), false);
  assert.equal(factExtractor.isSensitiveFact('Preferência: gosta de respostas diretas e simples'), false);
});

test('3. filterSensitiveFacts: filtra itens proibidos e limita a no máximo 3 fatos', async () => {
  const { factExtractor } = await carregarModulos();
  const rawFacts = [
    'Nome do usuário: Gildivan',
    'Minha senha é secret123',
    'Localização: Recife - PE',
    'CPF 123.456.789-00',
    'Área de atuação: Engenharia de Software',
    'Gosta de café forte sem açúcar',
  ];

  const filtered = factExtractor.filterSensitiveFacts(rawFacts);

  assert.equal(filtered.length, 3);
  assert.deepEqual(filtered, [
    'Nome do usuário: Gildivan',
    'Localização: Recife - PE',
    'Área de atuação: Engenharia de Software',
  ]);
});

test('4. extractFacts: chama runner do Groq llama-3.1-8b-instant e extrai fatos limpos', async () => {
  const { factExtractor } = await carregarModulos();
  const mockChatRunner = async (config, systemPrompt, userPrompt) => {
    assert.equal(config.provider, 'groq');
    assert.equal(config.model, 'llama-3.1-8b-instant');
    return JSON.stringify([
      'Nome do usuário: Gildivan',
      'Minha senha secreta é 123', // Será filtrado por ser sensível
      'Mora em São Paulo',
      'Trabalha com desenvolvimento de software',
    ]);
  };

  const facts = await factExtractor.extractFacts('Olá Gildivan, atualizei seu perfil!', 'Meu nome é Gildivan e moro em São Paulo', {
    chatRunner: mockChatRunner,
  });

  assert.equal(facts.length, 3);
  assert.ok(facts.includes('Nome do usuário: Gildivan'));
  assert.ok(facts.includes('Mora em São Paulo'));
  assert.ok(facts.includes('Trabalha com desenvolvimento de software'));
});

test('5. memoryService: salva fatos e registra usado_em e salvo_em em cada registro', async () => {
  const { memoryService } = await carregarModulos();
  memoryService.clearInMemoryFacts();

  const factsToSave = [
    'Nome: Gildivan',
    'Localização: São Paulo - SP',
    'Preferência: TypeScript e Node.js',
  ];

  const saved = await memoryService.saveFacts(factsToSave, {
    tenantId: 'tenant_test',
    userId: 'user_123',
    conversationId: 'conv_456',
  });

  assert.equal(saved.length, 3);
  for (const rec of saved) {
    assert.ok(rec.id.startsWith('fact_'));
    assert.equal(rec.tenantId, 'tenant_test');
    assert.equal(rec.userId, 'user_123');
    assert.ok(rec.salvo_em);
    assert.ok(rec.usado_em);
    assert.ok(!('senha' in rec));
    assert.ok(!('cpf' in rec));
  }

  const loaded = await memoryService.getFacts('user_123', 'tenant_test', 'conv_456');
  assert.equal(loaded.length, 3);
  assert.equal(loaded[0].fact, 'Nome: Gildivan');
});
