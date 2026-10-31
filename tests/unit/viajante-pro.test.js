'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, limparConteudoViajante } = require('../../netlify/functions/viajante-pro');
const { VIAJANTE_PRO } = require('../../clientes/viajantepro');
const { API_ROUTES, TENANT_PAGES } = require('../../lib/routes');

test('Viajante Pro Backend — Sanitização de Conteúdo CMS', () => {
  const bruto = {
    hero: {
      titulo: '   Título Teste   ',
      subtitulo: 'Subtítulo',
      extra_invalido: 'hack',
    },
    destinos: [
      {
        nome: 'Fernando de Noronha',
        pais: 'Brasil',
        categoria: 'Praias & Resorts',
        preco: 'R$ 4.000',
        destaque: true,
      },
    ],
  };

  const limpo = limparConteudoViajante(bruto);
  assert.equal(limpo.hero.titulo, 'Título Teste');
  assert.equal(limpo.hero.extra_invalido, undefined);
  assert.equal(limpo.destinos.length, 1);
  assert.equal(limpo.destinos[0].nome, 'Fernando de Noronha');
  assert.equal(limpo.destinos[0].categoria, 'Praias & Resorts');
  assert.equal(limpo.destinos[0].destaque, true);
});

test('Viajante Pro Backend — Leitura Pública GET /api/viajante-pro', async () => {
  // Mock do Firestore na memória
  const mockDoc = {
    get: async () => ({
      exists: true,
      data: () => ({
        hero: { titulo: 'Viajante Pro' },
        pagamento: { chave_pix: '12345678000199', instrucoes: 'Instruções sigilosas' },
      }),
    }),
    collection: () => ({
      doc: () => mockDoc,
    }),
  };

  globalThis.__NEXIA_FIRESTORE_MOCK__ = {
    collection: () => ({
      doc: () => mockDoc,
    }),
  };

  const evPublic = { httpMethod: 'GET', queryStringParameters: { site: 'viajantepro' } };
  const resPublic = await handler(evPublic, {});
  assert.equal(resPublic.statusCode, 200);

  const bodyPublic = JSON.parse(resPublic.body);
  assert.equal(bodyPublic.site, 'viajantepro');
  assert.equal(bodyPublic.conteudo.hero.titulo, 'Viajante Pro');
  // Chave Pix restrita deve ser oculta no GET público
  assert.equal(bodyPublic.conteudo.pagamento.chave_pix, 'Fornecida no momento da reserva');

  // Leitura com flag admin
  const evAdmin = { httpMethod: 'GET', queryStringParameters: { site: 'viajantepro', admin: '1' } };
  const resAdmin = await handler(evAdmin, {});
  const bodyAdmin = JSON.parse(resAdmin.body);
  assert.equal(bodyAdmin.conteudo.pagamento.chave_pix, '12345678000199');
});

test('Viajante Pro Backend — Login e Sessão Admin', async () => {
  // Mock do Firestore para login e sessões
  const docData = {
    nome: 'Viajante Pro',
    senha_hash: '0752321472aaccfe5e23961d97417d85e6b25587c15a30b6f71e8a2ac650a35c', // ADMIN01
    senha_salt: 'd3451e7f34a8549290d4cda5b069c80b',
  };

  globalThis.__NEXIA_FIRESTORE_MOCK__ = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => docData }),
        collection: () => ({
          doc: () => ({
            set: async () => {},
          }),
        }),
      }),
    }),
  };

  // Login com senha incorreta
  const resErr = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({ acao: 'entrar', senha: 'SENHA_ERRADA' }),
  }, {});
  assert.equal(resErr.statusCode, 401);

  // Login com senha correta (ADMIN01)
  const resOk = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({ acao: 'entrar', senha: 'ADMIN01' }),
  }, {});
  assert.equal(resOk.statusCode, 200);

  const bodyOk = JSON.parse(resOk.body);
  assert.equal(bodyOk.ok, true);
  assert.ok(bodyOk.token);
});

test('Viajante Pro Config & Rotas — Registros em lib/routes.js e clientes/viajantepro.js', () => {
  assert.equal(API_ROUTES['/api/viajante-pro'], 'viajante-pro');
  assert.equal(TENANT_PAGES['/viajante-pro'][1], 'vp-landing.html');
  assert.equal(TENANT_PAGES['/vp/admin'][1], 'vp-admin.html');
  assert.equal(TENANT_PAGES['/viajante-pro/app'][1], 'index.html');
  assert.ok(VIAJANTE_PRO.viajantepro);
});
