'use strict';
/**
 * Handler para alertas do Sentinel do Vault.
 * Recebe alertas de uso de bancos (Firestore, D1, CofreSql) e registra no Firestore para consulta na Central.
 */
const Firestore = require('../../lib/firebase-lite/firestore.js');

/**
 * Salva um alerta no Firestore.
 * @param {object} alerta - Objeto de alerta do Vault.
 * @returns {Promise<object>} - Resultado da operação.
 */
async function saveAlert(alerta) {
  try {
    const db = new Firestore({ projectId: 'nexia-c8710' });
    const alertRef = db.collection('vault_alerts').doc(alerta.id || Date.now().toString());
    await alertRef.set({
      ...alerta,
      createdAt: new Date().toISOString(),
      status: 'new'
    });
    return { success: true, id: alertRef.id };
  } catch (error) {
    console.error('[Sentinel Alert] Erro ao salvar alerta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler principal para requisições POST /api/central/alerta-sentinel
 */
module.exports = async (event, context) => {
  try {
    const alerta = JSON.parse(event.body || '{}');
    
    // Validação básica
    if (!alerta || !alerta.tipo || !alerta.banco) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Alerta inválido. Tipo e banco são obrigatórios.' })
      };
    }
    
    // Adiciona ID único se não existir
    if (!alerta.id) {
      alerta.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Salva o alerta
    const result = await saveAlert(alerta);
    
    if (result.success) {
      console.log(`[Sentinel Alert] Alerta salvo com sucesso: ${alerta.id} - Banco: ${alerta.banco}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, id: result.id })
      };
    } else {
      console.error(`[Sentinel Alert] Falha ao salvar alerta: ${result.error}`);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: result.error })
      };
    }
  } catch (error) {
    console.error('[Sentinel Alert] Erro inesperado:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};