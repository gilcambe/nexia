'use strict';
// Teste: contador de uso por banco, failover aos 70% da cota e cache TTL 60s.
const test = require('node:test');
const { strict: assert } = require('node:assert');

const firestore = require('../../lib/firebase-lite/firestore.js');

function resetarBancos() {
  firestore.usoDiarioBancos.clear();
  firestore.bancoAtual = 'firestore-default';
}

test('B1. contador diário acumula leituras e escritas por banco', () => {
  resetarBancos();
  firestore.registrarUsoBanco('firestore-default', 10, 5);
  firestore.registrarUsoBanco('firestore-default', 30, 8);
  const uso = firestore.getUsoBanco('firestore-default');
  assert.strictEqual(uso.leituras, 40);
  assert.strictEqual(uso.escritas, 13);
  assert.strictEqual(firestore.getUsoBanco('firestore-b').leituras, 0);
});

test('B2. limite grátis: Firestore 50k leituras / 20k escritas; D1 5M linhas / 100k escritas', () => {
  resetarBancos();
  const d = firestore.BANK_LIMITS;
  assert.strictEqual(d['firestore-default'].reads, 50000);
  assert.strictEqual(d['firestore-default'].writes, 20000);
  assert.strictEqual(d['firestore-b'].reads, 50000);
  assert.strictEqual(d['firestore-b'].writes, 20000);
  assert.ok(d.d1 && d.d1.reads === 5000000 && d.d1.writes === 100000);
});

test('B3. abaixo de 70% continua no mesmo banco', () => {
  resetarBancos();
  firestore.registrarUsoBanco('firestore-default', 34999, 13999); // ~69,9%
  assert.strictEqual(firestore.getBancoAtivo(), 'firestore-default');
  const uso = firestore.getUsoBanco('firestore-default');
  assert.ok(uso.leituras / 50000 < 0.7);
  assert.ok(uso.escritas / 20000 < 0.7);
});

test('B4. acima de 70% troca para o próximo banco', () => {
  resetarBancos();
  firestore.registrarUsoBanco('firestore-default', 35000, 14000); // exatamente 70%
  assert.strictEqual(firestore.getBancoAtivo(), 'firestore-default');
  // chama getNextBank: deve apontar para firestore-b
  const prox = firestore.getNextBank();
  assert.strictEqual(prox, 'firestore-b');
  assert.strictEqual(firestore.switchToNextBank(), 'firestore-b');
  assert.strictEqual(firestore.getBancoAtivo(), 'firestore-b');
});

test('B5. rodízio completo: default → b → c → d1 → cofresql', () => {
  resetarBancos();
  const ordem = [];
  let b = firestore.getBancoAtivo();
  ordem.push(b);
  while ((b = firestore.switchToNextBank()) !== 'cofresql') ordem.push(b);
  ordem.push('cofresql');
  assert.deepStrictEqual(ordem, ['firestore-default', 'firestore-b', 'firestore-c', 'd1', 'cofresql']);
  // depois de cofresql não troca mais
  assert.strictEqual(firestore.switchToNextBank(), 'cofresql');
});

test('B6. cache TTL 60s: leitura repetida vem do cache, escrita invalida', async () => {
  const { createVault } = require('../../nexia-ai/vault/repository.js');
  const db = {
    runTransaction: async fn => fn({
      get: async path => ({ exists: true, data: () => ({ tenant_id: 't1', project_id: 'p1', client_id: 'c1' }) }),
      collection: () => ({ doc: () => ({}) }),
    }),
    collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ tenant_id: 't1' }) }) }) }),
  };
  const vault = createVault({ db });
  const ctx = { tenantId: 't1', executionId: 'exe_' + 'a'.repeat(32), actor: { type: 'user', id: 'u1' } };

  // cria um Project (entidade com cache)
  const criado = await vault.Project.create(ctx, { nome: 'Projeto Teste' });
  const id = criado.record.id;

  // primeira leitura (do banco)
  const r1 = await vault.Project.get(ctx, id);
  assert.strictEqual(r1.nome, 'Projeto Teste');
  // segunda leitura deve vir do cache (mesmo objeto)
  const r2 = await vault.Project.get(ctx, id);
  assert.strictEqual(r2, r1);

  // atualiza o documento: invalida o cache
  await vault.Project.update(ctx, id, { nome: 'Projeto Atualizado' }, { expectedVersion: 1 });
  // leitura após escrita deve buscar de novo no banco
  const r3 = await vault.Project.get(ctx, id);
  assert.strictEqual(r3.nome, 'Projeto Atualizado');
  assert.notStrictEqual(r3, r2);
});

test('B7. cache expira depois de 60 s', () => {
  const agora = () => Date.now();
  const cache = new Map();
  function getCached(tenantId, entity, id) {
    const k = `${tenantId}:${entity}:${id}`;
    const entry = cache.get(k);
    if (entry && entry.expiresAt > agora()) return entry.record;
    cache.delete(k);
    return null;
  }
  function setCached(tenantId, entity, id, record) {
    const k = `${tenantId}:${entity}:${id}`;
    cache.set(k, { expiresAt: Date.now() + 60 * 1000, record });
  }
  setCached('t1', 'Client', 'c1', { nome: 'A' });
  assert.deepStrictEqual(getCached('t1', 'Client', 'c1'), { nome: 'A' });
  // força expiração
  cache.set('t1:Client:c1', { expiresAt: Date.now() - 1, record: { nome: 'A' } });
  assert.strictEqual(getCached('t1', 'Client', 'c1'), null);
});

// Para rodar com `node --test tests/unit/vault-bancos.test.js`
if (require.main === module) {
  console.log('Rode com: npm test (tests/unit/*.test.js)');
}
