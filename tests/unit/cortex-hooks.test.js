'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createGateway } = require('../../nexia-ai/tool-gateway');

function mockDb() {
  const store = new Map();
  return {
    collection: (col) => ({
      doc: (id) => ({
        set: async (val) => { store.set(`${col}/${id}`, val); },
        get: async () => {
          const val = store.get(`${col}/${id}`);
          return { exists: val !== undefined, data: () => val };
        },
        delete: async () => { store.delete(`${col}/${id}`); }
      })
    })
  };
}

function mockVault() {
  let idCounter = 1;
  const calls = new Map();
  return {
    ToolCall: {
      create: async (ctx, data, opts) => {
        const id = `call_${idCounter++}`;
        const record = { id, version: 1, ...data };
        calls.set(id, record);
        return { record, replayed: false };
      },
      update: async (ctx, id, data, opts) => {
        const r = calls.get(id);
        Object.assign(r, data, { version: r.version + 1 });
        return r;
      },
      get: async (ctx, id) => calls.get(id),
      list: async () => []
    },
    Project: {
      get: async () => ({ id: 'proj_1', name: 'Test' })
    },
    ToolPolicy: {
      list: async () => []
    }
  };
}

test('bloquearPerigoso bloqueia git push --force, rm -rf /, DROP TABLE, arquivos .env e chaves sk-...', async () => {
  const perigosos = [
    { tool: 'github.commit', input: { message: 'git push --force' } },
    { tool: 'github.commit', input: { content: 'rm -rf /' } },
    { tool: 'github.commit', input: { sql: 'DROP TABLE users;' } },
    { tool: 'github.commit', input: { path: '.env' } },
    { tool: 'github.commit', input: { secret: 'sk-ant-api03-123456789012345678901234567890' } }
  ];

  for (const p of perigosos) {
    const db = mockDb();
    const vault = mockVault();
    const tool = {
      name: 'github.commit',
      risk: 'LOW',
      input_schema: { type: 'object', properties: { message: { type: 'string' }, content: { type: 'string' }, sql: { type: 'string' }, path: { type: 'string' }, secret: { type: 'string' } } },
      run: async () => 'sucesso'
    };

    const gateway = createGateway({ db, vault, tools: [tool] });
    const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'user', id: 'u1' } }, {
      projectId: 'proj_1',
      tool: 'github.commit',
      input: p.input
    });

    assert.strictEqual(res.status, 'failed');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.erro.codigo, 'HOOK_BLOCKED');
  }
});

test('commit normal de JS válido passa sem bloqueio nem avisos', async () => {
  const db = mockDb();
  const vault = mockVault();
  const tool = {
    name: 'github.commit',
    risk: 'LOW',
    input_schema: { type: 'object', properties: { content: { type: 'string' }, path: { type: 'string' } } },
    run: async () => 'feito'
  };

  const gateway = createGateway({ db, vault, tools: [tool] });
  const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'user', id: 'u1' } }, {
    projectId: 'proj_1',
    tool: 'github.commit',
    input: { path: 'app.js', content: 'function ola() { return "mundo"; }' }
  });

  assert.strictEqual(res.status, 'succeeded');
  assert.strictEqual(res.result, 'feito');
  assert.strictEqual(res.avisos, undefined);
});

test('commit de arquivo .js com sintaxe quebrada executa mas retorna aviso de sintaxe', async () => {
  const db = mockDb();
  const vault = mockVault();
  const tool = {
    name: 'github.commit',
    risk: 'LOW',
    input_schema: { type: 'object', properties: { content: { type: 'string' }, path: { type: 'string' } } },
    run: async () => 'feito'
  };

  const gateway = createGateway({ db, vault, tools: [tool] });
  const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'user', id: 'u1' } }, {
    projectId: 'proj_1',
    tool: 'github.commit',
    input: { path: 'quebrado.js', content: 'function (' }
  });

  assert.strictEqual(res.status, 'succeeded');
  assert.strictEqual(res.result, 'feito');
  assert.ok(Array.isArray(res.avisos));
  assert.ok(res.avisos.length > 0);
  assert.match(res.avisos[0], /sintaxe/i);
});
