'use strict';
// Teste unitário: scripts/vigia-no-ar.js
// Valida: 1 falha não dispara rollback nem issue; 2 falhas consecutivas disparam rollback + issue; volta ao normal fecha a issue.
// Rode com: node --test tests/vigia-no-ar.test.js

const test = require('node:test');
const assert = require('node:assert');

process.env.GITHUB_TOKEN = 'token-teste';
process.env.GITHUB_REPO = 'gilcambe/nexia';

function novoVigia() {
  delete require.cache[require.resolve('../scripts/vigia-no-ar.js')];
  const vigia = require('../scripts/vigia-no-ar.js');
  vigia.resetarEstado();
  return vigia;
}

test('1 falha não dispara rollback nem issue', async () => {
  const vigia = novoVigia();
  let rollbackChamadas = 0;
  let criarIssueChamadas = 0;

  vigia.setInjetaveis({
    fetch: async () => { throw new Error('falha simulada'); },
    rollback: async () => { rollbackChamadas++; return { sucesso: true }; },
    abrirIssue: async () => { criarIssueChamadas++; return { numero: 1 }; },
    fecharIssue: async () => ({ fechada: true }),
    listarIssues: async () => [],
  });

  const resultado = await vigia.verificarSite({
    id: 'produto-falha',
    site: 'https://produto-falha.pages.dev/',
  });

  assert.strictEqual(rollbackChamadas, 0);
  assert.strictEqual(criarIssueChamadas, 0);
  assert.strictEqual(vigia.falhasConsecutivas['produto-falha'], 1);
  assert.strictEqual(resultado.status, 'falha');
});

test('2 falhas consecutivas disparam rollback e issue', async () => {
  const vigia = novoVigia();
  let rollbackChamadas = 0;
  let criarIssueChamadas = 0;

  vigia.setInjetaveis({
    fetch: async () => { throw new Error('falha simulada'); },
    rollback: async () => { rollbackChamadas++; return { sucesso: true }; },
    abrirIssue: async (titulo) => { criarIssueChamadas++; return { numero: 1, titulo }; },
    fecharIssue: async () => ({ fechada: true }),
    listarIssues: async () => [],
  });

  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });

  assert.strictEqual(rollbackChamadas, 1);
  assert.strictEqual(criarIssueChamadas, 1);
  assert.strictEqual(vigia.falhasConsecutivas['produto-falha'], 2);
});

test('quando volta ao normal, issue é fechada e contador zera', async () => {
  const vigia = novoVigia();
  let rollbackChamadas = 0;
  let criarIssueChamadas = 0;
  let fecharIssueChamadas = 0;

  vigia.setInjetaveis({
    fetch: async () => { throw new Error('falha simulada'); },
    rollback: async () => { rollbackChamadas++; return { sucesso: true }; },
    abrirIssue: async () => { criarIssueChamadas++; return { numero: 1 }; },
    fecharIssue: async () => { fecharIssueChamadas++; return { fechada: true }; },
    listarIssues: async () => [],
  });

  // 2 falhas seguidas
  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
  assert.strictEqual(criarIssueChamadas, 1);
  assert.strictEqual(vigia.falhasConsecutivas['produto-falha'], 2);

  // volta ao normal
  vigia.setInjetaveis({
    fetch: async () => ({ ok: true, status: 200 }),
    rollback: async () => { rollbackChamadas++; return { sucesso: true }; },
    abrirIssue: async () => { criarIssueChamadas++; return { numero: 1 }; },
    fecharIssue: async () => { fecharIssueChamadas++; return { fechada: true }; },
    listarIssues: async () => [],
  });

  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });

  assert.strictEqual(fecharIssueChamadas, 1);
  assert.strictEqual(vigia.falhasConsecutivas['produto-falha'], 0);
});

// 1 falha seguida de sucesso não deve deixar contador em 1 (na próxima falha não soma 2 indevidamente).
test('1 falha seguida de sucesso zera o contador', async () => {
  const vigia = novoVigia();
  let rollbackChamadas = 0;
  let criarIssueChamadas = 0;

  vigia.setInjetaveis({
    fetch: async () => { throw new Error('falha simulada'); },
    rollback: async () => { rollbackChamadas++; return { sucesso: true }; },
    abrirIssue: async () => { criarIssueChamadas++; return { numero: 1 }; },
    fecharIssue: async () => ({ fechada: true }),
    listarIssues: async () => [],
  });

  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
  assert.strictEqual(vigia.falhasConsecutivas['produto-falha'], 1);
  assert.strictEqual(rollbackChamadas, 0);
  assert.strictEqual(criarIssueChamadas, 0);

  vigia.setInjetaveis({
    fetch: async () => ({ ok: true, status: 200 }),
    rollback: async () => { rollbackChamadas++; return { sucesso: true }; },
    abrirIssue: async () => { criarIssueChamadas++; return { numero: 1 }; },
    fecharIssue: async () => ({ fechada: true }),
    listarIssues: async () => [],
  });

  await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
  assert.strictEqual(vigia.falhasConsecutivas['produto-falha'], 0);
  assert.strictEqual(rollbackChamadas, 0);
  assert.strictEqual(criarIssueChamadas, 0);
});
