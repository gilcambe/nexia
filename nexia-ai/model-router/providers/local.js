const { Ollama } = require('ollama');
const { getMachineStats } = require('../../../lib/machine-stats');

const ollama = new Ollama({ host: 'http://localhost:11434' });

const MAX_TIMES = {
  vetor: 20000, // 20 segundos
  triagem: 30000, // 30 segundos
  'resumo-erro': 90000, // 90 segundos
  'cache-noturno': 0 // sem pressa
};

const DEFAULT_ENABLED_TYPES = ['vetor'];

async function getBestMachine(types) {
  const machines = await getMachineStats();
  const heavyTypes = ['vetor', 'cache-noturno'];

  return machines.sort((a, b) => {
    if (heavyTypes.includes(types[0])) {
      return b.memory.free - a.memory.free;
    }
    return a.cpu.load - b.cpu.load;
  })[0];
}

async function vetorizar(text) {
  try {
    const response = await ollama.embed({
      model: 'nomic-embed-text',
      input: text
    });
    return response.embedding;
  } catch (error) {
    console.error('Erro na vetorização local:', error);
    throw error;
  }
}

async function triagem(prompt) {
  const response = await ollama.generate({
    model: 'llama2',
    prompt: `Classifique este pedido em uma das categorias: bug, ideia, duvida ou grande. Responda apenas com uma palavra.\n\nPedido: ${prompt}`,
    options: {
      temperature: 0.3
    }
  });

  const categories = ['bug', 'ideia', 'duvida', 'grande'];
  const result = response.response.trim().toLowerCase();

  if (!categories.includes(result)) {
    throw new Error('Resposta inválida da triagem');
  }

  return result;
}

async function resumirErro(log) {
  const response = await ollama.generate({
    model: 'llama2',
    prompt: `Resuma este log de erro em até 8 linhas, destacando arquivo, linha e mensagem:\n\n${log}`,
    options: {
      temperature: 0.5
    }
  });

  return response.response.split('\n').slice(0, 8).join('\n');
}

async function cacheNoturno(pergunta) {
  const response = await ollama.generate({
    model: 'llama2',
    prompt: `Responda a esta pergunta como um rascunho para o cache noturno:\n\n${pergunta}`,
    options: {
      temperature: 0.7
    }
  });

  return {
    resposta: response.response,
    status: 'rascunho'
  };
}

async function executeLocalTask(task) {
  const enabledTypes = process.env.CORTEX_ROBOS_LOCAIS
    ? process.env.CORTEX_ROBOS_LOCAIS.split(',')
    : DEFAULT_ENABLED_TYPES;

  if (!enabledTypes.includes(task.tipo)) {
    throw new Error(`Tipo de tarefa ${task.tipo} não está habilitado`);
  }

  const machine = await getBestMachine([task.tipo]);
  console.log(`Executando tarefa ${task.tipo} na máquina ${machine.id}`);

  const startTime = Date.now();
  let result;

  try {
    switch (task.tipo) {
      case 'vetor':
        result = await vetorizar(task.texto);
        break;
      case 'triagem':
        result = await triagem(task.prompt);
        break;
      case 'resumo-erro':
        result = await resumirErro(task.log);
        break;
      case 'cache-noturno':
        result = await cacheNoturno(task.pergunta);
        break;
      default:
        throw new Error(`Tipo de tarefa desconhecido: ${task.tipo}`);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_TIMES[task.tipo] && MAX_TIMES[task.tipo] > 0) {
      throw new Error(`Tarefa ${task.tipo} excedeu o tempo máximo`);
    }

    return {
      status: 'succeeded',
      result,
      machineId: machine.id,
      timeMs: elapsed
    };
  } catch (error) {
    console.error(`Erro na tarefa local ${task.tipo}:`, error);
    throw error;
  }
}

module.exports = {
  executeLocalTask
};
