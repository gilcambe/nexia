const { admin, db } = require('../netlify/functions/firebase-init');

/**
 * Modelo para logs de abuso usando Firestore
 * @param {Object} data - Dados do log
 * @param {string} data.ip - Endereço IP
 * @param {string|null} data.userId - ID do usuário
 * @param {string} data.tipo - Tipo de abuso (rate-limit, conteudo-proibido, injection, outro)
 * @param {string} data.detalhes - Detalhes do abuso
 * @param {Date} data.timestamp - Timestamp do registro
 * @returns {Promise<Object>} - Documento criado
 */
async function createAbuseLog(data) {
  if (!db) {
    throw new Error('Firestore não disponível');
  }
  
  const logData = {
    ip: data.ip || 'desconhecido',
    userId: data.userId || null,
    tipo: data.tipo || 'outro',
    detalhes: data.detalhes || '',
    timestamp: data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  const docRef = db.collection('abuseLogs').doc();
  await docRef.set(logData);
  
  return {
    id: docRef.id,
    ...logData,
    timestamp: logData.timestamp.toDate ? logData.timestamp.toDate() : logData.timestamp
  };
}

/**
 * Busca logs de abuso
 * @param {Object} options - Opções de busca
 * @param {number} options.limit - Limite de resultados
 * @param {Date} options.since - Buscar a partir desta data
 * @returns {Promise<Array>} - Array de logs
 */
async function getAbuseLogs(options = {}) {
  if (!db) {
    throw new Error('Firestore não disponível');
  }
  
  let query = db.collection('abuseLogs').orderBy('timestamp', 'desc');
  
  if (options.since) {
    query = query.where('timestamp', '>=', options.since);
  }
  
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const snapshot = await query.get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp.toDate ? doc.data().timestamp.toDate() : doc.data().timestamp
  }));
}

module.exports = {
  createAbuseLog,
  getAbuseLogs
};