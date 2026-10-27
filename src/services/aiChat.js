// Wrapper de chamada ao modelo de chat do Cortex.
// Mantém a funcionalidade original de api.cortexChat e adiciona registro de uso.
import { api } from "./api.ts";
import { registrarUso } from "../models/uso.js";
import { calcularCusto } from "../lib/cortex-precos.js";

// Estima tokens a partir de caracteres (aprox. 4 caracteres = 1 token).
function estimarTokens(texto) {
  if (!texto) return 0;
  return Math.ceil(String(texto).length / 4);
}

// Extrai dados de uso da resposta. Se não houver usage.tokens_in/out, estima.
function extrairUsage(resposta, mensagemUsuario) {
  const data = resposta.data ?? {};
  const meta = data._meta ?? {};
  const usageResposta = meta.usage ?? data.usage ?? {};

  let tokensIn, tokensOut, estimado = false;

  if (usageResposta.tokens_in !== undefined && usageResposta.tokens_in !== null) {
    tokensIn = Number(usageResposta.tokens_in);
    tokensOut = Number(usageResposta.tokens_out ?? 0);
  } else {
    estimado = true;
    tokensIn = estimarTokens(mensagemUsuario);
    tokensOut = estimarTokens(data.reply ?? resposta.error ?? "");
    console.log(
      "[aiChat] usage ausente na resposta, estimando tokens:",
      "in=", tokensIn, "out=", tokensOut
    );
  }

  return { tokensIn, tokensOut, estimado };
}

// Detecta se a resposta veio do cache.
function detectarCache(resposta) {
  const data = resposta.data ?? {};
  return Boolean(
    data.fromCache ??
    resposta.fromCache ??
    data._meta?.fromCache ??
    data.from_cache
  );
}

// Envia uma mensagem ao modelo e registra o uso.
// Parâmetros:
// - message: texto da mensagem
// - model: modelo solicitado (opcional, padrão "auto")
// - cliente: identificador do cliente
// - plano: plano do cliente
// - provedor: provedor de IA usado
// - demais campos são repassados para api.cortexChat
export async function sendMessage({
  message,
  model = "auto",
  cliente = "default",
  plano = "gratuito",
  provedor = "desconhecido",
  ...rest
} = {}) {
  // 1) Chama a funcionalidade original (cortex chat, sem stream).
  const resposta = await api.cortexChat({ message, model, ...rest });

  // 2) Extrai modelo usado da resposta (fallback para o solicitado).
  const meta = (resposta.data && resposta.data._meta) || {};
  const modeloUsado = meta.modelUsed || model || "desconhecido";

  // 3) Tokens de entrada e saída (da resposta usage ou estimativa).
  const { tokensIn, tokensOut } = extrairUsage(resposta, message);

  // 4) Detecta se veio do cache.
  const fromCache = detectarCache(resposta);

  // 5) Custo estimado.
  const custo = calcularCusto(tokensIn, tokensOut, provedor, modeloUsado);

  // 6) Registra o uso com todos os dados capturados.
  await registrarUso({
    cliente,
    plano,
    provedor,
    modelo: modeloUsado,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    fromCache,
    custo,
  });

  // Mantém a funcionalidade original: devolve a resposta completa.
  return resposta;
}

export default { sendMessage };
