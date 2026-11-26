const test = require('node:test');
const assert = require('node:assert');
const { createGateway } = require('./index');

test('Testes de hooks do Gateway', async (t) => {
  const mockDb = { collection: () => ({ doc: () => ({ set: async () => {}, delete: async () => {}, get: async () => ({ exists: true, data: () => ({ tenant_id: 'test-tenant' }) }) }) }) };
  const mockVault = { 
    Project: { get: async () => ({ id: 'p1' }) },
    ToolCall: { 
      create: async () => ({ record: { id: 'tc1', version: 1 }, replayed: false }),
      update: async () => ({ id: 'tc1', status: 'succeeded' })
    },
    ToolPolicy: { list: async () => [] }
  };
  const mockTool = { 
    name: 'test.tool', 
    risk: 'LOW', 
    input_schema: { type: 'object', properties: {} },
    run: async () => ({ ok: true }) 
  };
  
  const gateway = createGateway({ 
    db: mockDb, 
    vault: mockVault, 
    tools: [mockTool] 
  });

  await t.test('bloquearPerigoso bloqueia git push --force', async () => {
    const res = await gateway.invoke({ tenantId: 'test-tenant', actor: { type: 'system' } }, { projectId: 'p1', tool: 'test.tool', input: { cmd: 'git push --force' } });
    assert.strictEqual(res.status, 'denied');
    assert.strictEqual(res.erro.codigo, 'HOOK_BLOCKED');
  });

  await t.test('bloquearPerigoso bloqueia .env', async () => {
    const res = await gateway.invoke({ tenantId: 'test-tenant', actor: { type: 'system' } }, { projectId: 'p1', tool: 'test.tool', input: { file: '.env' } });
    assert.strictEqual(res.status, 'denied');
    assert.strictEqual(res.erro.codigo, 'HOOK_BLOCKED');
  });

  await t.test('commit normal passa', async () => {
    const res = await gateway.invoke({ tenantId: 'test-tenant', actor: { type: 'system' } }, { projectId: 'p1', tool: 'test.tool', input: { code: 'console.log("hi")' } });
    assert.strictEqual(res.status, 'succeeded');
  });

  await t.test('sintaxe quebrada retorna aviso', async () => {
    // Usando a ferramenta real que deve rodar o checarSintaxe hook por padrão
    const res = await gateway.invoke({ tenantId: 'test-tenant', actor: { type: 'system' } }, { projectId: 'p1', tool: 'test.tool', input: { code: 'function (' } });
    assert.ok(res.avisos && res.avisos.length > 0);
  });
});
