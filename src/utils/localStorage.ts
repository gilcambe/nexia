export interface Conversation {
  id: string;
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const saveConversation = (conversation: Conversation): void => {
  try {
    const uid = localStorage.getItem('cortex_uid');
    if (!uid) {
      throw new Error('UID do usuário não encontrado no localStorage');
    }
    
    const conversations = getConversations();
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);
    
    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.push(conversation);
    }
    
    localStorage.setItem(`cortexClientes/${uid}/conversas`, JSON.stringify(conversations));
  } catch (error) {
    console.error('Erro ao salvar conversa:', error);
    throw error;
  }
};

export const getConversations = (): Conversation[] => {
  try {
    const uid = localStorage.getItem('cortex_uid');
    if (!uid) {
      return [];
    }
    
    const stored = localStorage.getItem(`cortexClientes/${uid}/conversas`);
    if (!stored) {
      return [];
    }
    
    const conversations = JSON.parse(stored);
    return conversations.map((conv: any) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
  } catch (error) {
    console.error('Erro ao carregar conversas:', error);
    return [];
  }
};

export const getConversation = (id: string): Conversation | null => {
  try {
    const conversations = getConversations();
    return conversations.find(c => c.id === id) || null;
  } catch (error) {
    console.error('Erro ao obter conversa:', error);
    return null;
  }
};

export const deleteConversation = (id: string): void => {
  try {
    const uid = localStorage.getItem('cortex_uid');
    if (!uid) {
      throw new Error('UID do usuário não encontrado no localStorage');
    }
    
    const conversations = getConversations();
    const filtered = conversations.filter(c => c.id !== id);
    
    localStorage.setItem(`cortexClientes/${uid}/conversas`, JSON.stringify(filtered));
  } catch (error) {
    console.error('Erro ao deletar conversa:', error);
    throw error;
  }
};

export const createNewConversation = (title: string): Conversation => {
  const now = new Date();
  return {
    id: `conv_${Date.now()}`,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now
  };
};