'use strict';

// Body Coach: respostas prontas (sem IA), cache de 24 h e lista de modelos só grátis.

const { FREE } = require('../../../nexia-ai/orchestrator/models');

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : null);

/** Só modelos grátis; o Body Coach nunca usa provedor pago, mesmo com a chave configurada. */
function listaGratis(classe) {
  return (classe === 'reasoning' ? FREE.reasoning : FREE.fast).filter((d) => d.provider !== 'anthropic');
}

const REGRAS = [
  { re: /(quanto|o que).*(posso|devo|falta|resta|ainda).*(comer|kcal|caloria)|quantas calorias (ainda|faltam|restam)/, f: (c) => {
    const k = num(c.kcalRestantes ?? c.restanteKcal ?? c.kcalFaltam); const p = num(c.proteinaRestante ?? c.proteinaFalta);
    return k === null ? 'Abra a aba Nutrição: lá aparece quanto ainda cabe no seu dia, já descontando o que você registrou.' : `Ainda cabem cerca de ${k} kcal hoje${p !== null ? ` e faltam uns ${p} g de proteína` : ''}. Prefira comida de verdade e proteína primeiro.`;
  } },
  { re: /(que|qual).*(treino|treinar).*(hoje)|o que (eu )?(treino|treinar) hoje|treino de hoje/, f: (c) => {
    const t = String(c.treinoHoje || c.treinoDoDia || '').slice(0, 60);
    return t ? `Hoje é dia de ${t}. Toque em INICIAR TREINO na tela inicial. Se quiser trocar, use Mudar treino de hoje.` : 'Na tela inicial, o cartão de hoje mostra o treino do dia. Se quiser outro, toque em Mudar treino de hoje.';
  } },
  { re: /troc(a|ar).*(exercicio)|exercicio.*(substitu|trocar|no lugar)|(sem|nao tenho) (o )?(aparelho|equipamento)/, f: () => 'Dá para trocar: dentro do treino, toque no exercício e escolha Trocar. Ele sugere outro que trabalha o mesmo músculo com o equipamento que você tem.' },
  { re: /\bagua\b|hidrat|quanto.*beber/, f: (c) => {
    const kg = num(c.pesoKg ?? c.peso); const l = kg ? Math.round(kg * 35) / 1000 : null;
    return l ? `Uma conta simples é 35 ml por kg: no seu peso, cerca de ${String(l).replace('.', ',')} litros por dia, um pouco mais se treinar ou fizer calor.` : 'Uma conta simples é 35 ml por kg de peso por dia, um pouco mais se treinar ou fizer calor.';
  } },
  { re: /\bsono\b|dormi|dormir|insonia/, f: () => 'Tente dormir de 7 a 9 horas, no mesmo horário, sem tela na última meia hora. É no sono que o músculo se recupera e a fome se regula.' },
];

/** Resposta pronta quando a pergunta é comum; senão null (aí chama a IA). */
function respostaLocal(mensagem, contexto) {
  const t = norm(mensagem);
  if (!t || t.length > 120) return null;
  const c = contexto && typeof contexto === 'object' ? contexto : {};
  for (const r of REGRAS) if (r.re.test(t)) return r.f(c);
  return null;
}

const TTL = 24 * 3600 * 1000;
const MAX = 500;
const cache = new Map();
const chave = (papel, mensagem, contexto) => `${papel}|${norm(mensagem)}|${norm(JSON.stringify(contexto || {})).slice(0, 400)}`;
function cacheGet(papel, mensagem, contexto, agora = Date.now()) {
  const k = chave(papel, mensagem, contexto); const e = cache.get(k);
  if (!e) return null;
  if (agora - e.em > TTL) { cache.delete(k); return null; }
  return e.texto;
}
function cachePut(papel, mensagem, contexto, texto, agora = Date.now()) {
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(chave(papel, mensagem, contexto), { texto, em: agora });
}

const SEM_IA = 'Estou com a conexão cheia agora e não consegui pensar numa resposta boa. Tente de novo em alguns minutos. Enquanto isso, a aba Hoje mostra seu treino e a Nutrição mostra o que ainda cabe no dia.';

module.exports = { listaGratis, respostaLocal, cacheGet, cachePut, SEM_IA, norm };
