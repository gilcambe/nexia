'use strict';

/**
 * Limites e orçamentos de cota por hora por provedor.
 * Mantém o rastreamento de requisições e tokens consumidos em cada janela horária
 * e calcula quanto resta para cada IA. Se atingir 90% do orçamento ou ocorrer 429,
 * indica o pulo imediato para o próximo provedor/modelo.
 */

const UMA_HORA_MS = 60 * 60 * 1000;
const LIMIAR_ALERTA = 0.90; // 90% do orçamento

// Orçamentos por hora padrão (planos gratuitos conhecidos)
const ORCAMENTOS_PADRAO = {
  groq: { requestsPerHour: 30, tokensPerHour: 60000 },
  gemini: { requestsPerHour: 15, tokensPerHour: 60000 },
  openrouter: { requestsPerHour: 20, tokensPerHour: 40000 },
  github: { requestsPerHour: 20, tokensPerHour: 50000 },
  jules: { requestsPerHour: 10, tokensPerHour: 30000 },
  mistral: { requestsPerHour: 15, tokensPerHour: 40000 },
  cohere: { requestsPerHour: 10, tokensPerHour: 20000 },
  default: { requestsPerHour: 15, tokensPerHour: 40000 },
};

function getHoraChave(timestamp = Date.now()) {
  const d = new Date(timestamp);
  return `${d.toISOString().slice(0, 13)}:00`; // YYYY-MM-DDTHH:00
}

function normalizarProvedor(provedor) {
  if (!provedor) return 'default';
  const p = String(provedor).toLowerCase().trim();
  return ORCAMENTOS_PADRAO[p] ? p : 'default';
}

function createRastreadorHora({ agora = () => Date.now(), orcamentos = ORCAMENTOS_PADRAO } = {}) {
  // chave: `${provider}:${horaKey}` -> { requests: number, tokens: number }
  const usoHora = new Map();

  function obterOrcamento(provider) {
    const p = normalizarProvedor(provider);
    return orcamentos[p] || orcamentos.default;
  }

  function getChave(provider, ts = agora()) {
    return `${normalizarProvedor(provider)}:${getHoraChave(ts)}`;
  }

  function registrarConsumo(provider, { requests = 1, tokens = 0 } = {}) {
    const k = getChave(provider);
    const atual = usoHora.get(k) || { requests: 0, tokens: 0 };
    atual.requests += Number(requests) || 0;
    atual.tokens += Math.max(0, Number(tokens) || 0);
    usoHora.set(k, atual);
    return atual;
  }

  function quantoResta(provider, ts = agora()) {
    const p = normalizarProvedor(provider);
    const orc = obterOrcamento(p);
    const k = getChave(p, ts);
    const atual = usoHora.get(k) || { requests: 0, tokens: 0 };

    const requestsRestantes = Math.max(0, orc.requestsPerHour - atual.requests);
    const tokensRestantes = Math.max(0, orc.tokensPerHour - atual.tokens);
    const percReq = orc.requestsPerHour > 0 ? atual.requests / orc.requestsPerHour : 0;
    const percTok = orc.tokensPerHour > 0 ? atual.tokens / orc.tokensPerHour : 0;
    const maiorUso = Math.max(percReq, percTok);

    return {
      provider: p,
      restaNestaHora: {
        requests: requestsRestantes,
        tokens: tokensRestantes,
      },
      limiteNestaHora: {
        requests: orc.requestsPerHour,
        tokens: orc.tokensPerHour,
      },
      usadoNestaHora: {
        requests: atual.requests,
        tokens: atual.tokens,
      },
      procentagemUsada: Math.min(100, Math.round(maiorUso * 100)),
      quaseEsgotado: maiorUso >= LIMIAR_ALERTA,
      esgotado: requestsRestantes <= 0 || tokensRestantes <= 0,
    };
  }

  function podeExecutar(provider) {
    const resta = quantoResta(provider);
    return !resta.quaseEsgotado && !resta.esgotado;
  }

  function cardCentral(ts = agora()) {
    const provedores = Object.keys(orcamentos).filter(k => k !== 'default');
    const dados = {};
    for (const prov of provedores) {
      const info = quantoResta(prov, ts);
      dados[prov] = {
        label: `Resta ${info.restaNestaHora.requests} reqs (${Math.round(info.restaNestaHora.tokens / 1000)}k tokens) nesta hora`,
        restaRequests: info.restaNestaHora.requests,
        restaTokens: info.restaNestaHora.tokens,
        esgotado: info.esgotado,
        quaseEsgotado: info.quaseEsgotado,
        procentagemUsada: info.procentagemUsada,
      };
    }
    return dados;
  }

  function limpar() {
    usoHora.clear();
  }

  return {
    registrarConsumo,
    quantoResta,
    podeExecutar,
    cardCentral,
    obterOrcamento,
    limpar,
  };
}

let rastreadorCompartilhado = null;
function getRastreadorHora() {
  if (!rastreadorCompartilhado) {
    rastreadorCompartilhado = createRastreadorHora();
  }
  return rastreadorCompartilhado;
}

module.exports = {
  UMA_HORA_MS,
  LIMIAR_ALERTA,
  ORCAMENTOS_PADRAO,
  createRastreadorHora,
  getRastreadorHora,
};
