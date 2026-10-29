'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createHandler, COLLECTION, hashSenha } = require('../../netlify/functions/viagem.js');

// Helper Firestore Mock em memória
function criarDbMock() {
  const dados = new Map();

  function getRef(path) {
    return {
      path,
      get: async () => {
        const val = dados.get(path);
        return {
          exists: val !== undefined,
          id: path.split('/').pop(),
          data: () => val,
        };
      },
      set: async (val, opts) => {
        if (opts && opts.merge && dados.has(path)) {
          dados.set(path, { ...dados.get(path), ...val });
        } else {
          dados.set(path, val);
        }
      },
      update: async (val) => {
        const at = dados.get(path) || {};
        dados.set(path, { ...at, ...val });
      },
      delete: async () => {
        dados.delete(path);
      },
      collection: (subName) => criarColMock(`${path}/${subName}`),
    };
  }

  function criarColMock(colPath) {
    return {
      doc: (docId) => {
        const id = docId || ('doc_' + Math.random().toString(36).slice(2, 10));
        return getRef(`${colPath}/${id}`);
      },
      get: async () => {
        const prefix = `${colPath}/`;
        const docs = [];
        for (const [k, v] of dados.entries()) {
          if (k.startsWith(prefix) && k.slice(prefix.length).indexOf('/') === -1) {
            docs.push({
              id: k.slice(prefix.length),
              data: () => v,
            });
          }
        }
        return { docs };
      },
    };
  }

  return {
    collection: (colName) => criarColMock(colName),
    _dados: dados,
  };
}

test('VIAGEM1. Rotas públicas: lead_criar e app_obter', async () => {
  const db = criarDbMock();
  const handler = createHandler({ getDb: () => db });

  // lead_criar
  const resLeadErr = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', acao: 'lead_criar', nome: '' }),
  });
  assert.strictEqual(resLeadErr.statusCode, 400);

  const resLeadOk = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      site: 'viajante-pro',
      acao: 'lead_criar',
      nome: 'Carlos Silva',
      email: 'carlos@example.com',
      whatsapp: '11999998888',
      mensagem: 'Tenho interesse na viagem para Cancun',
      destino: 'Cancun',
    }),
  });
  assert.strictEqual(resLeadOk.statusCode, 201);
  const bodyLead = JSON.parse(resLeadOk.body);
  assert.strictEqual(bodyLead.ok, true);
  assert.strictEqual(bodyLead.lead.nome, 'Carlos Silva');

  // app_obter
  const resApp = await handler({
    httpMethod: 'GET',
    queryStringParameters: { site: 'viajante-pro' },
  });
  assert.strictEqual(resApp.statusCode, 200);
  const bodyApp = JSON.parse(resApp.body);
  assert.strictEqual(bodyApp.ok, true);
  assert.ok(bodyApp.app.nome);
});

test('VIAGEM2. Autenticação (login e sair)', async () => {
  const db = criarDbMock();
  const salt = 'salt123';
  const hash = await hashSenha('senha123', salt);
  await db.collection(COLLECTION).doc('viajante-pro').set({
    senha_hash: hash,
    senha_salt: salt,
  });

  const handler = createHandler({ getDb: () => db });

  // Login incorreto
  const resLoginErr = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', acao: 'login', senha: 'errada' }),
  });
  assert.strictEqual(resLoginErr.statusCode, 401);

  // Login correto
  const resLoginOk = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', acao: 'login', senha: 'senha123' }),
  });
  assert.strictEqual(resLoginOk.statusCode, 200);
  const bodyLogin = JSON.parse(resLoginOk.body);
  assert.strictEqual(bodyLogin.ok, true);
  assert.ok(bodyLogin.token);

  // Sair
  const resSair = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', acao: 'sair', token: bodyLogin.token }),
  });
  assert.strictEqual(resSair.statusCode, 200);

  // Ação com token antigo inválido
  const resPrivada = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', acao: 'cliente_listar', token: bodyLogin.token }),
  });
  assert.strictEqual(resPrivada.statusCode, 401);
});

test('VIAGEM3. Gestão de Clientes e Viagens (CRUD de Equipe)', async () => {
  const db = criarDbMock();
  const salt = 'salt123';
  const hash = await hashSenha('senha123', salt);
  await db.collection(COLLECTION).doc('viajante-pro').set({
    senha_hash: hash,
    senha_salt: salt,
  });

  const handler = createHandler({ getDb: () => db });

  // Realizar login para obter token
  const resLogin = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', acao: 'login', senha: 'senha123' }),
  });
  const token = JSON.parse(resLogin.body).token;

  // 1. Cliente Salvar
  const resCliSalvar = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      site: 'viajante-pro',
      token,
      acao: 'cliente_salvar',
      cliente: { nome: 'Maria Souza', email: 'maria@example.com', whatsapp: '11988887777', doc: '12345678900' },
    }),
  });
  assert.strictEqual(resCliSalvar.statusCode, 200);
  const cliId = JSON.parse(resCliSalvar.body).id;

  // 2. Cliente Listar
  const resCliListar = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', token, acao: 'cliente_listar' }),
  });
  assert.strictEqual(resCliListar.statusCode, 200);
  const clientes = JSON.parse(resCliListar.body).clientes;
  assert.strictEqual(clientes.length, 1);
  assert.strictEqual(clientes[0].nome, 'Maria Souza');

  // 3. Viagem Salvar
  const resVigSalvar = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      site: 'viajante-pro',
      token,
      acao: 'viagem_salvar',
      viagem: {
        titulo: 'Missão Las Vegas 2026',
        destino: 'Las Vegas, EUA',
        data_saida: '2026-05-10',
        data_retorno: '2026-05-18',
        vagas: 20,
        valor: 15000,
      },
    }),
  });
  assert.strictEqual(resVigSalvar.statusCode, 200);
  const vigId = JSON.parse(resVigSalvar.body).id;

  // 4. Viagem Obter
  const resVigObter = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', token, acao: 'viagem_obter', id: vigId }),
  });
  assert.strictEqual(resVigObter.statusCode, 200);
  assert.strictEqual(JSON.parse(resVigObter.body).viagem.titulo, 'Missão Las Vegas 2026');

  // 5. Viagem Gerar Novo Token
  const resVigToken = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', token, acao: 'viagem_novo_token', id: vigId }),
  });
  assert.strictEqual(resVigToken.statusCode, 200);
  assert.ok(JSON.parse(resVigToken.body).token);

  // 6. Leads Listar
  const resLeadsListar = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', token, acao: 'leads_listar' }),
  });
  assert.strictEqual(resLeadsListar.statusCode, 200);

  // 7. Cliente Apagar & Viagem Apagar
  const resCliApagar = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', token, acao: 'cliente_apagar', id: cliId }),
  });
  assert.strictEqual(resCliApagar.statusCode, 200);

  const resVigApagar = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ site: 'viajante-pro', token, acao: 'viagem_apagar', id: vigId }),
  });
  assert.strictEqual(resVigApagar.statusCode, 200);
});
