'use strict';
// Teste unitário: scripts/vigia-no-ar.js
// Simula falhas de saúde e valida: 1 falha não faz nada, 2 falhas disparam rollback + issue.

process.env.NO_AR_URLS = JSON.stringify([
  { id: 'produto-ok', url: 'https://produto-ok.pages.dev/' },
  { id: 'produto-falha', url: 'https://produto-falha.pages.dev/' },
]);
process.env.GITHUB_TOKEN = 'token-teste';
process.env.GITHUB_REPO = 'gilcambe/nexia';

let chamadasFetch = [];
let rollbackChamado = false;
let issueCriada = false;
let issueFechada = false;

global.fetch = async function (url, opts) {
  chamadasFetch.push({ url, opts });
  const falha = url.includes('produto-falha');
  if (falha) {
    const err = new Error('falha simulada');
    err.code = 'ENOTFOUND';
    throw err;
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
  };
};

// wangler/cloudflare e github são mockados abaixo (carregados depois do fetch)
const mockWrangler = { rollback: async () => { rollbackChamado = true; } };
const mockGitHub = {
  listIssues: async () => [],
  createIssue: async () => { issueCriada = true; return { number: 1 }; },
  closeIssue: async (number) => { issueFechada = true; },
};

jest.mock('child_process', () => ({ execSync: () => 'ok' }));

describe('vigia-no-ar', () => {
  let vigia;

  beforeEach(() => {
    chamadasFetch = [];
    rollbackChamado = false;
    issueCriada = false;
    issueFechada = false;
    jest.resetModules();
    vigia = require('../scripts/vigia-no-ar.js');
  });

  test('1 falha não dispara rollback nem issue', async () => {
    // produto-ok sempre ok; produto-falha falha na primeira tentativa apenas
    let tentativasFalha = 0;
    global.fetch = async function (url) {
      if (url.includes('produto-falha')) {
        tentativasFalha++;
        if (tentativasFalha === 1) {
          const err = new Error('falha simulada');
          err.code = 'ENOTFOUND';
          throw err;
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
    expect(rollbackChamado).toBe(false);
    expect(issueCriada).toBe(false);
    expect(vigia.falhasConsecutivas('produto-falha')).toBe(1);
  });

  test('2 falhas consecutivas disparam rollback e issue', async () => {
    global.fetch = async function (url) {
      if (url.includes('produto-falha')) {
        const err = new Error('falha simulada');
        err.code = 'ENOTFOUND';
        throw err;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
    await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
    expect(rollbackChamado).toBe(true);
    expect(issueCriada).toBe(true);
    expect(vigia.falhasConsecutivas('produto-falha')).toBe(2);
  });

  test('quando volta ao normal, issue é fechada', async () => {
    // primeira rodada: 2 falhas
    global.fetch = async function (url) {
      if (url.includes('produto-falha')) {
        const err = new Error('falha simulada');
        err.code = 'ENOTFOUND';
        throw err;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    await vigia.verificarTodos();
    await vigia.verificarTodos();
    expect(issueCriada).toBe(true);
    issueCriada = false;

    // segunda rodada: volta ao normal
    global.fetch = async function () {
      return { ok: true, status: 200, json: async () => ({}) };
    };
    await vigia.verificarSite({ id: 'produto-falha', site: 'https://produto-falha.pages.dev/' });
    expect(issueFechada).toBe(true);
    expect(vigia.falhasConsecutivas('produto-falha')).toBe(0);
  });
});
