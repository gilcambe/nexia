'use strict';
// prs-repetidos: decidir fecha PRs repetidos da mesma issue, mantendo o mais novo com CI verde.
// Roda com node --test (não Jest).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// --- Mock do @octokit/rest ANTES de importar prs-repetidos ---
const chamadas = { list: [], update: [], createComment: [] };

const octokitMock = {
  pulls: {
    list: async () => {
      chamadas.list.push('list');
      return { data: [] };
    },
    update: async (params) => {
      chamadas.update.push(params);
      return { data: {} };
    },
  },
  issues: {
    createComment: async (params) => {
      chamadas.createComment.push(params);
      return { data: {} };
    },
  },
};

class OctokitMock {
  constructor() { return octokitMock; }
}

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@octokit/rest') {
    return { Octokit: OctokitMock };
  }
  return originalLoad.apply(this, arguments);
};

const { decidir, rodar } = require('../../scripts/prs-repetidos');

Module._load = originalLoad;

const AGORA = Date.parse('2026-10-25T18:00:00Z');

const pr = (number, title, createdAt, ciStatus, labels = []) => ({
  number,
  title,
  createdAt,
  ciStatus,
  labels: labels.map(name => ({ name }))
});

test('PR1. decidir: 6 PRs da issue #2248 fecha 5 mantendo o mais novo com CI verde', () => {
  const prs = [
    pr(101, 'correção #2248', '2026-10-20T10:00:00Z', 'failure'),
    pr(102, 'correção #2248', '2026-10-21T10:00:00Z', 'failure'),
    pr(103, 'correção #2248', '2026-10-22T10:00:00Z', 'pending'),
    pr(104, 'correção #2248', '2026-10-23T10:00:00Z', 'failure'),
    pr(105, 'correção #2248', '2026-10-24T10:00:00Z', 'success'), // mais novo + CI verde = mantido
    pr(106, 'correção #2248', '2026-10-19T10:00:00Z', 'success'), // CI verde mas mais velho
  ];

  const fechar = decidir(prs, AGORA);

  assert.equal(fechar.length, 5, 'deve fechar exatamente 5 PRs');
  const numeros = fechar.map(p => p.number).sort((a, b) => a - b);
  assert.deepEqual(numeros, [101, 102, 103, 104, 106]);
  assert.ok(!fechar.some(p => p.number === 105), 'o mais novo com CI verde deve ser mantido');
});

test('PR2. decidir: PR com CI vermelho >48h entra no fechamento quando há outro PR da mesma issue', () => {
  const haCinquentaHoras = new Date(AGORA - 50 * 60 * 60 * 1000).toISOString();

  const prs = [
    pr(201, 'tarefa #2248', haCinquentaHoras, 'failure'), // CI vermelho >48h
    pr(202, 'tarefa #2248', '2026-10-25T17:00:00Z', 'success'), // mais novo, mantido
  ];

  const fechar = decidir(prs, AGORA);

  assert.equal(fechar.length, 1, 'o PR com CI vermelho >48h deve ser fechado');
  assert.equal(fechar[0].number, 201);
});

test('PR3. rodar: chama fechamentos esperados (update closed + createComment)', async () => {
  // Resetar chamadas
  chamadas.update.length = 0;
  chamadas.createComment.length = 0;
  chamadas.list.length = 0;

  const haCinquentaHoras = new Date(AGORA - 50 * 60 * 60 * 1000).toISOString();

  octokitMock.pulls.list = async () => {
    chamadas.list.push('list');
    return {
      data: [
        {
          number: 301,
          title: 'correção #2248',
          created_at: '2026-10-20T10:00:00Z',
          mergeable_state: 'failure',
          labels: [],
        },
        {
          number: 302,
          title: 'correção #2248',
          created_at: '2026-10-24T10:00:00Z',
          mergeable_state: 'success',
          labels: [],
        },
        {
          number: 303,
          title: 'outra coisa #999',
          created_at: '2026-10-24T10:00:00Z',
          mergeable_state: 'success',
          labels: [],
        },
      ],
    };
  };

  const fechados = await rodar();

  assert.equal(fechados, 1, 'deve fechar exatamente 1 PR (o 301, CI vermelho >48h)');
  assert.equal(chamadas.update.length, 1, 'deve chamar update uma vez');
  assert.equal(chamadas.createComment.length, 1, 'deve criar 1 comentário');

  const upd = chamadas.update[0];
  assert.equal(upd.state, 'closed');
  assert.equal(upd.pull_number, 301);

  const cmt = chamadas.createComment[0];
  assert.equal(cmt.issue_number, 301);
  assert.ok(cmt.body.includes('fechado automaticamente'));
});
