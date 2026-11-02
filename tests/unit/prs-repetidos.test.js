'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// Interceptar require('@octokit/rest') para mock caso a biblioteca não esteja instalada
let mockPullsListResponse = [];
let mockPullsUpdateCalls = [];
let mockIssuesCreateCommentCalls = [];

class MockOctokit {
  constructor(opts) {
    this.opts = opts;
  }

  get pulls() {
    return {
      list: async (params) => {
        return { data: mockPullsListResponse };
      },
      update: async (params) => {
        mockPullsUpdateCalls.push(params);
        return { data: params };
      },
    };
  }

  get issues() {
    return {
      createComment: async (params) => {
        mockIssuesCreateCommentCalls.push(params);
        return { data: params };
      },
    };
  }
}

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path) {
  if (path === '@octokit/rest') {
    return { Octokit: MockOctokit };
  }
  return originalRequire.apply(this, arguments);
};

// Carregar módulo testado
const { decidir, rodar } = require('../../scripts/prs-repetidos');

// Restaurar require para evitar vazamento entre suítes de teste
Module.prototype.require = originalRequire;

test('decidir: 6 PRs da issue #2248 mantém o mais novo com CI verde e fecha 5', () => {
  const agora = new Date('2026-11-02T12:00:00Z');

  const prs = [
    {
      number: 101,
      title: 'Fix issue #2248 parte 1',
      createdAt: '2026-11-01T08:00:00Z',
      ciStatus: 'failure',
      labels: [],
    },
    {
      number: 102,
      title: 'Fix issue #2248 parte 2',
      createdAt: '2026-11-01T10:00:00Z',
      ciStatus: 'pending',
      labels: [],
    },
    {
      number: 103,
      title: 'Fix issue #2248 tentativa anterior verde',
      createdAt: '2026-11-01T12:00:00Z',
      ciStatus: 'success',
      labels: [],
    },
    {
      number: 104,
      title: 'Fix issue #2248 tentativa recente verde',
      createdAt: '2026-11-02T08:00:00Z',
      ciStatus: 'success',
      labels: [],
    },
    {
      number: 105,
      title: 'Fix issue #2248 tentativa nova pendente',
      createdAt: '2026-11-02T09:00:00Z',
      ciStatus: 'pending',
      labels: [],
    },
    {
      number: 106,
      title: 'Fix issue #2248 tentativa nova falha',
      createdAt: '2026-11-02T10:00:00Z',
      ciStatus: 'failure',
      labels: [],
    },
  ];

  const fechar = decidir(prs, agora);

  assert.equal(fechar.length, 5);
  // O PR 104 é o mais recente com CI verde (success), logo deve ser mantido
  assert.ok(!fechar.some(pr => pr.number === 104));

  const numerosFechados = fechar.map(pr => pr.number);
  assert.deepStrictEqual(numerosFechados.sort(), [101, 102, 103, 105, 106]);
});

test('decidir: PR com CI vermelho >48h é fechado quando há PR mais recente', () => {
  const agora = new Date('2026-11-04T12:00:00Z');

  const prs = [
    {
      number: 201,
      title: 'Solução #2248 antiga falhou',
      createdAt: '2026-11-01T10:00:00Z', // > 72h atrás
      ciStatus: 'failure',
      labels: [],
    },
    {
      number: 202,
      title: 'Solução #2248 nova verde',
      createdAt: '2026-11-04T10:00:00Z',
      ciStatus: 'success',
      labels: [],
    },
  ];

  const fechar = decidir(prs, agora);

  assert.equal(fechar.length, 1);
  assert.equal(fechar[0].number, 201);
});

test('decidir: ignora PRs que possuem rótulos de exceção nao-fechar ou manter', () => {
  const agora = new Date('2026-11-02T12:00:00Z');

  const prs = [
    {
      number: 301,
      title: 'PR protegido #2248',
      createdAt: '2026-11-01T10:00:00Z',
      ciStatus: 'failure',
      labels: [{ name: 'nao-fechar' }],
    },
    {
      number: 302,
      title: 'PR manual #2248',
      createdAt: '2026-11-01T11:00:00Z',
      ciStatus: 'pending',
      labels: [{ name: 'manter' }],
    },
    {
      number: 303,
      title: 'PR normal #2248',
      createdAt: '2026-11-01T12:00:00Z',
      ciStatus: 'failure',
      labels: [],
    },
    {
      number: 304,
      title: 'PR vencedor #2248',
      createdAt: '2026-11-02T10:00:00Z',
      ciStatus: 'success',
      labels: [],
    },
  ];

  const fechar = decidir(prs, agora);

  // Apenas o 303 deve ser fechado, pois 301 e 302 têm rótulo de exceção e 304 é o mantido
  assert.equal(fechar.length, 1);
  assert.equal(fechar[0].number, 303);
});

test('decidir: limita fechamentos a 15 por rodada', () => {
  const agora = new Date('2026-11-02T12:00:00Z');
  const prs = [];

  for (let i = 1; i <= 20; i++) {
    prs.push({
      number: 400 + i,
      title: 'PR extra #2248',
      createdAt: new Date(agora.getTime() - i * 3600000).toISOString(),
      ciStatus: i === 1 ? 'success' : 'failure',
      labels: [],
    });
  }

  const fechar = decidir(prs, agora);
  assert.equal(fechar.length, 15);
});

test('rodar: busca PRs via Octokit, fecha PRs repetidos e insere comentários', async () => {
  mockPullsUpdateCalls = [];
  mockIssuesCreateCommentCalls = [];

  mockPullsListResponse = [
    {
      number: 501,
      title: 'Implementação #2248 v1',
      created_at: '2026-11-01T10:00:00Z',
      mergeable_state: 'failure',
      labels: [],
    },
    {
      number: 502,
      title: 'Implementação #2248 v2',
      created_at: '2026-11-02T10:00:00Z',
      mergeable_state: 'success',
      labels: [],
    },
  ];

  const totalFechados = await rodar();

  assert.equal(totalFechados, 1);
  assert.equal(mockPullsUpdateCalls.length, 1);
  assert.equal(mockPullsUpdateCalls[0].pull_number, 501);
  assert.equal(mockPullsUpdateCalls[0].state, 'closed');

  assert.equal(mockIssuesCreateCommentCalls.length, 1);
  assert.equal(mockIssuesCreateCommentCalls[0].issue_number, 501);
  assert.ok(mockIssuesCreateCommentCalls[0].body.includes('Este PR foi fechado automaticamente'));
});
