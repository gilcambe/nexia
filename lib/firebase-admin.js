'use strict';
// Helper para inicializar e acessar serviços do Firebase Admin via firebase-lite (ADR-FREE-01).

const firebaseLite = require('./firebase-lite');

function initFirebaseAdmin(env = (typeof process !== 'undefined' && process.env) || {}) {
  if (firebaseLite.apps.length > 0) {
    return firebaseLite;
  }

  const saRaw = env.FIREBASE_SERVICE_ACCOUNT;
  const saB64 = env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  const emulator = env.FIRESTORE_EMULATOR_HOST && env.FIREBASE_AUTH_EMULATOR_HOST
    && env.NODE_ENV !== 'production' && !saRaw && !saB64;

  if (emulator) {
    firebaseLite.initializeApp({ projectId: env.GCLOUD_PROJECT || env.FIREBASE_PROJECT_ID || 'demo-nexia' });
  } else if (saRaw || saB64) {
    let saJson;
    if (saRaw) {
      saJson = saRaw.trim();
    } else {
      const cleanB64 = saB64.trim().replace(/\s/g, '');
      saJson = Buffer.from(cleanB64, 'base64').toString('utf8');
    }
    const parsed = JSON.parse(saJson);
    if (parsed.private_key && parsed.private_key.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    firebaseLite.initializeApp({
      credential: firebaseLite.credential.cert(parsed),
      projectId: parsed.project_id || env.FIREBASE_PROJECT_ID,
    });
  } else {
    const projectId = env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || 'nexia-c8710';
    firebaseLite.initializeApp({ projectId });
  }

  return firebaseLite;
}

function getAdmin(env) {
  initFirebaseAdmin(env);
  return firebaseLite;
}

function getDb(env) {
  initFirebaseAdmin(env);
  return firebaseLite.firestore();
}

function getAuth(env) {
  initFirebaseAdmin(env);
  return firebaseLite.auth();
}

async function verifyIdToken(idToken, env) {
  const authInstance = getAuth(env);
  return authInstance.verifyIdToken(idToken);
}

module.exports = {
  admin: firebaseLite,
  initFirebaseAdmin,
  getAdmin,
  getDb,
  getAuth,
  verifyIdToken,
};
