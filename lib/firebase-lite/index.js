'use strict';
// ADR-FREE-01: substituto do firebase-admin (que não roda no Cloudflare Worker grátis).
// Mesma forma de uso: admin.initializeApp, admin.credential.cert, admin.apps, admin.firestore(),
// admin.firestore.FieldValue/Timestamp/FieldPath e admin.auth(). Só fetch + Web Crypto.

const { Firestore } = require('./firestore');
const { createAuth } = require('./auth');
const { createTokenSource } = require('./google-auth');
const { Timestamp, FieldValue, FieldPath, GeoPoint } = require('./values');

const apps = [];
let firestoreInstance = null;
let authInstance = null;

const env = () => (typeof process !== 'undefined' && process.env) || {};

function initializeApp(options = {}) {
  if (apps.length) throw Object.assign(new Error('O app padrão do Firebase já existe.'), { code: 'app/duplicate-app' });
  const sa = options.credential && options.credential.__serviceAccount;
  const projectId = options.projectId || (sa && sa.project_id) || env().GCLOUD_PROJECT || env().FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase: projectId ausente.');
  const app = { name: '[DEFAULT]', options: { ...options, projectId }, _tokens: sa ? createTokenSource(sa) : null };
  apps.push(app);
  return app;
}

const credential = { cert: serviceAccount => ({ __serviceAccount: serviceAccount }) };

function defaultApp() {
  if (!apps.length) throw Object.assign(new Error('Firebase não inicializado (initializeApp).'), { code: 'app/no-app' });
  return apps[0];
}

function tokenGetter(app) {
  return async () => {
    if (!app._tokens) throw Object.assign(new Error('Sem service account para acessar o Firebase.'), { code: 'app/invalid-credential' });
    return app._tokens.getToken();
  };
}

function firestore() {
  if (!firestoreInstance) {
    const app = defaultApp();
    firestoreInstance = new Firestore({ projectId: app.options.projectId, emulatorHost: env().FIRESTORE_EMULATOR_HOST, getToken: tokenGetter(app) });
  }
  return firestoreInstance;
}
firestore.FieldValue = FieldValue;
firestore.Timestamp = Timestamp;
firestore.FieldPath = FieldPath;
firestore.GeoPoint = GeoPoint;

function auth() {
  if (!authInstance) {
    const app = defaultApp();
    authInstance = createAuth({ projectId: app.options.projectId, emulatorHost: env().FIREBASE_AUTH_EMULATOR_HOST, getToken: tokenGetter(app) });
  }
  return authInstance;
}

/** Só para testes: volta ao estado inicial. */
function _reset() { apps.length = 0; firestoreInstance = null; authInstance = null; }

module.exports = { apps, initializeApp, credential, firestore, auth, app: defaultApp, FieldValue, Timestamp, FieldPath, GeoPoint, _reset };
