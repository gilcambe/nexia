import crypto from 'node:crypto';

const GATILHOS = ['system', 'prompt', 'instructions', 'role:', 'content:'];

function contemGatilho(linhas, indiceLinha) {
  const inicio = Math.max(0, indiceLinha - 3);
  for (let i = inicio; i <= indiceLinha; i++) {
    const l = (linhas[i] || '').toLowerCase();
    if (GATILHOS.some((g) => l.includes(g))) {
      return true;
    }
  }
  return false;
}

function normalizarTexto(texto) {
  return texto
    .replace(/\$\{[^}]*\}/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function calcularHash(textoNormalizado) {
  return crypto.createHash('sha1').update(textoNormalizado).digest('hex');
}

function extrairLiterais(codigo) {
  const literais = [];
  const n = codigo.length;
  let i = 0;
  let linha = 1;

  while (i < n) {
    const c = codigo[i];

    if (c === '\n') {
      linha++;
      i++;
      continue;
    }

    // Pular comentários de linha //
    if (c === '/' && codigo[i + 1] === '/') {
      i += 2;
      while (i < n && codigo[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Pular comentários de bloco /* */
    if (c === '/' && codigo[i + 1] === '*') {
      i += 2;
      while (i < n && !(codigo[i] === '*' && codigo[i + 1] === '/')) {
        if (codigo[i] === '\n') linha++;
        i++;
      }
      if (i < n) i += 2;
      continue;
    }

    // Literais de string: ', ", `
    if (c === "'" || c === '"' || c === '`') {
      const delimitador = c;
      const linhaInicio = linha;
      const inicioConteudo = i + 1;
      i++;
      let fechou = false;

      while (i < n) {
        if (codigo[i] === '\\') {
          if (codigo[i + 1] === '\n') {
            linha++;
          }
          i += 2;
          continue;
        }
        if (codigo[i] === '\n') {
          linha++;
        }
        if (codigo[i] === delimitador) {
          fechou = true;
          break;
        }
        i++;
      }

      if (fechou) {
        const conteudo = codigo.slice(inicioConteudo, i);
        literais.push({
          conteudo,
          linha: linhaInicio,
        });
        i++; // avançar delimitador final
      }
      continue;
    }

    i++;
  }

  return literais;
}

function gerarShingles(texto, k = 5) {
  const palavras = texto.split(' ').filter(Boolean);
  const shingles = new Set();
  if (palavras.length < k) {
    if (palavras.length > 0) {
      shingles.add(palavras.join(' '));
    }
    return shingles;
  }
  for (let i = 0; i <= palavras.length - k; i++) {
    shingles.add(palavras.slice(i, i + k).join(' '));
  }
  return shingles;
}

function similaridadeJaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersecao = 0;
  for (const item of setA) {
    if (setB.has(item)) intersecao++;
  }
  const uniao = setA.size + setB.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

export function acharPrompts(arquivos = [], opcoes = {}) {
  const minChars = typeof opcoes.minChars === 'number' ? opcoes.minChars : 200;
  const limiteTokens = typeof opcoes.limiteTokens === 'number' ? opcoes.limiteTokens : 3000;

  const prompts = [];
  const mapaHash = new Map(); // hash -> { ocorrencias: [{ arquivo, linha }], tokensEstimados, textoNorm, promptRef }

  for (const { caminho, texto } of arquivos) {
    if (typeof texto !== 'string' || !texto) continue;
    const linhas = texto.split('\n');
    const literais = extrairLiterais(texto);

    for (const lit of literais) {
      if (lit.conteudo.length < minChars) continue;
      if (!contemGatilho(linhas, lit.linha - 1)) continue;

      const tamanho = lit.conteudo.length;
      const tokensEstimados = Math.ceil(tamanho / 4);
      const textoNorm = normalizarTexto(lit.conteudo);
      const hash = calcularHash(textoNorm);

      const item = {
        arquivo: caminho,
        linha: lit.linha,
        tamanho,
        tokensEstimados,
        hash,
      };

      prompts.push(item);

      if (!mapaHash.has(hash)) {
        mapaHash.set(hash, {
          hash,
          ocorrencias: [{ arquivo: caminho, linha: lit.linha }],
          tokensEstimados,
          textoNorm,
          promptRef: item,
        });
      } else {
        mapaHash.get(hash).ocorrencias.push({ arquivo: caminho, linha: lit.linha });
      }
    }
  }

  const repetidos = [];
  for (const entry of mapaHash.values()) {
    if (entry.ocorrencias.length >= 2) {
      repetidos.push({
        hash: entry.hash,
        ocorrencias: entry.ocorrencias,
        tokensEstimados: entry.tokensEstimados,
      });
    }
  }

  // Parecidos: pares de hashes diferentes com Jaccard >= 0.8
  const listaUnica = Array.from(mapaHash.values());
  const shinglesMap = new Map();
  for (const u of listaUnica) {
    shinglesMap.set(u.hash, gerarShingles(u.textoNorm, 5));
  }

  const parecidos = [];
  for (let i = 0; i < listaUnica.length; i++) {
    for (let j = i + 1; j < listaUnica.length; j++) {
      const a = listaUnica[i];
      const b = listaUnica[j];
      const setA = shinglesMap.get(a.hash);
      const setB = shinglesMap.get(b.hash);
      const similaridade = similaridadeJaccard(setA, setB);
      if (similaridade >= 0.8) {
        parecidos.push({
          a: a.promptRef,
          b: b.promptRef,
          similaridade,
        });
      }
    }
  }

  parecidos.sort((x, y) => y.similaridade - x.similaridade);
  const parecidosLimitados = parecidos.slice(0, 50);

  const grandes = prompts.filter((p) => p.tokensEstimados > limiteTokens);

  return {
    prompts,
    repetidos,
    parecidos: parecidosLimitados,
    grandes,
  };
}
