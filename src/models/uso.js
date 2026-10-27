/**
 * Modelo da tabela `uso`.
 * Colunas: id, cliente, plano, provedor, modelo, tokens_in, tokens_out, cache, criado_em.
 *
 * Exporta registrarUso(registro): insere um registro na tabela/coleção `uso`
 * e resolve quando a inserção estiver concluída.
 */

import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';

let _db = null;

function _firestore() {
  if (!_db) {
    try {
      _db = getFirestore(getApp());
    } catch (_) {
      _db = null;
    }
  }
  return _db;
}

/**
 * Insere um registro de uso.
 * @param {Object} registro - { cliente, plano, provedor, modelo, tokens_in, tokens_out, cache }
 * @returns {Promise<Object>} registro inserido com id e criado_em
 */
export async function registrarUso(registro) {
  const linha = {
    cliente: String(registro.cliente ?? ''),
    plano: String(registro.plano ?? ''),
    provedor: String(registro.provedor ?? ''),
    modelo: String(registro.modelo ?? ''),
    tokens_in: Number(registro.tokens_in) || 0,
    tokens_out: Number(registro.tokens_out) || 0,
    cache: Boolean(registro.cache),
    criado_em: new Date().toISOString(),
  };

  const db = _firestore();
  if (db) {
    const docRef = await addDoc(collection(db, 'uso'), {
      ...linha,
      criado_em: serverTimestamp(),
    });
    return { id: docRef.id, ...linha };
  }

  // Fallback em memória para ambiente sem Firebase configurado (testes locais)
  const id = 'uso_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const entrada = { id, ...linha };
  globalThis.__uso_mem = globalThis.__uso_mem || [];
  globalThis.__uso_mem.push(entrada);
  return entrada;
}
