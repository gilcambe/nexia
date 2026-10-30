'use strict';
// Protege o wrangler.jsonc: em 29/10/2026 o arquivo foi reescrito por uma tarefa automática e perdeu
// bindings, migrações e o passo de build, e o deploy do Worker parou de funcionar (PR #2483).
// Estes testes cruzam o arquivo com o que o código realmente usa, em vez de copiar valores fixos.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = JSON.parse(read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));

// Lê todos os .js de uma pasta (sem node_modules) para achar os usos de env.X.
function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...jsFiles(rel)); }
    else if (/\.(js|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('WR1. o Worker tem nome, entrada e flags que o código exige', () => {
  assert.strictEqual(wr.name, 'nexia');
  assert.strictEqual(wr.main, 'cloudflare/worker.js');
  assert.ok(fs.existsSync(path.join(ROOT, wr.main)), 'o arquivo main precisa existir');
  assert.ok((wr.compatibility_flags || []).includes('nodejs_compat'), 'sem nodejs_compat o código com node: quebra no Worker');
  assert.ok(wr.compatibility_date && wr.compatibility_date >= '2026-01-01', 'compatibility_date regrediu');
});

test('WR2. cada binding usado no código (env.AI, env.ASSETS, env.SELF, env.COFRE_SQL, env.VAZAO_CONTROLLER) está declarado', () => {
  const codigo = [...jsFiles('cloudflare'), ...jsFiles('src')].map(read).join('\n');
  const usados = new Set([...codigo.matchAll(/\benv\.(AI|ASSETS|SELF|COFRE_SQL|VAZAO_CONTROLLER)\b/g)].map(m => m[1]));
  const declarados = new Set([
    wr.ai && wr.ai.binding,
    wr.assets && wr.assets.binding,
    ...(wr.services || []).map(s => s.binding),
    ...((wr.durable_objects || {}).bindings || []).map(b => b.name),
  ].filter(Boolean));
  for (const b of usados) assert.ok(declarados.has(b), `env.${b} é usado no código mas não está declarado no wrangler.jsonc`);
  for (const b of ['AI', 'ASSETS', 'SELF', 'COFRE_SQL', 'VAZAO_CONTROLLER']) {
    assert.ok(declarados.has(b), `binding ${b} sumiu do wrangler.jsonc`);
  }
});

test('WR3. o binding SELF aponta para o próprio Worker', () => {
  const self = (wr.services || []).find(s => s.binding === 'SELF');
  assert.ok(self, 'falta o service binding SELF');
  assert.strictEqual(self.service, wr.name);
});

test('WR4. toda classe de Durable Object exportada pelo Worker tem binding e migração SQLite, sem ser apagada depois', () => {
  const worker = read(wr.main);
  const exp = worker.match(/export\s*\{([^}]*)\}/);
  assert.ok(exp, 'worker.js precisa exportar as classes de Durable Object');
  const classes = exp[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.ok(classes.includes('VazaoController') && classes.includes('CofreSql'));
  const bindings = (wr.durable_objects || {}).bindings || [];
  const migr = wr.migrations || [];
  for (const c of classes) {
    assert.ok(bindings.some(b => b.class_name === c), `${c} está exportada mas sem binding em durable_objects`);
    assert.ok(migr.some(m => (m.new_sqlite_classes || []).includes(c)), `${c} sem migração new_sqlite_classes`);
    const ultima = migr.filter(m => (m.new_sqlite_classes || []).includes(c) || (m.deleted_classes || []).includes(c)).pop();
    assert.ok((ultima.new_sqlite_classes || []).includes(c), `${c} termina apagada pelas migrações`);
  }
});

test('WR5. migrações com tags únicas e em sequência, sem reescrever o histórico já aplicado (v1 a v4)', () => {
  const migr = wr.migrations || [];
  const tags = migr.map(m => m.tag);
  assert.strictEqual(new Set(tags).size, tags.length, 'tags de migração repetidas');
  assert.deepStrictEqual(tags.slice(0, 4), ['v1', 'v2', 'v3', 'v4'], 'o histórico de migrações v1 a v4 já foi aplicado em produção e não pode ser trocado');
  assert.deepStrictEqual(migr[0].new_sqlite_classes, ['NexiaBackend']);
  assert.deepStrictEqual(migr[1].deleted_classes, ['NexiaBackend']);
});

test('WR6. os estáticos: o diretório de assets é o que o build gera e o deploy tem quem gere (build.command)', () => {
  const buildScript = read('scripts/build-worker-assets.js');
  assert.ok(wr.assets && wr.assets.directory, 'falta assets.directory');
  const dir = wr.assets.directory.replace(/^\.\//, '');
  assert.ok(buildScript.includes(`'${dir}'`), `assets.directory (${dir}) não é a pasta que scripts/build-worker-assets.js gera`);
  assert.ok(wr.build && /build:worker/.test(wr.build.command || ''), 'o workflow de deploy não tem passo de build: sem build.command a pasta de assets não existe e o deploy falha');
  assert.ok(JSON.parse(read('package.json')).scripts['build:worker'], 'o script build:worker precisa existir');
});

test('WR7. o cron e as variáveis de jobs continuam no arquivo', () => {
  assert.ok(((wr.triggers || {}).crons || []).includes('*/5 * * * *'), 'cron de 5 em 5 minutos (ADR-AUTO-01) sumiu');
  const v = wr.vars || {};
  assert.strictEqual(v.NEXIA_JOBS, 'github');
  assert.strictEqual(v.NEXIA_JOBS_REPO, 'gilcambe/nexia');
  assert.strictEqual(wr.keep_vars, true, 'sem keep_vars cada deploy apaga as variáveis criadas no painel');
});
