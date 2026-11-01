'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, limparConteudoViajante } = require('../../netlify/functions/viajante-pro');
const { VIAJANTE_PRO, getViagens, criarViagem, editarViagem, excluirViagem, getChats, enviarChat } = require('../../clientes/viajantepro');
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

test('Viajante Pro Backend — Rotas CRUD de Viagens', async () => {
  // Mock do Firestore para viagens
  const mockViagem = {
    id: 'viagem123',
    nome: 'Viagem Teste',
    destino: 'Paris',
    datas: { inicio: '2024-01-01', fim: '2024-01-10' },
    passageiros: [{ nome: 'João', tipo: 'adulto' }],
    roteiro: [{ dia: 1, descricao: 'Chegada em Paris' }],
    codigoSecreto: 'abc123def456',
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };

  globalThis.__NEXIA_FIRESTORE_MOCK__ = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({}) }),
        collection: () => ({
          doc: () => ({
            set: async () => {},
            update: async () => {},
            delete: async () => {},
          }),
          get: async () => ({
            docs: [{ data: () => mockViagem }],
            empty: false,
          }),
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [{ data: () => mockViagem }],
            }),
          }),
        }),
      }),
    }),
  };

  // Criar viagem
  const resCriar = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({
      acao: 'viagem-criar',
      token: 'mock-token',
      nome: 'Viagem Teste',
      destino: 'Paris',
      datas: { inicio: '2024-01-01', fim: '2024-01-10' },
      passageiros: [{ nome: 'João', tipo: 'adulto' }],
      roteiro: [{ dia: 1, descricao: 'Chegada em Paris' }],
    }),
  }, {});
  assert.equal(resCriar.statusCode, 200);
  const bodyCriar = JSON.parse(resCriar.body);
  assert.equal(bodyCriar.ok, true);
  assert.ok(bodyCriar.id);
  assert.ok(bodyCriar.link);

  // Listar viagens
  const resListar = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({ acao: 'viagem-listar', token: 'mock-token' }),
  }, {});
  assert.equal(resListar.statusCode, 200);
  const bodyListar = JSON.parse(resListar.body);
  assert.equal(bodyListar.ok, true);
  assert.equal(Array.isArray(bodyListar.viagens), true);

  // Editar viagem
  const resEditar = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({
      acao: 'viagem-editar',
      token: 'mock-token',
      id: 'viagem123',
      nome: 'Viagem Atualizada',
      destino: 'Londres',
    }),
  }, {});
  assert.equal(resEditar.statusCode, 200);
  const bodyEditar = JSON.parse(resEditar.body);
  assert.equal(bodyEditar.ok, true);
  assert.equal(bodyEditar.viagem.nome, 'Viagem Atualizada');
  assert.equal(bodyEditar.viagem.destino, 'Londres');

  // Excluir viagem
  const resExcluir = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({
      acao: 'viagem-excluir',
      token: 'mock-token',
      id: 'viagem123',
    }),
  }, {});
  assert.equal(resExcluir.statusCode, 200);
  const bodyExcluir = JSON.parse(resExcluir.body);
  assert.equal(bodyExcluir.ok, true);
  assert.equal(bodyExcluir.id, 'viagem123');
});

test('Viajante Pro Backend — Rotas de Chat', async () => {
  // Mock do Firestore para chat
  const mockMensagem = {
    id: 'msg123',
    autor: 'passageiro',
    texto: 'Olá, tudo bem?',
    lida: false,
    criado_em: new Date().toISOString(),
  };

  globalThis.__NEXIA_FIRESTORE_MOCK__ = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({}) }),
        collection: () => ({
          doc: () => ({
            set: async () => {},
          }),
          get: async () => ({
            docs: [{ data: () => mockMensagem }],
            empty: false,
          }),
          orderBy: () => ({
            startAfter: () => ({
              get: async () => ({
                docs: [{ data: () => mockMensagem }],
                empty: false,
              }),
            }),
            limit: () => ({
              get: async () => ({
                docs: [{ data: () => mockMensagem }],
                empty: false,
              }),
            }),
          }),
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [{ data: () => mockMensagem }],
            }),
          }),
        }),
      }),
    }),
  };

  // Enviar mensagem
  const resEnviar = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({
      acao: 'chat-enviar',
      token: 'mock-token',
      v: 'viagem123',
      texto: 'Olá, tudo bem?',
      autor: 'passageiro',
    }),
  }, {});
  assert.equal(resEnviar.statusCode, 200);
  const bodyEnviar = JSON.parse(resEnviar.body);
  assert.equal(bodyEnviar.ok, true);
  assert.equal(bodyEnviar.mensagem.autor, 'passageiro');
  assert.equal(bodyEnviar.mensagem.texto, 'Olá, tudo bem?');

  // Listar mensagens
  const resListarMsg = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({
      acao: 'chat-listar',
      token: 'mock-token',
      v: 'viagem123',
    }),
  }, {});
  assert.equal(resListarMsg.statusCode, 200);
  const bodyListarMsg = JSON.parse(resListarMsg.body);
  assert.equal(bodyListarMsg.ok, true);
  assert.equal(Array.isArray(bodyListarMsg.mensagens), true);
  assert.equal(bodyListarMsg.mensagens[0].texto, 'Olá, tudo bem?');

  // Listar conversas
  const resConversas = await handler({
    httpMethod: 'POST',
    queryStringParameters: { site: 'viajantepro' },
    body: JSON.stringify({
      acao: 'chat-conversas',
      token: 'mock-token',
    }),
  }, {});
  assert.equal(resConversas.statusCode, 200);
  const bodyConversas = JSON.parse(resConversas.body);
  assert.equal(bodyConversas.ok, true);
  assert.equal(Array.isArray(bodyConversas.conversas), true);
  assert.equal(bodyConversas.conversas[0].viagemNome, 'Viagem Teste');
});

test('Viajante Pro Cliente — Funções do Passageiro', async () => {
  // Mock do localStorage para token
  globalThis.localStorage = {
    getItem: () => 'mock-token',
    setItem: () => {},
  };

  // Mock do fetch para as chamadas da API
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ ok: true, data: 'success' }),
    })
  );

  // Testar getViagens
  const viagens = await getViagens();
  assert.ok(viagens);

  // Testar criarViagem
  const viagemCriada = await criarViagem({
    nome: 'Viagem Teste',
    destino: 'Paris',
  });
  assert.ok(viagemCriada);

  // Testar editarViagem
  const viagemEditada = await editarViagem('viagem123', {
    nome: 'Viagem Atualizada',
  });
  assert.ok(viagemEditada);

  // Testar excluirViagem
  const viagemExcluida = await excluirViagem('viagem123');
  assert.ok(viagemExcluida);

  // Testar getChats
  const chats = await getChats();
  assert.ok(chats);

  // Testar enviarChat
  const chatEnviado = await enviarChat({
    v: 'viagem123',
    texto: 'Teste de mensagem',
  });
  assert.ok(chatEnviado);

  // Verificar se o fetch foi chamado com os parâmetros corretos
  expect(fetch).toHaveBeenCalledWith('https://api.viajantepro.com.br/viagens', {
    headers: {
      'Authorization': 'Bearer mock-token',
    },
  });
});

// Importar o mock para os testes
const { jest } = require('jest');
