'use strict';
/**
 * NEXIA OS — Firebase Admin Init v16
 * FIX: Decodificação Base64 robusta para chave RSA privada.
 *
 * Problemas corrigidos:
 * 1. Base64 com espaços/newlines vindos do painel de segredos → trim() antes de decodificar
 * 2. Chave RSA com \\n literais (escaped) → converter para \n reais
 * 3. Proteção contra double-init em hot-reload
 * 4. Log de projeto para diagnóstico sem expor credenciais
 */
'use strict';

let admin, db;

try {
  admin = require('firebase-admin');

  if (!admin.apps.length) {
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    // Testes locais/CI: com os emuladores do Firebase ativos (variáveis definidas
    // pelo `firebase emulators:exec`) e fora de produção, inicializa sem credencial.
    // Em produção este ramo nunca é usado (NODE_ENV=production).
    const emulator = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
      && process.env.NODE_ENV !== 'production' && !saRaw && !saB64;
    if (emulator) {
      admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-nexia' });
    } else {

    if (!saRaw && !saB64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT ou FIREBASE_SERVICE_ACCOUNT_BASE64 não configurada');
    }

    let saJson;

    if (saRaw) {
      // Variável já é JSON puro
      saJson = saRaw.trim();
    } else {
      // FIX: trim() remove espaços/newlines que o painel de segredos pode injetar nos env vars
      const cleanB64 = saB64.trim().replace(/\s/g, '');
      saJson = Buffer.from(cleanB64, 'base64').toString('utf8');
    }

    // FIX: chaves RSA exportadas pelo Firebase Console às vezes têm \\n
    // literais (dois caracteres) em vez de \n reais. Isso causa:
    // "error:0909006C:PEM routines:get_name:no start line"
    const parsed = JSON.parse(saJson);
    if (parsed.private_key && parsed.private_key.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }

    // Diagnóstico seguro: loga apenas o project_id, nunca a chave
    console.info(`[NEXIA] Firebase init → projeto: ${parsed.project_id || 'desconhecido'}`);

    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      // Garante conexão com o projeto correto mesmo se a chave vier de outro ambiente
      projectId: parsed.project_id,
    });
    }
  }

  db = admin.firestore();

  // FIX: db.settings() só pode ser chamado UMA vez antes de qualquer operação.
  // Quando server.js já inicializou o Firebase, a instância existe e settings já foi chamado.
  // Usamos try/catch para absorver o erro silenciosamente — não é crítico.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (_settingsErr) {
    // Já configurado por outra instância — normal em ambiente compartilhado
  }

  console.info('[NEXIA] Firestore conectado ✓');

} catch (e) {
  // Log estruturado: não expõe stack trace com credenciais
  console.error('[NEXIA] Firebase init FALHOU:', e.message);
  db = null;
}

module.exports = { admin, db };