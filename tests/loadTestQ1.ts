import { CortexRepository } from '../src/repositories/cortexRepository.js';
import { D1 } from '../src/db/d1.js';

async function runLoadTest() {
  const d1 = new D1();
  const repo = new CortexRepository(d1);
  await d1.clear();

  const users = 1000;
  const messagesPerUser = 1;
  const results = { reads: 0, writes: 0 };

  // Track usage
  d1.onUsage = (type, count) => {
    if (type === 'read') results.reads += count;
    if (type === 'write') results.writes += count;
  };

  // Create conversations and messages for each user
  const promises = [];
  for (let i = 0; i < users; i++) {
    const uid = `user${i}`;
    promises.push((async () => {
      const conv = await repo.createConversation(uid, `Conversation ${i}`);
      for (let j = 0; j < messagesPerUser; j++) {
        await repo.addMessage(uid, conv.id, `Message ${j} from ${uid}`);
      }
    })());
  }

  await Promise.all(promises);

  console.log('Load Test Results:');
  console.log(`Total reads: ${results.reads}`);
  console.log(`Total writes: ${results.writes}`);
  console.log(`Within limits: ${results.reads <= 50000 && results.writes <= 100000}`);
}

runLoadTest().catch(console.error);
