'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { criarGithub } = require('../../netlify/functions/central/github');

test('DIVULGA-ENGAJAMENTO: calcula seguidores dos 30d, melhor horário e melhor tema sem escrever em disco', async () => {
  const estadoFake = {
    feitos: ['p1'],
    seguidores: [
      { dia: '2026-09-20', total: 1000 },
      { dia: '2026-09-21', total: 1050 },
      { dia: '2026-10-20', total: 1200 },
    ],
    historico: [
      { id: 'p1', tema: 'Treinos', horario: '19h15', curtidas: 50 },
      { id: 'p2', tema: 'Dieta', horario: '07h15', curtidas: 20 },
      { id: 'p3', tema: 'Treinos', horario: '19h15', curtidas: 80 },
    ],
  };

  const fetchFake = async (url) => {
    if (url.includes('divulga-estado.json')) {
      return {
        ok: true,
        json: async () => estadoFake,
      };
    }
    if (url.includes('/contents/divulga/fila')) {
      return {
        ok: true,
        json: async () => [],
      };
    }
    return { ok: false, status: 404 };
  };

  const gh = criarGithub({ NEXIA_JOBS_TOKEN: 'token-fake' }, fetchFake);
  const dados = await gh.divulga();

  assert.strictEqual(dados.melhorHorario, '19h15');
  assert.strictEqual(dados.melhorTema, 'Treinos');
  assert.strictEqual(dados.seguidores30d.length, 3);
  assert.strictEqual(dados.seguidores30d[2].total, 1200);
});
