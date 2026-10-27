/**
 * @file src/controllers/memoryController.ts
 * @brief Funções para interagir com a API de memória do usuário, removendo fatos ou limpando a memória.
 */

// Simulações de funções de API de memória. Em um projeto real, estas seriam chamadas a um backend.
const userMemoryStore: { [userId: string]: string[] } = {}; // Exemplo simples de armazenamento em memória

export async function forgetSpecificFact(userId: string, fact: string): Promise<void> {
  console.log(`Tentando esquecer o fato "${fact}" para o usuário ${userId}`);
  if (userMemoryStore[userId]) {
    userMemoryStore[userId] = userMemoryStore[userId].filter(f => !f.includes(fact)); // Filtra fatos que contenham o termo
  }
  // Em um cenário real, aqui haveria uma chamada a uma API de memória do NEXIA
  console.log(`Fato "${fact}" removido para o usuário ${userId} (se existia). Memória atual:`, userMemoryStore[userId]);
}

export async function clearUserMemory(userId: string): Promise<void> {
  console.log(`Limpando toda a memória para o usuário ${userId}`);
  userMemoryStore[userId] = [];
  // Em um cenário real, aqui haveria uma chamada a uma API de memória do NEXIA para apagar tudo
  console.log(`Memória do usuário ${userId} limpa. Memória atual:`, userMemoryStore[userId]);
}

// Funções para adicionar e recuperar memória (apenas para simulação de teste)
export async function addUserFact(userId: string, fact: string): Promise<void> {
  if (!userMemoryStore[userId]) {
    userMemoryStore[userId] = [];
  }
  userMemoryStore[userId].push(fact);
  console.log(`Fato "${fact}" adicionado para o usuário ${userId}. Memória atual:`, userMemoryStore[userId]);
}

export async function getUserFacts(userId: string): Promise<string[]> {
  return userMemoryStore[userId] || [];
}
