'use strict';

// scripts/licao-auto.js
// Aprendizado automático do Cortex: quando um PR mesclado em develop cita uma issue
// que passou por jules-enviado, gemini-cli ou vez-do-claude, o Cortex gera uma lição
// curta (erro + jeito certo) e, se for nova, abre uma issue na fila do Cortex.
// Máximo de 3 lições por dia.

const { getRouter } = require('../nexia-ai/model-router');

// Limite diário de lições geradas automaticamente.
const MAX_LICOES_POR_DIA = 3;

// Rótulos que indicam que a issue passou por uma IA ajudante (degrau 2 ou 3).
const ROTULOS_AJUDANTE = new Set(['jules-enviado', 'gemini-cli', 'vez-do-claude']);

// Fração de palavras em comum (60%) para considerar uma lição repetida.
const LIMITE_REPETICAO = 0.6;

// Número máximo de caracteres da frase gerada.
const MAX_CARACTERES = 300;

// Palavras de parada (stopwords) em português para comparação de repetição.
const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sobre', 'entre',
  'e', 'ou', 'mas', 'que', 'se', 'como', 'mais', 'menos', 'muito', 'pouco', 'bem',
  'mal', 'já', 'não', 'sim', 'talvez', 'então', 'logo', 'pois', 'porque', 'seja',
  'ser', 'estar', 'ter', 'fazer', 'ir', 'vir', 'dizer', 'faz', 'foi', 'era', 'são',
  'está', 'estão', 'tem', 'têm', 'isso', 'isto', 'aquele', 'aquela', 'este', 'esta'
]);

// Contador em memória de lições geradas hoje (reseta entre jobs do GitHub Actions).
let contadorHoje = 0;
let ultimoDia = null;

/** Retorna a data atual no fuso local (YYYY-MM-DD). */
function hojeStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Verifica se ainda podemos gerar uma lição hoje (máximo 3 por dia). */
function podeGerarHoje() {
  const dia = hojeStr();
  if (ultimoDia !== dia) {
    ultimoDia = dia;
    contadorHoje = 0;
  }
  return contadorHoje < MAX_LICOES_POR_DIA;
}

/** Incrementa o contador diário. */
function registrarGeracao() {
  const dia = hojeStr();
  if (ultimoDia !== dia) {
    ultimoDia = dia;
    contadorHoje = 0;
  }
  contadorHoje += 1;
}

/** Normaliza um texto para comparação de repetição: minúsculo, remove pontuação, retira stopwords. */
function palavrasRelevantes(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/[^\w\sÀ-ÿ]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 0 && !STOPWORDS.has(p));
}

/** Calcula a fração de palavras de `a` que também aparecem em `b` (0 a 1). */
function sobreposicaoPalavras(a, b) {
  const pa = palavrasRelevantes(a);
  const pb = palavrasRelevantes(b);
  if (pa.length === 0) return 0;
  const conjuntoB = new Set(pb);
  let iguais = 0;
  for (const p of pa) if (conjuntoB.has(p)) iguais += 1;
  return iguais / pa.length;
}

/** Verifica se uma frase já existe (ou é muito parecida) em uma lista de lições. */
function fraseJaExiste(frase, existentes) {
  if (!Array.isArray(existentes)) return false;
  for (const existente of existentes) {
    if (sobreposicaoPalavras(frase, existente) >= LIMITE_REPETICAO) return true;
  }
  return false;
}

/**
 * Função pura: monta o pedido de lição para a IA, a partir de uma issue e seu PR.
 * Não acessa rede nem GitHub. Só monta o texto do prompt.
 * @param {Object} issue - { number, title, body, labels: string[] }
 * @param {Object} pr - { number, title, body, merged: boolean, base: string }
 * @returns {{ prompt: string, issueNumber: number, prNumber: number } | null}
 */
function montarPedidoLicao(issue, pr) {
  if (!issue || !pr) return null;
  if (!pr.merged) return null;
  if (pr.base !== 'develop' && pr.base_ref !== 'develop') return null;

  const labels = new Set((issue.labels || []).map(l => (typeof l === 'string' ? l : l.name)));
  const temAjudante = [...ROTULOS_AJUDANTE].some(r => labels.has(r));
  if (!temAjudante) return null;

  const numeroIssue = issue.number;
  const corpo = (issue.body || '') + '\n\n--- PR #' + pr.number + ': ' + (pr.title || '') + '\n' + (pr.body || '');

  const prompt = '\nGere UMA frase curta (até 300 caracteres), em português simples, no estilo das lições existentes do Cortex:\n"erro que o Cortex cometeu + jeito certo".\n\nContexto da tarefa (issue #' + numeroIssue + '): ' + (issue.title || '') + '\n' + corpo.slice(0, 1500) + '\n\nRegras:\n- Uma só frase.\n- Máximo 300 caracteres.\n- Foque no erro real do Cortex e no jeito certo de fazer.\n- Não use exemplos fixos, não invente funções nem importações.\n- Não comece com "Lição:" nem com numeração.\n'.trim();

  return { prompt, issueNumber: numeroIssue, prNumber: pr.number };
}

/**
 * Gera a lição (frase de até 300 caracteres) usando uma IA rápida e gratuita da cadeia
 * (listFor('fast'), sem anthropic).
 * @param {string} prompt
 * @param {Object} [opts] - { router?, listFor? }
 * @returns {Promise<string|null>}
 */
async function gerarLicao(prompt, opts = {}) {
  const router = opts.router || getRouter();
  let descs;
  try {
    const listFor = opts.listFor || (typeof router.listFor === 'function' ? router.listFor : null);
    if (listFor) {
      descs = listFor('fast').filter(d => d.provider !== 'anthropic');
    } else {
      descs = [
        { provider: 'groq', model: 'llama-3.1-8b-instant' },
        { provider: 'gemini', model: 'gemini-1.5-flash' },
        { provider: 'codestral', model: 'codestral-latest' },
        { provider: 'nvidia', model: 'nemotron-mini' },
        { provider: 'mistral', model: 'mistral-small' },
        { provider: 'openrouter', model: 'openrouter/auto' },
        { provider: 'zai', model: 'z-ai' },
        { provider: 'llm7', model: 'llm7' }
      ];
    }
  } catch {
    descs = [
      { provider: 'groq', model: 'llama-3.1-8b-instant' },
      { provider: 'gemini', model: 'gemini-1.5-flash' }
    ];
  }

  const req = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 120
  };

  let ultimoErro = null;
  for (const d of descs) {
    try {
      const out = await router.chat(d, req);
      const texto = String(out && out.text || '').trim();
      if (texto) {
        const limpo = texto.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
        return limpo.slice(0, MAX_CARACTERES);
      }
    } catch (e) {
      ultimoErro = e;
      continue;
    }
  }
  console.warn('[licao-auto] IA não respondeu:', ultimoErro && ultimoErro.message);
  return null;
}

/** Lê as lições existentes de nexia-ai/orchestrator/licoes.js (via require, sem editar). */
function lerLicoesExistentes() {
  try {
    const mod = require('../nexia-ai/orchestrator/licoes');
    return Array.isArray(mod.LICOES) ? mod.LICOES : [];
  } catch {
    return [];
  }
}

/**
 * Abre uma issue na fila do Cortex (cortex-fila) pedindo para acrescentar a lição.
 * Não edita o arquivo licoes.js diretamente.
 * @param {Object} github - cliente Octokit com issues.create.
 * @param {string} repo - "owner/repo".
 * @param {string} frase
 * @param {number} issueNumero
 * @param {number} prNumero
 * @returns {Promise<Object|null>}
 */
async function abrirIssueFila(github, repo, frase, issueNumero, prNumero) {
  const titulo = 'Aprender lição automática do Cortex (issue #' + issueNumero + ', PR #' + prNumero + ')';
  const corpo = 'Acrescente no fim da lista LICOES em nexia-ai/orchestrator/licoes.js EXATAMENTE esta linha:\n\n' +
    '  \'' + frase.replace(/'/g, "\\'") + '\',' + '\n\n' +
    'Origem: PR #' + prNumero + ' mesclado em develop, citando issue #' + issueNumero +
    ' (jules-enviado / gemini-cli / vez-do-claude).';;
  try {
    const [owner, name] = repo.split('/');
    const res = await github.issues.create({ owner, repo: name, title: titulo, body: corpo, labels: ['cortex-fila'] });
    return res.data;
  } catch (e) {
    console.warn('[licao-auto] não abriu issue na fila:', e && e.message);
    return null;
  }
}

/**
 * Execução principal: chama quando um PR é mesclado em develop e cita uma issue com
 * rótulo ajudante (jules-enviado, gemini-cli ou vez-do-claude).
 * @param {Object} deps - { github, repo, router?, listFor?, pr?, issue? }
 * @returns {Promise<{ geradas: number, puladas: number, motivos: string[] }>}
 */
async function executar(deps = {}) {
  const motivos = [];
  let geradas = 0;
  let puladas = 0;

  if (!podeGerarHoje()) {
    motivos.push('limite diario atingido (' + MAX_LICOES_POR_DIA + ')');
    return { geradas: 0, puladas: 0, motivos };
  }

  const existentes = lerLicoesExistentes();

  if (!deps.pr || !deps.issue) {
    motivos.push('sem PR ou issue informados pelo caller');
    return { geradas: 0, puladas: 0, motivos };
  }

  const pedido = montarPedidoLicao(deps.issue, deps.pr);
  if (!pedido) {
    motivos.push('nao se aplica (PR nao mesclado, nao e develop ou issue sem rotulo ajudante)');
    return { geradas: 0, puladas: 0, motivos };
  }

  const frase = await gerarLicao(pedido.prompt, { router: deps.router, listFor: deps.listFor });
  if (!frase) {
    motivos.push('IA nao gerou frase');
    return { geradas: 0, puladas: 1, motivos };
  }

  if (fraseJaExiste(frase, existentes)) {
    motivos.push('frase repetida (>= ' + Math.round(LIMITE_REPETICAO * 100) + '% de palavras em comum)');
    return { geradas: 0, puladas: 1, motivos };
  }

  const criada = await abrirIssueFila(deps.github, deps.repo, frase, pedido.issueNumber, pedido.prNumber);
  if (criada) {
    registrarGeracao();
    geradas += 1;
    motivos.push('lição criada na issue fila #' + criada.number);
  } else {
    puladas += 1;
    motivos.push('falha ao abrir issue na fila');
  }

  return { geradas, puladas, motivos };
}

module.exports = {
  MAX_LICOES_POR_DIA,
  LIMITE_REPETICAO,
  MAX_CARACTERES,
  ROTULOS_AJUDANTE,
  hojeStr,
  podeGerarHoje,
  registrarGeracao,
  palavrasRelevantes,
  sobreposicaoPalavras,
  fraseJaExiste,
  montarPedidoLicao,
  gerarLicao,
  lerLicoesExistentes,
  abrirIssueFila,
  executar
};