function removerAcentosEMinusculas(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const ETAPAS_RAG = {
  ingestao: ['ingest', 'ingerir', 'importar documento'],
  chunking: ['chunk', 'pedaco'],
  embeddings: ['embedding'],
  indice: ['vectorize', 'vector store', 'pgvector', 'qdrant', 'faiss', 'chroma', 'indice vetorial'],
  recuperacao: ['retriev', 'similaridade', 'cosseno', 'top_k', 'topk'],
  reranking: ['rerank'],
  cache_semantico: ['cache semantico', 'cache-semantico'],
};

const NOMES_ETAPAS = Object.keys(ETAPAS_RAG);

function ehArquivoTeste(caminho) {
  const norm = String(caminho || '').toLowerCase().replace(/\\/g, '/');
  if (/\.(test|spec)\.[a-z0-9]+$/i.test(norm)) return true;
  if (/[-_.](test|spec)\.[a-z0-9]+$/i.test(norm)) return true;
  if (/(^|\/)(__tests__|tests?|fixtures)\//i.test(norm)) return true;
  return false;
}

function ehAgente(caminho) {
  if (ehArquivoTeste(caminho)) return false;
  const norm = removerAcentosEMinusculas(caminho);
  return /(agent|agente|swarm|engine|robo|robots)/.test(norm);
}

function extrairNomeArquivo(caminho) {
  const base = String(caminho || '').split(/[/\\]/).pop() || '';
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(0, idx) : base;
}

function contemPalavraInteira(texto, palavra) {
  if (!texto || !palavra) return false;
  const escaped = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}(?![a-zA-Z0-9_-])`);
  return regex.test(texto);
}

function extrairFuncoes(texto) {
  const funcoes = new Set();
  if (!texto) return funcoes;

  // 1. function nome(...) / async function nome(...)
  const reFunction = /(?:^|[^\w$])(?:async\s+)?function(?:\s*\*|\s+)\s*([a-zA-Z0-9_$]+)\s*(?:<[^>]*>)?\s*\(/g;
  let m;
  while ((m = reFunction.exec(texto)) !== null) {
    if (m[1]) funcoes.add(m[1]);
  }

  // 2. const nome = ( ou const nome = async
  const reConst = /(?:^|[^\w$])(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*(?::\s*[^=]+)?=\s*(?:async\b|\(|function\b)/g;
  while ((m = reConst.exec(texto)) !== null) {
    if (m[1]) funcoes.add(m[1]);
  }

  return funcoes;
}

function calcularJaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersecao = 0;
  for (const item of setA) {
    if (setB.has(item)) intersecao++;
  }
  const uniao = setA.size + setB.size - intersecao;
  if (uniao === 0) return 0;
  return intersecao / uniao;
}

function analisarArquitetura(arquivos = []) {
  const listaArquivos = Array.isArray(arquivos) ? arquivos : [];

  // 1. RAG
  const etapas = {};
  for (const etapa of NOMES_ETAPAS) {
    etapas[etapa] = [];
  }

  for (const arq of listaArquivos) {
    const caminho = arq.caminho || '';
    const textoNorm = removerAcentosEMinusculas(arq.texto || '');

    for (const etapa of NOMES_ETAPAS) {
      const palavras = ETAPAS_RAG[etapa];
      const match = palavras.some((p) => textoNorm.includes(p));
      if (match && !etapas[etapa].includes(caminho)) {
        etapas[etapa].push(caminho);
      }
    }
  }

  const faltando = NOMES_ETAPAS.filter((etapa) => etapas[etapa].length === 0);

  // 2. Agentes
  const arquivosAgentes = listaArquivos.filter((arq) => ehAgente(arq.caminho));
  const agentesMeta = arquivosAgentes.map((arq) => ({
    arquivo: arq.caminho,
    nome: extrairNomeArquivo(arq.caminho),
    texto: arq.texto || '',
    funcoes: extrairFuncoes(arq.texto || ''),
  }));

  const agentes = agentesMeta.map((agente) => {
    const chamadoPor = [];
    for (const outro of listaArquivos) {
      if (outro.caminho === agente.arquivo) continue;
      if (contemPalavraInteira(outro.texto, agente.nome)) {
        chamadoPor.push(outro.caminho);
      }
    }

    const parecidoCom = [];
    for (const outro of agentesMeta) {
      if (outro.arquivo === agente.arquivo) continue;
      const jaccard = calcularJaccard(agente.funcoes, outro.funcoes);
      if (jaccard >= 0.5) {
        parecidoCom.push(outro.arquivo);
      }
    }

    return {
      arquivo: agente.arquivo,
      nome: agente.nome,
      chamadoPor,
      orfao: chamadoPor.length === 0,
      parecidoCom,
    };
  });

  return {
    rag: {
      etapas,
      faltando,
    },
    agentes,
  };
}

module.exports = {
  analisarArquitetura,
  default: analisarArquitetura,
};
