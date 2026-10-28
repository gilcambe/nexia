'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../../netlify/functions/viagem');

function makeDbMock() {
  const collections = {};

  function getCol(path) {
    if (!collections[path]) {
      collections[path] = new Map();
    }
    return collections[path];
  }

  return {
    collections,
    collection: (colName) => {
      return {
        doc: (docId) => {
          const docPath = `${colName}/${docId}`;
          return {
            set: async (data, opts) => {
              const current = collections[docPath] || {};
              collections[docPath] = opts && opts.merge ? { ...current, ...data } : data;
            },
            collection: (subColName) => {
              const subPath = `${docPath}/${subColName}`;
              const store = getCol(subPath);
              return {
                where: (field, op, val) => {
                  let items = Array.from(store.entries()).map(([id, d]) => ({ id, ref: { path: `${subPath}/${id}` }, data: () => d }));
                  if (op === '==') items = items.filter(i => i.data()[field] === val);
                  if (op === '>') items = items.filter(i => i.data()[field] > val);

                  return {
                    limit: (l) => ({
                      get: async () => {
                        const sliced = items.slice(0, l);
                        return {
                          empty: sliced.length === 0,
                          docs: sliced,
                        };
                      }
                    }),
                    get: async () => ({ empty: items.length === 0, docs: items })
                  };
                },
                orderBy: (field, dir) => ({
                  where: (f, op, val) => ({
                    limit: (l) => ({
                      get: async () => {
                        let items = Array.from(store.entries()).map(([id, d]) => ({ id, data: () => d }));
                        items = items.filter(i => i.data()[f] > val);
                        return { docs: items.slice(0, l) };
                      }
                    })
                  }),
                  limit: (l) => ({
                    get: async () => {
                      let items = Array.from(store.entries()).map(([id, d]) => ({ id, data: () => d }));
                      return { docs: items.slice(0, l) };
                    }
                  })
                }),
                add: async (data) => {
                  const id = 'msg_' + Math.random().toString(36).slice(2, 9);
                  store.set(id, data);
                  return { id };
                },
                get: async () => {
                  const docs = Array.from(store.entries()).map(([id, d]) => ({ id, data: () => d }));
                  return { docs };
                }
              };
            }
          };
        },
        limit: (l) => ({
          get: async () => {
            const keys = Object.keys(collections).filter(k => {
              if (!k.startsWith(colName + '/')) return false;
              const rest = k.slice(colName.length + 1);
              return !rest.includes('/');
            });
            const docs = keys.map(k => {
              const id = k.slice(colName.length + 1);
              return {
                id,
                data: () => collections[k],
                ref: {
                  collection: (sub) => {
                    const subPath = `${k}/${sub}`;
                    const store = getCol(subPath);
                    return {
                      get: async () => ({
                        docs: Array.from(store.entries()).map(([subId, d]) => ({ id: subId, data: () => d }))
                      })
                    };
                  }
                }
              };
            });
            return { docs: docs.slice(0, l) };
          }
        })
      };
    },
    batch: () => ({
      update: () => {},
      commit: async () => {}
    })
  };
}

test('VIAGEM 1. Enviar mensagem e de-duplicar por id_local', async () => {
  const db = makeDbMock();
  const handler = createHandler({ getDb: () => db, now: () => 1700000000000 });

  // Primeira mensagem do cliente
  const req1 = {
    httpMethod: 'POST',
    body: JSON.stringify({
      acao: 'msg_enviar',
      viagem_id: 'v123',
      de: 'cliente',
      texto: 'Socorro, perdi a chave!',
      id_local: 'local_001'
    })
  };

  const res1 = await handler(req1);
  assert.equal(res1.statusCode, 201);
  const body1 = JSON.parse(res1.body);
  assert.equal(body1.ok, true);
  assert.equal(body1.msg.texto, 'Socorro, perdi a chave!');

  // Reenvio com o mesmo id_local não pode duplicar
  const req2 = {
    httpMethod: 'POST',
    body: JSON.stringify({
      acao: 'msg_enviar',
      viagem_id: 'v123',
      de: 'cliente',
      texto: 'Socorro, perdi a chave!',
      id_local: 'local_001'
    })
  };

  const res2 = await handler(req2);
  assert.equal(res2.statusCode, 200);
  const body2 = JSON.parse(res2.body);
  assert.equal(body2.duplicada, true);
});

test('VIAGEM 2. Listar mensagens da viagem', async () => {
  const db = makeDbMock();
  const handler = createHandler({ getDb: () => db });

  await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'msg_enviar', viagem_id: 'v123', de: 'cliente', texto: 'Oi agência', id_local: 'loc_1' })
  });

  await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'msg_enviar', viagem_id: 'v123', de: 'equipe', texto: 'Olá, em que podemos ajudar?', id_local: 'loc_2' })
  });

  const res = await handler({
    httpMethod: 'GET',
    queryStringParameters: { acao: 'msg_listar', viagem_id: 'v123' }
  });

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.mensagens.length, 2);
});

test('VIAGEM 3. Listar conversas para o painel da agência', async () => {
  const db = makeDbMock();
  const handler = createHandler({ getDb: () => db });

  await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'msg_enviar', viagem_id: 'v999', de: 'cliente', texto: 'Preciso de transfer', id_local: 'loc_9' })
  });

  const res = await handler({
    httpMethod: 'GET',
    queryStringParameters: { acao: 'conversas_listar' }
  });

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.conversas.length, 1);
  assert.equal(body.conversas[0].viagem_id, 'v999');
  assert.equal(body.conversas[0].nao_lidas, 1);
});
