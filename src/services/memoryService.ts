import { Memory } from '../models/Memory';
import { firestore } from '../firebase';

export class MemoryService {
  private collection = firestore.collection('memories');

  async getAllMemories(userId: string): Promise<Memory[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Memory));
  }

  async upsertMemory(memory: Omit<Memory, 'id' | 'createdAt'>): Promise<Memory> {
    const existingMemory = await this.collection
      .where('userId', '==', memory.userId)
      .where('key', '==', memory.key)
      .limit(1)
      .get();

    if (!existingMemory.empty) {
      const doc = existingMemory.docs[0];
      await doc.ref.update({
        value: memory.value,
        updatedAt: new Date()
      });
      
      return {
        id: doc.id,
        ...doc.data()
      } as Memory;
    } else {
      const docRef = await this.collection.add({
        ...memory,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const doc = await docRef.get();
      return {
        id: doc.id,
        ...doc.data()
      } as Memory;
    }
  }

  async deleteMemory(userId: string, id: string): Promise<boolean> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return false;
    }

    const memory = doc.data() as Memory;
    if (memory.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await doc.ref.delete();
    return true;
  }

  async deleteAllMemories(userId: string): Promise<number> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .get();

    const batch = firestore.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  async toggleRememberMe(userId: string, enabled: boolean): Promise<void> {
    await this.upsertMemory({
      userId,
      key: 'rememberMe',
      value: enabled
    });
  }

  async getRememberMe(userId: string): Promise<boolean | null> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('key', '==', 'rememberMe')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const memory = doc.data() as Memory;
    return memory.value as boolean;
  }
}