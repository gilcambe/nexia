'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const agentsModule = require('../../netlify/functions/agents');

test('AST1. PRESET_ASSISTANTS possui os 10 assistentes prontos obrigatórios', () => {
  const presets = agentsModule.PRESET_ASSISTANTS;
  assert.strictEqual(Array.isArray(presets), true);
  assert.strictEqual(presets.length, 10);

  const nomesEsperados = [
    'Post de Instagram',
    'Resposta de WhatsApp',
    'Contrato simples',
    'Orçamento',
    'E-mail de venda',
    'Roteiro de vídeo',
    'Plano de aula',
    'Cardápio',
    'Resumo de PDF',
    'Ajuda com MEI'
  ];

  const nomesObtidos = presets.map(p => p.name || p.displayName);
  for (const nome of nomesEsperados) {
    assert.ok(nomesObtidos.includes(nome), `Deve conter o assistente pronto "${nome}"`);
  }
});

test('AST2. indexKnowledgeFiles limita em até 5 arquivos e formata chunks no RAG', async () => {
  const arquivos = [
    { fileName: 'cardapio.txt', content: 'Pizza Margherita R$45. Pizza Calabresa R$50.' },
    { fileName: 'precos.txt', content: 'Refrigerante 2L R$12. Suco Natural R$10.' },
    { fileName: 'regras.txt', content: 'Taxa de entrega R$5. Horário das 18h às 23h.' },
    { fileName: 'doc4.txt', content: 'Conteúdo do documento 4' },
    { fileName: 'doc5.txt', content: 'Conteúdo do documento 5' },
    { fileName: 'doc6.txt', content: 'Conteúdo do documento 6 excedente' }
  ];

  let setChamados = [];
  global.db = {
    collection: (colName) => ({
      doc: (tenantId) => ({
        collection: (subCol) => ({
          doc: () => ({
            set: async (data) => {
              setChamados.push(data);
            }
          })
        })
      })
    })
  };

  await agentsModule.indexKnowledgeFiles('tenant_test', 'agent_123', arquivos);
  assert.strictEqual(setChamados.length, 5, 'Deve indexar no máximo 5 arquivos de conhecimento');
  assert.strictEqual(setChamados[0].agentId, 'agent_123');
  assert.strictEqual(setChamados[0].fileName, 'cardapio.txt');
  assert.ok(setChamados[0].chunks.length > 0);
});

test('AST3. buildRAGContextForAgent busca trechos relevantes nos arquivos do assistente', async () => {
  const docsMock = [
    {
      fileName: 'cardapio.txt',
      agentId: 'agent_pizzaria',
      chunks: ['Pizza Margherita R$45. Ingredientes: molho de tomate, mussarela e manjericão.']
    },
    {
      fileName: 'outros.txt',
      agentId: 'agent_outro',
      chunks: ['Aulas de violão e piano.']
    }
  ];

  global.db = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          get: async () => docsMock
        })
      })
    })
  };

  const contexto = await agentsModule.buildRAGContextForAgent('tenant_test', 'agent_pizzaria', 'Margherita');
  assert.ok(contexto.includes('cardapio.txt'));
  assert.ok(contexto.includes('Pizza Margherita R$45'));
  assert.ok(!contexto.includes('Aulas de violão'));
});

test('AST4. Handler de agentes com action=publicChat responde usando RAG e valida cota do tenant', async () => {
  let docData = {
    plan: 'free',
    assistantLimit: 2
  };
  let callsAtual = 0;

  const mockDb = {
    collection: (col) => ({
      where: () => ({ get: async () => ({ docs: [] }) }),
      doc: (docId) => ({
        get: async () => ({
          exists: true,
          data: () => docData
        }),
        collection: (sub) => ({
          doc: (subId) => ({
            get: async () => ({
              exists: true,
              data: () => ({ cortexCalls: callsAtual })
            })
          }),
          get: async () => []
        })
      })
    }),
    runTransaction: async (fn) => {
      const tx = {
        get: async () => ({
          exists: true,
          data: () => ({ cortexCalls: callsAtual })
        }),
        set: () => {},
        update: (ref, updateData) => {
          callsAtual++;
        }
      };
      return fn(tx);
    }
  };

  global.db = mockDb;

  const reqValida = {
    httpMethod: 'POST',
    body: JSON.stringify({
      action: 'publicChat',
      agentId: 'ast_preset_cardapio',
      message: 'Qual o valor da pizza?',
      tenantId: 'tenant_pizzaria'
    })
  };

  const res1 = await agentsModule.handler(reqValida);
  assert.strictEqual(res1.statusCode, 200);

  const res2 = await agentsModule.handler(reqValida);
  assert.strictEqual(res2.statusCode, 200);

  const res3 = await agentsModule.handler(reqValida);
  assert.strictEqual(res3.statusCode, 429);
  const body3 = JSON.parse(res3.body);
  assert.ok(body3.error.includes('Limite de mensagens'));
});

test('AST5. Interface frontend em Assistentes.tsx e Lateral.tsx contém elementos de criar assistente e menu', () => {
  const fileAssistentes = path.join(__dirname, '../../src/pages/cortex/Assistentes.tsx');
  const codeAssistentes = fs.readFileSync(fileAssistentes, 'utf8');
  assert.ok(codeAssistentes.includes('data-testid="cx-criar-assistente"'), 'deve conter o botão de criar assistente');
  assert.ok(codeAssistentes.includes('data-testid="cx-salvar-assistente"'), 'deve conter o botão de salvar assistente');

  const fileLateral = path.join(__dirname, '../../src/pages/cortex/Lateral.tsx');
  const codeLateral = fs.readFileSync(fileLateral, 'utf8');
  assert.ok(codeLateral.includes('assistentes'), 'deve incluir a vista assistentes no menu');
  assert.ok(codeLateral.includes('Meus assistentes'), 'deve incluir a opção Meus assistentes no menu lateral');
});
