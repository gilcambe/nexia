export interface DurableFactRecord {
  id: string;
  fact: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  salvo_em: string;
  usado_em: string;
}

export interface SaveFactsOptions {
  tenantId?: string;
  userId?: string;
  conversationId?: string;
  dbOverride?: any;
}

// Memory fallback store for environments without active Firestore connection
const inMemoryStore = new Map<string, DurableFactRecord[]>();

/**
 * Saves a list of durable facts for a given tenant and user.
 * Assigns timestamps including 'salvo_em' and 'usado_em'.
 */
export async function saveFacts(
  facts: string[],
  options: SaveFactsOptions = {}
): Promise<DurableFactRecord[]> {
  if (!Array.isArray(facts) || facts.length === 0) return [];

  const tenantId = options.tenantId || 'nexia';
  const userId = options.userId || 'anon';
  const conversationId = options.conversationId || 'default';
  const now = new Date().toISOString();

  const key = `${tenantId}_${userId}_${conversationId}`;
  const savedRecords: DurableFactRecord[] = [];

  // Up to 3 facts as defined by issue requirements
  const limitedFacts = facts.slice(0, 3);

  for (let i = 0; i < limitedFacts.length; i++) {
    const factText = limitedFacts[i];
    const factId = `fact_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;

    const record: DurableFactRecord = {
      id: factId,
      fact: factText,
      tenantId,
      userId,
      conversationId,
      salvo_em: now,
      usado_em: now,
    };

    savedRecords.push(record);
  }

  // Attempt Firestore persistence if available
  let db: any = options.dbOverride;
  if (!db) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const firebaseInit = require('../../netlify/functions/firebase-init');
      db = firebaseInit.db;
    } catch {
      db = null;
    }
  }

  if (db && typeof db.collection === 'function') {
    try {
      const batch = db.batch ? db.batch() : null;
      const colRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('cortex_facts')
        .doc(userId)
        .collection('facts');

      for (const rec of savedRecords) {
        const docRef = colRef.doc(rec.id);
        if (batch) {
          batch.set(docRef, rec);
        } else {
          await docRef.set(rec);
        }
      }
      if (batch) await batch.commit();
    } catch (err) {
      // Fallback to in-memory store on DB error
      const existing = inMemoryStore.get(key) || [];
      inMemoryStore.set(key, [...existing, ...savedRecords]);
    }
  } else {
    // In-memory fallback
    const existing = inMemoryStore.get(key) || [];
    inMemoryStore.set(key, [...existing, ...savedRecords]);
  }

  return savedRecords;
}

/**
 * Retrieves stored durable facts for a user and tenant.
 */
export async function getFacts(
  userId: string,
  tenantId: string = 'nexia',
  conversationId: string = 'default',
  dbOverride?: any
): Promise<DurableFactRecord[]> {
  const key = `${tenantId}_${userId}_${conversationId}`;

  let db: any = dbOverride;
  if (!db) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const firebaseInit = require('../../netlify/functions/firebase-init');
      db = firebaseInit.db;
    } catch {
      db = null;
    }
  }

  if (db && typeof db.collection === 'function') {
    try {
      const snap = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('cortex_facts')
        .doc(userId)
        .collection('facts')
        .get();

      if (!snap.empty) {
        return snap.docs.map((d: any) => d.data() as DurableFactRecord);
      }
    } catch {
      // Fall through to in-memory
    }
  }

  return inMemoryStore.get(key) || [];
}

/**
 * Clears in-memory facts (mainly for testing).
 */
export function clearInMemoryFacts(): void {
  inMemoryStore.clear();
}
