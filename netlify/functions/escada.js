const { getFirestore } = require('firebase-admin/firestore');
const { getApp, initializeApp } = require('firebase-admin/app');

let db;
try {
  if (!getApp().name) initializeApp();
  db = getFirestore();
} catch {
  // Firebase não configurado neste ambiente
}

const handler = async (event, context) => {
  try {
    if (!db) {
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Firestore não disponível' }),
      };
    }
    const doc = await db.collection('escada').doc('atual').get();
    if (!doc.exists) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Dados da escada não encontrados' }),
      };
    }
    const dados = doc.data();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao buscar dados da escada' }),
    };
  }
};

module.exports = { handler };