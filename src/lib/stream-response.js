'use strict';
// Resposta em streaming para o frontend React
// Funções para lidar com streaming de respostas de IA

// Verifica se uma resposta é um stream
function isStreamResult(result) {
  return !!(result && result.stream && typeof result.stream[Symbol.asyncIterator] === 'function');
}

// Processa um stream de resposta e atualiza o estado gradualmente
async function processStream(stream, onUpdate, onComplete, onError) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onComplete(accumulatedText);
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;
      onUpdate(accumulatedText);
    }
  } catch (error) {
    onError(error);
  } finally {
    reader.releaseLock();
  }
}

// Função para simular streaming (para desenvolvimento)
// Em produção, isso viria de uma API real
async function simulateStreamResponse(message, onUpdate, onComplete, onError) {
  try {
    // Simulando uma resposta em partes
    const responses = [
      'Olá! ',
      'Estou processando sua solicitação: "',
      message,
      '". ',
      'Esta é uma resposta em streaming para demonstrar ',
      'como as mensagens da IA são exibidas ',
      'em tempo real na tela do usuário. ',
      'Continue digitando suas perguntas e eu ',
      'responderei imediatamente!'
    ];
    
    let accumulated = '';
    
    for (const part of responses) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simula latência
      accumulated += part;
      onUpdate(accumulated);
    }
    
    onComplete(accumulated);
  } catch (error) {
    onError(error);
  }
}

export { isStreamResult, processStream, simulateStreamResponse };