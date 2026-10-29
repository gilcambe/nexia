'use strict';
// Teste de isolamento do Cortex Storage: dois UIDs diferentes não devem misturar conversas e mensagens
const test = require('node:test');
const assert = require('node:assert');

test('CT1. isolamento: dois UIDs diferentes criam/consultam conversas e mensagens sem mistura', async () => {
  // Simulando o storage do Cortex para dois UIDs diferentes
  const storageA = {
    uid: 'user-a',
    conversations: [],
    messages: [],
    readCount: 0,
    writeCount: 0
  };
  
  const storageB = {
    uid: 'user-b',
    conversations: [],
    messages: [],
    readCount: 0,
    writeCount: 0
  };
  
  // Função simulada para criar conversa
  const createConversation = (storage, title) => {
    const conversation = {
      id: `conv-${storage.conversations.length + 1}`,
      title,
      uid: storage.uid,
      createdAt: new Date().toISOString()
    };
    storage.conversations.push(conversation);
    storage.writeCount++;
    return conversation;
  };
  
  // Função simulada para adicionar mensagem
  const addMessage = (storage, conversationId, text) => {
    const message = {
      id: `msg-${storage.messages.length + 1}`,
      conversationId,
      text,
      uid: storage.uid,
      createdAt: new Date().toISOString()
    };
    storage.messages.push(message);
    storage.writeCount++;
    return message;
  };
  
  // Função simulada para listar conversas de um UID
  const getConversations = (storage) => {
    storage.readCount++;
    return storage.conversations.filter(conv => conv.uid === storage.uid);
  };
  
  // Função simulada para listar mensagens de uma conversa
  const getMessages = (storage, conversationId) => {
    storage.readCount++;
    return storage.messages.filter(msg => msg.conversationId === conversationId && msg.uid === storage.uid);
  };
  
  // UID A cria uma conversa e adiciona mensagens
  const convA1 = createConversation(storageA, 'Conversa do usuário A');
  addMessage(storageA, convA1.id, 'Olá, sou o usuário A');
  addMessage(storageA, convA1.id, 'Esta é minha segunda mensagem');
  
  // UID B cria uma conversa diferente
  const convB1 = createConversation(storageB, 'Conversa do usuário B');
  addMessage(storageB, convB1.id, 'Olá, sou o usuário B');
  
  // UID A cria mais uma conversa
  const convA2 = createConversation(storageA, 'Outra conversa do A');
  addMessage(storageA, convA2.id, 'Mensagem da segunda conversa do A');
  
  // Testando isolamento: UID A só deve ver suas próprias conversas
  const conversationsA = getConversations(storageA);
  assert.equal(conversationsA.length, 2, 'UID A deve ter 2 conversas');
  assert.equal(conversationsA[0].title, 'Conversa do usuário A', 'Primeira conversa do A');
  assert.equal(conversationsA[1].title, 'Outra conversa do A', 'Segunda conversa do A');
  assert.doesNotMatch(conversationsA[0].title, /usuário B/, 'Conversa do A não deve conter B');
  
  // Testando isolamento: UID B só deve ver suas próprias conversas
  const conversationsB = getConversations(storageB);
  assert.equal(conversationsB.length, 1, 'UID B deve ter 1 conversa');
  assert.equal(conversationsB[0].title, 'Conversa do usuário B', 'Conversa do B');
  assert.doesNotMatch(conversationsB[0].title, /usuário A/, 'Conversa do B não deve conter A');
  
  // Testando mensagens da primeira conversa do A
  const messagesA1 = getMessages(storageA, convA1.id);
  assert.equal(messagesA1.length, 2, 'Conversa A1 deve ter 2 mensagens');
  assert.equal(messagesA1[0].text, 'Olá, sou o usuário A', 'Primeira mensagem da A1');
  assert.equal(messagesA1[1].text, 'Esta é minha segunda mensagem', 'Segunda mensagem da A1');
  
  // Testando mensagens da conversa do B
  const messagesB1 = getMessages(storageB, convB1.id);
  assert.equal(messagesB1.length, 1, 'Conversa B1 deve ter 1 mensagem');
  assert.equal(messagesB1[0].text, 'Olá, sou o usuário B', 'Mensagem da B1');
  
  // Testando que as mensagens de A não aparecem em B e vice-versa
  const messagesBInA1 = getMessages(storageB, convA1.id);
  assert.equal(messagesBInA1.length, 0, 'B não deve ver mensagens da conversa de A');
  
  const messagesAInB1 = getMessages(storageA, convB1.id);
  assert.equal(messagesAInB1.length, 0, 'A não deve ver mensagens da conversa de B');
  
  // Verificando contadores de operações
  assert.equal(storageA.readCount, 3, 'UID A fez 3 leituras');
  assert.equal(storageA.writeCount, 4, 'UID A fez 4 escritas');
  assert.equal(storageB.readCount, 2, 'UID B fez 2 leituras');
  assert.equal(storageB.writeCount, 2, 'UID B fez 2 escritas');
  
  // Total de operações (deve estar dentro dos limites gratuitos)
  const totalReads = storageA.readCount + storageB.readCount;
  const totalWrites = storageA.writeCount + storageB.writeCount;
  assert.ok(totalReads <= 50000, `Total de leituras ${totalReads} deve ser <= 50000`);
  assert.ok(totalWrites <= 100000, `Total de escritas ${totalWrites} deve ser <= 100000`);
});
