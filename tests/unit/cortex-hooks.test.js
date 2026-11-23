'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { criarHooks, bloquearPerigoso, checarSintaxe } = require('../../nexia-ai/tool-gateway/hooks');
const { createGateway } = require('../../nexia-ai/tool-gateway/index');

test('criarHooks: executa ganchos antes e depois corretamente', async () => {
  const h = criarHooks();
  let antesRodou = false;
  let depoisRodou = false;

  h.antes(async (chamada) => {
    antesRodou = true;
    if (chamada.input.bloquear) return { bloquear: 'motivo customizado' };
    return null;
  });

  h.depois(async () => {
    depoisRodou = true;
    return { aviso: 'aviso teste' };
  });

  const resAntes = await h.rodarAntes({ tool: 'test.tool', input: { ok: true } });
  assert.strictEqual(antesRodou, true);
  assert.strictEqual(resAntes, null);

  const resBloqueio = await h.rodarAntes({ tool: 'test.tool', input: { bloquear: true } });
  assert.deepStrictEqual(resBloqueio, { bloquear: 'motivo customizado' });

  const avisos = await h.rodarDepois({ tool: 'test.tool' }, {});
  assert.strictEqual(depoisRodou, true);
  assert.deepStrictEqual(avisos, ['aviso teste']);
});

test('bloquearPerigoso: bloqueia git push --force, rm -rf /, DROP TABLE, .env e segredos', () => {
  assert.deepStrictEqual(bloquearPerigoso({ input: { command: 'git push --force origin main' } }), { bloquear: 'Comando ou instrução perigosa bloqueada' });
  assert.deepStrictEqual(bloquearPerigoso({ input: { text: 'rm -rf /' } }), { bloquear: 'Comando ou instrução perigosa bloqueada' });
  assert.deepStrictEqual(bloquearPerigoso({ input: { query: 'DROP TABLE usuarios;' } }), { bloquear: 'Comando ou instrução perigosa bloqueada' });
  assert.deepStrictEqual(bloquearPerigoso({ input: { files: [{ path: '.env', content: 'FOO=BAR' }] } }), { bloquear: 'Arquivo com cara de segredo bloqueado (.env)' });
  assert.deepStrictEqual(bloquearPerigoso({ input: { files: [{ path: 'index.js', content: 'sk-ant-api03-12345678901234567890abcdef' }] } }), { bloquear: 'Conteúdo com chave ou segredo detectado' });
  
  // Normal passa
  assert.strictEqual(bloquearPerigoso({ input: { files: [{ path: 'app.js', content: 'console.log("ok");' }] } }), null);
});

test('checarSintaxe: retorna aviso quando arquivo .js tem erro de sintaxe', () => {
  const resErro = checarSintaxe({ tool: 'github.commit_files', input: { files: [{ path: 'erro.js', content: 'const x = ;' }] } }, {});
  assert.match(resErro.aviso, /^sintaxe: erro\.js:/);

  const resOk = checarSintaxe({ tool: 'github.commit_files', input: { files: [{ path: 'bom.js', content: 'const x = 10; module.exports = x;' }] } }, {});
  assert.strictEqual(resOk, null);

  // Outras ferramentas ignoram
  const resOutra = checarSintaxe({ tool: 'vault.get', input: {} }, {});
  assert.strictEqual(resOutra, null);
});

test('Gateway: commit com git push --force é bloqueado com HOOK_BLOCKED e não executa', async () => {
  let executed = false;
  const fakeTool = {
    name: 'github.commit_files',
    risk: 'MEDIUM',
    min_autonomy: 1,
    description: 'Commit files',
    input_schema: { type: 'object', properties: { command: { type: 'string' } } },
    run: async () => { executed = true; return { ok: true }; }
  };

  const fakeVault = {
    Project: { get: async () => ({ id: 'prj_1' }) },
    ToolPolicy: { list: async () => [] },
    ToolCall: {
      create: async (ctx, data) => ({ record: { id: 'call_1', status: data.status, ...data }, replayed: false })
    }
  };

  const gateway = createGateway({
    db: { collection: () => ({ doc: () => ({ set: async () => {}, delete: async () => {}, get: async () => ({ exists: false }) }) }) },
    vault: fakeVault,
    tools: [fakeTool]
  });

  const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'system', id: 'test' } }, {
    projectId: 'prj_1',
    tool: 'github.commit_files',
    input: { command: 'git push --force' }
  });

  assert.strictEqual(res.status, 'failed');
  assert.strictEqual(res.error.code, 'HOOK_BLOCKED');
  assert.strictEqual(executed, false);
});

test('Gateway: commit normal passa com sucesso', async () => {
  let executed = false;
  const fakeTool = {
    name: 'github.commit_files',
    risk: 'MEDIUM',
    min_autonomy: 1,
    description: 'Commit files',
    input_schema: { type: 'object', properties: { files: { type: 'array' } } },
    run: async () => { executed = true; return { success: true }; }
  };

  const fakeVault = {
    Project: { get: async () => ({ id: 'prj_1' }) },
    ToolPolicy: { list: async () => [] },
    ToolCall: {
      create: async (ctx, data) => ({ record: { id: 'call_1', status: data.status, ...data }, replayed: false }),
      update: async (ctx, id, data) => ({ id, ...data })
    }
  };

  const gateway = createGateway({
    db: { collection: () => ({ doc: () => ({ set: async () => {}, delete: async () => {}, get: async () => ({ exists: false }) }) }) },
    vault: fakeVault,
    tools: [fakeTool]
  });

  const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'system', id: 'test' } }, {
    projectId: 'prj_1',
    tool: 'github.commit_files',
    input: { files: [{ path: 'main.js', content: 'console.log("ok");' }] }
  });

  assert.strictEqual(res.status, 'succeeded');
  assert.strictEqual(executed, true);
});

test('Gateway: commit de .js com sintaxe quebrada volta com aviso', async () => {
  const fakeTool = {
    name: 'github.commit_files',
    risk: 'MEDIUM',
    min_autonomy: 1,
    description: 'Commit files',
    input_schema: { type: 'object', properties: { files: { type: 'array' } } },
    run: async () => ({ success: true })
  };

  const fakeVault = {
    Project: { get: async () => ({ id: 'prj_1' }) },
    ToolPolicy: { list: async () => [] },
    ToolCall: {
      create: async (ctx, data) => ({ record: { id: 'call_1', status: data.status, ...data }, replayed: false }),
      update: async (ctx, id, data) => ({ id, ...data })
    }
  };

  const gateway = createGateway({
    db: { collection: () => ({ doc: () => ({ set: async () => {}, delete: async () => {}, get: async () => ({ exists: false }) }) }) },
    vault: fakeVault,
    tools: [fakeTool]
  });

  const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'system', id: 'test' } }, {
    projectId: 'prj_1',
    tool: 'github.commit_files',
    input: { files: [{ path: 'quebrado.js', content: 'const a = ;' }] }
  });

  assert.strictEqual(res.status, 'succeeded');
  assert.ok(res.avisos && res.avisos.length > 0);
  assert.match(res.avisos[0], /sintaxe: quebrado\.js:/);
});

test('Gateway: arquivo .env é bloqueado', async () => {
  let executed = false;
  const fakeTool = {
    name: 'github.commit_files',
    risk: 'MEDIUM',
    min_autonomy: 1,
    description: 'Commit files',
    input_schema: { type: 'object', properties: { files: { type: 'array' } } },
    run: async () => { executed = true; return { ok: true }; }
  };

  const fakeVault = {
    Project: { get: async () => ({ id: 'prj_1' }) },
    ToolPolicy: { list: async () => [] },
    ToolCall: {
      create: async (ctx, data) => ({ record: { id: 'call_1', status: data.status, ...data }, replayed: false })
    }
  };

  const gateway = createGateway({
    db: { collection: () => ({ doc: () => ({ set: async () => {}, delete: async () => {}, get: async () => ({ exists: false }) }) }) },
    vault: fakeVault,
    tools: [fakeTool]
  });

  const res = await gateway.invoke({ tenantId: 't1', actor: { type: 'system', id: 'test' } }, {
    projectId: 'prj_1',
    tool: 'github.commit_files',
    input: { files: [{ path: '.env', content: 'SECRET=123' }] }
  });

  assert.strictEqual(res.status, 'failed');
  assert.strictEqual(res.error.code, 'HOOK_BLOCKED');
  assert.strictEqual(executed, false);
});
