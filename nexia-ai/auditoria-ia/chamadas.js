// KERNEX AI Auditor: chamadas de IA, provedores e modelos.
// Análise estática apenas por leitura de texto.

const PROVEDORES = [
  { id: 'groq', padroes: ['api.groq.com'] },
  { id: 'gemini', padroes: ['generativelanguage.googleapis.com'] },
  { id: 'openrouter', padroes: ['openrouter.ai'] },
  { id: 'anthropic', padroes: ['api.anthropic.com'] },
  { id: 'openai', padroes: ['api.openai.com'] },
  { id: 'cerebras', padroes: ['api.cerebras.ai'] },
  { id: 'mistral', padroes: ['api.mistral.ai'] },
  { id: 'cohere', padroes: ['api.cohere'] },
  { id: 'deepseek', padroes: ['api.deepseek.com'] },
  { id: 'together', padroes: ['api.together'] },
  { id: 'workers-ai', padroes: ['AI.run('] },
  { id: 'ollama', padroes: ['localhost:11434', 'new Ollama('] }
];

const PADROES_LACO = [
  'for (',
  'for(',
  'while',
  '.map(',
  '.forEach(',
  'Promise.all('
];

function ehComentario(linha) {
  const trim = linha.trimStart();
  return trim.startsWith('//') || trim.startsWith('*');
}

function detectarProvedor(linha) {
  for (const { id, padroes } of PROVEDORES) {
    for (const p of padroes) {
      if (linha.includes(p)) {
        return id;
      }
    }
  }
  return null;
}

function extrairModelo(linhas, indiceAtual) {
  const limite = Math.min(linhas.length, indiceAtual + 6);
  const regexModelo = /(?:model|["']model["'])\s*:\s*["'`]([^"'`]+)["'`]/;

  for (let i = indiceAtual; i < limite; i++) {
    const match = linhas[i].match(regexModelo);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function checarEmLaco(linhas, indiceAtual) {
  const inicio = Math.max(0, indiceAtual - 6);
  for (let i = inicio; i < indiceAtual; i++) {
    const l = linhas[i];
    for (const padrao of PADROES_LACO) {
      if (l.includes(padrao)) {
        return true;
      }
    }
  }
  return false;
}

function verificarViaRoteador(caminho, texto) {
  if (caminho && caminho.startsWith('nexia-ai/model-router/')) {
    return true;
  }
  const regexImportOuRequire = /(?:require\s*\(\s*['"][^'"]*model-router[^'"]*['"]\s*\)|from\s*['"][^'"]*model-router[^'"]*['"])/;
  return regexImportOuRequire.test(texto);
}

function acharChamadasIa(arquivos = []) {
  const chamadas = [];
  const porProvedor = {};
  const porModelo = {};
  let foraDoRoteador = 0;

  for (const arq of arquivos) {
    const caminho = arq.caminho || '';
    const texto = arq.texto || '';
    const viaRoteador = verificarViaRoteador(caminho, texto);
    const linhas = texto.split(/\r?\n/);

    for (let idx = 0; idx < linhas.length; idx++) {
      const linha = linhas[idx];
      if (ehComentario(linha)) {
        continue;
      }

      const provedor = detectarProvedor(linha);
      if (!provedor) {
        continue;
      }

      const modelo = extrairModelo(linhas, idx);
      const emLaco = checarEmLaco(linhas, idx);
      const numLinha = idx + 1;

      chamadas.push({
        arquivo: caminho,
        linha: numLinha,
        provedor,
        modelo,
        viaRoteador,
        emLaco
      });

      porProvedor[provedor] = (porProvedor[provedor] || 0) + 1;
      if (modelo) {
        porModelo[modelo] = (porModelo[modelo] || 0) + 1;
      }
      if (!viaRoteador) {
        foraDoRoteador++;
      }
    }
  }

  return {
    chamadas,
    porProvedor,
    porModelo,
    foraDoRoteador
  };
}

module.exports = {
  acharChamadasIa
};
