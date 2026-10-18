const { initializeTestApp, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const PROJECT_ID = 'nexia-audit-test';

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
  return { uid: `${role}-uid`, role };
}

function getApp(role) {
  return initializeTestApp({ projectId: PROJECT_ID, auth: getAuth(role) });
}

describe('Regras de segurança do Firestore - matriz de permissões', () => {
  afterAll(async () => {
    await Promise.all(require('@firebase/rules-unit-testing').apps().map(app => app.delete()));
  });

  Object.entries(permissionMatrix).forEach(([collection, roles]) => {
    Object.entries(roles).forEach(([role, perms]) => {
      const app = getApp(role);
      const db = app.firestore();
      const docRef = db.collection(collection).doc('test-doc');

      test(`${role} pode ler ${collection}: ${perms.read}`, async () => {
        const read = db.collection(collection).doc('any');
        if (perms.read) {
          await assertSucceeds(read.get());
        } else {
          await assertFails(read.get());
        }
      });

      test(`${role} pode escrever ${collection}: ${perms.write}`, async () => {
        if (perms.write) {
          await assertSucceeds(docRef.set({ foo: 'bar' }));
        } else {
          await assertFails(docRef.set({ foo: 'bar' }));
        }
      });
    });
  });
});