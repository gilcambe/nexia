'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  registrarUsoBanco,
  getUsoBanco
} = require('../../lib/firebase-lite/firestore');
const {
  guardarUsoVault,
  obterUsoVault,
  historicoUsoVault
} = require('../../netlify/functions/central/saude-historico');

test('Alertas Sentinel e exibição de uso na Central', async (t) => {
  await t.test('emite alerta Sentinel quando ultrapassa 70%', (context) => {
    const warnLogs = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnLogs.push(args.join(' '));

    try {
      registrarUsoBanco('firestore-b', 36000, 0); // 72% do limite de 50.000
      assert.ok(warnLogs.some(log => log.includes('[SENTINEL ALERT] [sentinel]')));
    } finally {
      console.warn = origWarn;
    }
  });

  await t.test('Central saude-historico grava e obtém status de uso do cofre', async () => {
    const docs = new Map();
    const fakeDb = {
      collection(collName) {
        return {
          doc(id) {
            return {
              async get() {
                return { exists: docs.has(id), data: () => docs.get(id) };
              },
              async set(dados) {
                docs.set(id, dados);
              },
              async update(dados) {
                docs.set(id, { ...docs.get(id), ...dados });
              }
            };
          },
          where(field, op, val) {
            return {
              orderBy() {
                return {
                  async get() {
                    const match = [];
                    for (const [id, d] of docs.entries()) {
                      if (d[field] === val || d[field] >= val) {
                        match.push({ data: () => d });
                      }
                    }
                    return { docs: match };
                  }
                };
              }
            };
          }
        };
      }
    };

    const hoje = new Date().toISOString().slice(0, 10);
    const saveRes = await guardarUsoVault(fakeDb, {
      banco: 'firestore-b',
      leituras: 36000,
      escritas: 5000,
      percentualLeituras: 72.0,
      percentualEscritas: 25.0,
      status: 'quase cheio'
    }, hoje);

    assert.equal(saveRes.success, true);
    assert.equal(saveRes.banco, 'firestore-b');

    const statusCentral = await obterUsoVault(fakeDb, hoje);
    assert.equal(statusCentral.success, true);
    assert.ok(statusCentral.bancos['firestore-b']);
    assert.equal(statusCentral.bancos['firestore-b'].status, 'quase cheio');
    assert.equal(statusCentral.bancos['firestore-b'].leituras, 36000);

    const hist = await historicoUsoVault(fakeDb, 7);
    assert.equal(hist.success, true);
    assert.ok(hist.historico[hoje]['firestore-b']);
  });
});
