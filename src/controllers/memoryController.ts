/**
 * @file src/controllers/memoryController.ts
 * @brief Funções para interagir com a API de memória do usuário, removendo fatos ou limpando a memória.
 */

// Assume que 'fetch' está disponível no ambiente de execução e que a URL base da API é conhecida.
// Em um ambiente Node.js real, você importaria 'node-fetch' ou usaria o fetch global se disponível.
// Para este exemplo, vamos supor que podemos chamar diretamente a API.
const API_BASE_URL = '/api/memory'; // Ajuste se o caminho for diferente

async function callMemoryAPI(userId: string, action: string, data: any = {}): Promise<any> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        action: action,
        ...data,
        // Em um cenário real, você precisaria passar tenantId, conversationId se necessário,
        // e talvez autenticação. Para simplificar, estamos usando apenas userId.
      }),
    });

    if (!response.ok) {
      console.error(`Erro ao chamar API de memória: ${response.status} ${response.statusText}`);
      throw new Error(`Falha ao se comunicar com a API de memória.`);
    }
    return await response.json();
  } catch (error) {
    console.error('Erro na chamada da API de memória:', error);
    throw error; // Rejeita o erro para que o chamador possa tratá-lo.
  }
}

export async function forgetSpecificFact(userId: string, fact: string): Promise<void> {
  console.log(`Solicitando esquecimento do fato "${fact}" para o usuário ${userId}`);
  await callMemoryAPI(userId, 'forget', { fact });
  console.log(`Solicitação de esquecimento enviada para o fato "${fact}" para o usuário ${userId}`);
}

export async function clearUserMemory(userId: string): Promise<void> {
  console.log(`Solicitando limpeza de memória para o usuário ${userId}`);
  await callMemoryAPI(userId, 'clear');
  console.log(`Solicitação de limpeza de memória enviada para o usuário ${userId}`);
}

// As funções addUserFact e getUserFacts não são diretamente requisitadas para modificação
// neste pedido específico, e sua implementação em memória não se alinha com a API de backend.
// Elas seriam refatoradas para também chamar a API se necessário para funcionalidades futuras.
export async function addUserFact(userId: string, fact: string): Promise<void> {
   console.warn("addUserFact não implementado via API de memória neste escopo.");
   // Em um cenário real, seria:
   // await callMemoryAPI(userId, 'add', { fact });
}

export async function getUserFacts(userId: string): Promise<string[]> {
   console.warn("getUserFacts não implementado via API de memória neste escopo.");
   // Em um cenário real, seria:
   // const response = await callMemoryAPI(userId, 'get');
   // return response.history || []; // ou a estrutura de dados correta
   return [];
}
