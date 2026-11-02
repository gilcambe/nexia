'use strict';
// #2855 (parte 3 de #2729): encolher o contexto antes de cada pedido ao modelo.
// Conta tokens (estimativa: 4 caracteres = 1 token). Se a conversa passa do limite, mantém o
// system e as mensagens mais recentes e troca as antigas por um resumo curto (sem gastar IA).
// Conversa com ferramentas (tool_calls / role tool) não é mexida: cortar quebraria os pares.
const LIMITE_PADRAO = 24000;

const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && (p.text || p.content)) || '').join(' ') : c == null ? '' : JSON.stringify(c));
const contarTokens = (t) => Math.ceil(String(t || '').length / 4);
function tokensDoPedido(req) {
  return contarTokens(req.system) + (req.messages || []).reduce((s, m) => s + contarTokens(textoDe(m && m.content)) + 4, 0);
}
const temFerramentas = (req) => (req.messages || []).some((m) => m && (m.role === 'tool' || (m.tool_calls && m.tool_calls.length) || (Array.isArray(m.content) && m.content.some((p) => p && /tool/.test(p.type || '')))));

function limiteDe(req, env = process.env) {
  const v = Number(req.limiteContexto || env.NEXIA_LIMITE_CONTEXTO || LIMITE_PADRAO);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Resumo sem IA: começo de cada mensagem antiga, até caber na fatia do resumo. */
function resumir(mensagens, maxTokens) {
  const linhas = [];
  let usado = 0;
  for (const m of mensagens) {
    const t = textoDe(m.content).replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const linha = `${m.role === 'assistant' ? 'IA' : 'Pessoa'}: ${t.slice(0, 200)}${t.length > 200 ? '…' : ''}`;
    if (usado + contarTokens(linha) > maxTokens) { linhas.push('(… mais mensagens antigas omitidas)'); break; }
    linhas.push(linha); usado += contarTokens(linha);
  }
  return 'Resumo da conversa anterior (encurtada para caber):\n' + linhas.join('\n');
}

/** Devolve { req, antes, depois, resumidas }. Nunca corta a última mensagem. */
function encolher(req, env = process.env, log = console.log) {
  const limite = limiteDe(req, env);
  const antes = tokensDoPedido(req);
  const msgs = req.messages || [];
  if (!limite || antes <= limite || msgs.length < 3 || temFerramentas(req)) return { req, antes, depois: antes, resumidas: 0 };
  const fatiaResumo = Math.floor(limite * 0.15);
  let espaco = limite - contarTokens(req.system) - fatiaResumo;
  const mantidas = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const t = contarTokens(textoDe(msgs[i] && msgs[i].content)) + 4;
    if (mantidas.length && t > espaco) break;
    mantidas.unshift(msgs[i]); espaco -= t;
  }
  // A conversa precisa continuar começando por uma fala da pessoa.
  while (mantidas.length > 1 && mantidas[0].role === 'assistant') mantidas.shift();
  const antigas = msgs.slice(0, msgs.length - mantidas.length);
  if (!antigas.length) return { req, antes, depois: antes, resumidas: 0 };
  const novo = { ...req, messages: [{ role: 'user', content: resumir(antigas, fatiaResumo) }, { role: 'assistant', content: 'Entendi o resumo. Pode continuar.' }, ...mantidas] };
  const depois = tokensDoPedido(novo);
  if (log) log(`[contexto] prompt ~${antes} -> ~${depois} tokens (limite ${limite}); resumiu ${antigas.length} mensagens antigas`);
  return { req: novo, antes, depois, resumidas: antigas.length };
}

module.exports = { contarTokens, tokensDoPedido, encolher, resumir, limiteDe, LIMITE_PADRAO };
