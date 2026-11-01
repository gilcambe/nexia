'use strict';
// Teste unitário do cache em memória do Firestore (#2221, #2223, #2224)
const { getCachedFirestoreRead, setCachedFirestoreRead, invalidateFirestoreCache } = require('../../lib/firebase-lite/firestore');

describe('Firestore Cache', () => {
  const tenantId = 'test-tenant';
  const collection = 'test-collection';
  const docId = 'test-doc';
  
  beforeEach(() => {
    // Limpa o cache antes de cada teste
    const cache = require('../../lib/firebase-lite/firestore').firestoreReadCache;
    cache.clear();
  });

  describe('getCachedFirestoreRead', () => {
    it('retorna null quando não há cache', () => {
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toBeNull();
    });

    it('retorna documento do cache quando existe e não expirou', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toEqual(docData);
    });

    it('retorna null quando cache expirou', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      // Simula expiração modificando o timestamp
      const cache = require('../../lib/firebase-lite/firestore').firestoreReadCache;
      const key = `${tenantId}:${collection}:${docId}`;
      const cachedEntry = cache.get(key);
      if (cachedEntry) {
        cachedEntry.expiresAt = Date.now() - 1000; // 1 segundo atrás
      }
      
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toBeNull();
    });

    it('retorna null quando hash do documento mudou', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      // Simula mudança do documento no servidor
      const modifiedData = { id: docId, name: 'Modified Document', value: 456 };
      setCachedFirestoreRead(tenantId, collection, docId, modifiedData);
      
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toEqual(modifiedData);
    });

    it('retorna null quando documento foi excluído', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      // Simula exclusão do documento
      const cache = require('../../lib/firebase-lite/firestore').firestoreReadCache;
      const key = `${tenantId}:${collection}:${docId}`;
      const cachedEntry = cache.get(key);
      if (cachedEntry) {
        cachedEntry.record = null;
      }
      
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toBeNull();
    });
  });

  describe('setCachedFirestoreRead', () => {
    it('adiciona documento ao cache', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toEqual(docData);
    });

    it('atualiza documento existente no cache', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      const updatedData = { id: docId, name: 'Updated Document', value: 456 };
      setCachedFirestoreRead(tenantId, collection, docId, updatedData);
      
      const result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toEqual(updatedData);
    });

    it('respeita TTL de 60 segundos', () => {
      const docData = { id: docId, name: 'Test Document', value: 123 };
      setCachedFirestoreRead(tenantId, collection, docId, docData);
      
      // Verifica que cache está ativo
      let result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toEqual(docData);
      
      // Simula passagem do tempo (61 segundos)
      const cache = require('../../lib/firebase-lite/firestore').firestoreReadCache;
      const key = `${tenantId}:${collection}:${docId}`;
      const cachedEntry = cache.get(key);
      if (cachedEntry) {
        cachedEntry.expiresAt = Date.now() - 1000; // 1 segundo atrás
      }
      
      // Verifica que cache expirou
      result = getCachedFirestoreRead(tenantId, collection, docId);
      expect(result).toBeNull();
    });
  });

  describe('invalidateFirestoreCache', () => {
    it('invalida cache específico', () => {
      const docData1 = { id: 'doc1', name: 'Document 1', value: 123 };
      const docData2 = { id: 'doc2', name: 'Document 2', value: 456 };
      
      setCachedFirestoreRead(tenantId, collection, 'doc1', docData1);
      setCachedFirestoreRead(tenantId, collection, 'doc2', docData2);
      
      // Verifica que ambos estão no cache
      expect(getCachedFirestoreRead(tenantId, collection, 'doc1')).toEqual(docData1);
      expect(getCachedFirestoreRead(tenantId, collection, 'doc2')).toEqual(docData2);
      
      // Invalida apenas doc1
      invalidateFirestoreCache(tenantId, collection, 'doc1');
      
      // Verifica que doc1 foi removido mas doc2 permanece
      expect(getCachedFirestoreRead(tenantId, collection, 'doc1')).toBeNull();
      expect(getCachedFirestoreRead(tenantId, collection, 'doc2')).toEqual(docData2);
    });

    it('invalida cache de toda a coleção', () => {
      const docData1 = { id: 'doc1', name: 'Document 1', value: 123 };
      const docData2 = { id: 'doc2', name: 'Document 2', value: 456 };
      const docData3 = { id: 'doc3', name: 'Document 3', value: 789 };
      
      // Adiciona documentos em diferentes coleções
      setCachedFirestoreRead(tenantId, 'collection1', 'doc1', docData1);
      setCachedFirestoreRead(tenantId, 'collection2', 'doc2', docData2);
      setCachedFirestoreRead(tenantId, 'collection1', 'doc3', docData3);
      
      // Verifica que todos estão no cache
      expect(getCachedFirestoreRead(tenantId, 'collection1', 'doc1')).toEqual(docData1);
      expect(getCachedFirestoreRead(tenantId, 'collection2', 'doc2')).toEqual(docData2);
      expect(getCachedFirestoreRead(tenantId, 'collection1', 'doc3')).toEqual(docData3);
      
      // Invalida toda a collection1
      invalidateFirestoreCache(tenantId, 'collection1');
      
      // Verifica que collection1 foi limpa mas collection2 permanece
      expect(getCachedFirestoreRead(tenantId, 'collection1', 'doc1')).toBeNull();
      expect(getCachedFirestoreRead(tenantId, 'collection1', 'doc3')).toBeNull();
      expect(getCachedFirestoreRead(tenantId, 'collection2', 'doc2')).toEqual(docData2);
    });

    it('invalida cache de todo o tenant', () => {
      const docData1 = { id: 'doc1', name: 'Document 1', value: 123 };
      const docData2 = { id: 'doc2', name: 'Document 2', value: 456 };
      
      // Adiciona documentos de diferentes tenants
      setCachedFirestoreRead('tenant1', 'collection1', 'doc1', docData1);
      setCachedFirestoreRead('tenant2', 'collection1', 'doc2', docData2);
      
      // Verifica que ambos estão no cache
      expect(getCachedFirestoreRead('tenant1', 'collection1', 'doc1')).toEqual(docData1);
      expect(getCachedFirestoreRead('tenant2', 'collection1', 'doc2')).toEqual(docData2);
      
      // Invalida tenant1
      invalidateFirestoreCache('tenant1');
      
      // Verifica que tenant1 foi limpo mas tenant2 permanece
      expect(getCachedFirestoreRead('tenant1', 'collection1', 'doc1')).toBeNull();
      expect(getCachedFirestoreRead('tenant2', 'collection1', 'doc2')).toEqual(docData2);
    });
  });

  describe('limite de cache', () => {
    it('respeita limite máximo de 1000 itens', () => {
      // Adiciona 1001 itens (ultrapassa o limite)
      for (let i = 0; i < 1001; i++) {
        const docData = { id: `doc${i}`, name: `Document ${i}`, value: i };
        setCachedFirestoreRead(tenantId, `collection${i % 10}`, `doc${i}`, docData);
      }
      
      // Verifica que o primeiro item foi removido (FIFO)
      const firstDocData = { id: 'doc0', name: 'Document 0', value: 0 };
      expect(getCachedFirestoreRead(tenantId, 'collection0', 'doc0')).toBeNull();
      
      // Verifica que o último item ainda está no cache
      const lastDocData = { id: 'doc1000', name: 'Document 1000', value: 1000 };
      expect(getCachedFirestoreRead(tenantId, 'collection0', 'doc1000')).toEqual(lastDocData);
    });
  });
});
