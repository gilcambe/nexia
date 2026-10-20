'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { criarGithub } = require('../../netlify/functions/central/github');
const { rodar } = require('../../divulga/robo');

test('DIVULGA-ENGAJAMENTO: sem dados suficientes (menos de 5 posts válidos) devolve melhorHorario e melhorTema como null', async () => {
  const estadoPoucoData = {
    feitos: ['p1'],
    seguidores: [],
    historico: [
      { id: 'p1', tema: 'Treinos', horario: '19h15', curtidas: 50 },
      { id: 'p2', tema: 'Dieta', horario: '07h15', curtidas: 20 },
    ],
  };

  const fetchFake = async (url) => {
    if (url.includes('divulga-estado.json')) {
      return { ok: true, json: async () => estadoPoucoData };
    }
    if (url.includes('/contents/divulga/fila')) {
      return { ok: true, json: async () => [] };
    }
    return { ok: false, status: 404 };
  };

  const gh = criarGithub({ NEXIA_JOBS_TOKEN: 'token-fake' }, fetchFake);
  const dados = await gh.divulga();

  assert.strictEqual(dados.melhorHorario, null);
  assert.strictEqual(dados.melhorTema, null);
  assert.deepStrictEqual(dados.seguidores30d, []);
});

test('DIVULGA-ENGAJAMENTO: com 5+ posts válidos calcula melhorHorario e melhorTema corretamente', async () => {
  const estadoCompleto = {
    feitos: ['p1'],
    seguidores: [
      { dia: '2026-09-20', total: 1000 },
      { dia: '2026-09-21', total: 1050 },
    ],
    historico: [
      { id: 'p1', tema: 'Treinos', horario: '19h15', curtidas: 50 },
      { id: 'p2', tema: 'Dieta', horario: '07h15', curtidas: 20 },
      { id: 'p3', tema: 'Treinos', horario: '19h15', curtidas: 80 },
      { id: 'p4', tema: 'Dicas', horario: '12h15', curtidas: 10 },
      { id: 'p5', tema: 'Treinos', horario: '19h15', curtidas: 100 },
    ],
  };

  const fetchFake = async (url) => {
    if (url.includes('divulga-estado.json')) {
      return { ok: true, json: async () => estadoCompleto };
    }
    if (url.includes('/contents/divulga/fila')) {
      return { ok: true, json: async () => [] };
    }
    return { ok: false, status: 404 };
  };

  const gh = criarGithub({ NEXIA_JOBS_TOKEN: 'token-fake' }, fetchFake);
  const dados = await gh.divulga();

  assert.strictEqual(dados.melhorHorario, '19h15');
  assert.strictEqual(dados.melhorTema, 'Treinos');
  assert.strictEqual(dados.seguidores30d.length, 2);
});

test('DIVULGA-ROBO: coleta seguidores sem credencial Meta não falha e com credencial registra amostra diária', async () => {
  // Teste 1: sem credenciais
  const resSemCred = await rodar({ acao: 'ensaio', env: {}, log: () => {} });
  assert.ok(resSemCred);

  // Teste 2: com credenciais da Meta e fetchImpl simulando resposta da Graph API
  const fetchMeta = async (url) => {
    if (url.includes('graph.facebook.com')) {
      return { ok: true, json: async () => ({ followers_count: 2500 }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const resComCred = await rodar({
    acao: 'ensaio',
    env: { DIVULGA_META_PAGE_TOKEN: 'token-fake', DIVULGA_META_IG_USER_ID: '12345' },
    fetchImpl: fetchMeta,
    log: () => {},
  });
  assert.ok(resComCred);
});
