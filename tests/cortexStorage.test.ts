import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { CortexRepository } from '../src/repositories/cortexRepository.js';
import { D1 } from '../src/db/d1.js';

describe('Cortex Storage Isolation', () => {
  let d1;
  let repo;

  before(async () => {
    d1 = new D1();
    repo = new CortexRepository(d1);
    await d1.clear();
  });

  after(async () => {
    await d1.clear();
  });

  it('should isolate conversations by UID', async () => {
    const uid1 = 'user1';
    const uid2 = 'user2';

    // Create conversations for user1
    const conv1 = await repo.createConversation(uid1, 'Test Conversation 1');
    await repo.addMessage(uid1, conv1.id, 'Hello from user1');

    // Create conversations for user2
    const conv2 = await repo.createConversation(uid2, 'Test Conversation 2');
    await repo.addMessage(uid2, conv2.id, 'Hello from user2');

    // Verify user1 can only see their own conversations
    const user1Convs = await repo.getConversations(uid1);
    assert.strictEqual(user1Convs.length, 1);
    assert.strictEqual(user1Convs[0].id, conv1.id);
    assert.strictEqual(user1Convs[0].title, 'Test Conversation 1');

    const user1Msgs = await repo.getMessages(uid1, conv1.id);
    assert.strictEqual(user1Msgs.length, 1);
    assert.strictEqual(user1Msgs[0].content, 'Hello from user1');

    // Verify user2 can only see their own conversations
    const user2Convs = await repo.getConversations(uid2);
    assert.strictEqual(user2Convs.length, 1);
    assert.strictEqual(user2Convs[0].id, conv2.id);
    assert.strictEqual(user2Convs[0].title, 'Test Conversation 2');

    const user2Msgs = await repo.getMessages(uid2, conv2.id);
    assert.strictEqual(user2Msgs.length, 1);
    assert.strictEqual(user2Msgs[0].content, 'Hello from user2');
  });
});
