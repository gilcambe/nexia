import { db } from '../../firebase';
import { doc, setDoc, Timestamp, serverTimestamp, DocumentData } from 'firebase/firestore';

interface Fact {
  tipo: 'nome' | 'localização' | 'preferência' | 'outro';
  valor: string;
  usado_em?: string;
}

export const memoryService = {
  async upsertFact(userId: string, conversationId: string, fact: Fact): Promise<void> {
    const factsRef = doc(db, 'fatos_duraveis', `${userId}_${conversationId}_${Date.now()}`);
    await setDoc(factsRef, {
      ...fact,
      userId,
      conversationId,
      criado_em: serverTimestamp(),
    });
  },
};
