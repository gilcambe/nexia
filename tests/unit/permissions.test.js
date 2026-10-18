const { initializeTestApp, assertFails, assertSucceeds, loadFirestoreRules } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
const fs = require('fs');

const PROJECT_ID = 'nexia-audit-test';
const RULES_FILE = 'firestore.rules';

// Matriz de permissões por coleção e papel
const permissionMatrix = {
  alunos: {
    aluno: { read: true, write: false },
    coach: { read: true, write: false },
    dono: { read: true, write: true },
    anon: { read: false, write: false }
  },
  coaches: {
    aluno: { read: false, write: false },
    coach: { read: true, write: false },
    dono: { read: true, write: true },
    anon: { read: false, write: false }
  },
  donos: {
    aluno: { read: false, write: false },
    coach: { read: false, write: false },
    dono: { read: true, write: true },
    anon: { read: false, write: false }
  }
};

function getAuth(role) {
  if (role === 'anon') return null;
  // Firestore espera { uid, token: { ...claims } }
  return { uid: `${role}-uid`, token: { role } };
}

function getApp(role) {
  return initializeTestApp({ projectId: PROJECT_ID, auth: getAuth(role) });
}

// Documentos de teste criados pelo dono (escrita liberada em todas as coleções)
const testDocs = {};

describe('Regras de segurança do Firestore - matriz de permissões', () => {
  beforeAll(async () => {
    // Carrega as regras reais do projeto para validar conformidade
    await loadFirestoreRules({
      projectId: PROJECT_ID,
      rules: fs.readFileSync(RULES_FILE, 'utf8'),
    });

    const donoApp = getApp('dono');
    const donoDb = donoApp.firestore();
    for (const collection of Object.keys(permissionMatrix)) {
      const ref = donoDb.collection(collection).doc('test-doc');
      await assertSucceeds(ref.set({ foo: 'bar' }));
      testDocs[collection] = ref;
    }
  });

  afterAll(async () => {
    await Promise.all(require('@firebase/rules-unit-testing').apps().map(app => app.delete()));
  });

  Object.entries(permissionMatrix).forEach(([collection, roles]) => {
    Object.entries(roles).forEach(([role, perms]) => {
      const app = getApp(role);
      const db = app.firestore();
      const readRef = testDocs[collection];
      const writeRef = db.collection(collection).doc('test-doc');

      test(`${role} pode ler ${collection}: ${perms.read}`, async () => {
        if (perms.read) {
          await assertSucceeds(readRef.get());
        } else {
          await assertFails(readRef.get());
        }
      });

      test(`${role} pode escrever ${collection}: ${perms.write}`, async () => {
        if (perms.write) {
          await assertSucceeds(writeRef.set({ foo: 'bar' }));
        } else {
          await assertFails(writeRef.set({ foo: 'bar' }));
        }
      });
    });
  });
});
