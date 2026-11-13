#!/usr/bin/env node
'use strict';
// Teste de carga do Cortex (#1629 / #2389). Grátis, sem dependência nova.
//   --falso (padrão): N pessoas mandam mensagem AO MESMO TEMPO para o handler real do cortex-chat, rodando aqui dentro,
//                     com login e IA simulados (resposta fixa com atraso aleatório). Mede o nosso código, não a IA.
//                     Nunca toca a produção nem gasta cota de IA.
//   --real:           poucas mensagens (no máximo 5) de verdade em --url, com o token em CORTEX_CARGA_TOKEN.
// Saída: carga-relatorio-<modo>-<pessoas>.json + tabela no console. Sai com código 1 se houver 5xx ou p95 > meta.
const fs = require('fs');
const path = require('path');

const META_P95_MS = 3000;
const MAX_REAL = 5;

function args(argv) {
  const a = { modo: argv.includes('--real') ? 'real' : 'falso', pessoas: 50, url: 'https://api.kernex.com.br/api/cortex', saida: '.' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pessoas') a.pessoas = Math.max(1, Math.min(5000, Number(argv[++i]) || 50));
    if (argv[i] === '--url') a.url = argv[++i];
    if (argv[i] === '--saida') a.saida = argv[++i];
  }
  if (a.modo === 'real') a.pessoas = Math.min(a.pessoas, MAX_REAL);
  return a;
}

/** Função pura: percentil (p entre 0 e 100) de uma lista de números. */
function percentil(lista, p) {
  const v = [...lista].filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}

/** Função pura: junta os resultados de cada pessoa num relatório. */
function resumir(res, { modo, pessoas, duracaoMs }) {
  const tempos = res.map((r) => r.ms);
  const erros5xx = res.filter((r) => r.status >= 500 || r.status === 0).length;
  const provedores = {};
  res.forEach((r) => { if (r.provedor) provedores[r.provedor] = (provedores[r.provedor] || 0) + 1; });
  const p95 = percentil(tempos, 95);
  return {
    modo, pessoas, duracao_total_ms: duracaoMs,
    ok: res.filter((r) => r.status >= 200 && r.status < 300).length,
    erros_5xx: erros5xx, erros_4xx: res.filter((r) => r.status >= 400 && r.status < 500).length,
    pct_erro: Math.round((1000 * res.filter((r) => !(r.status >= 200 && r.status < 300)).length) / Math.max(1, res.length)) / 10,
    primeira_resposta_ms: { p50: percentil(tempos, 50), p95, max: percentil(tempos, 100) },
    provedores,
    meta_p95_ms: META_P95_MS,
    passou: erros5xx === 0 && (p95 === null || modo === 'real' || p95 <= META_P95_MS),
  };
}

// Login e IA simulados só dentro deste processo (modo falso).
function prepararFalso() {
  const raiz = path.join(__dirname, '..');
  const fb = require.resolve(path.join(raiz, 'netlify/functions/firebase-init.js'));
  const admin = { apps: [1], auth: () => ({ verifyIdToken: async (t) => ({ uid: t }) }) };
  require.cache[fb] = { id: fb, filename: fb, loaded: true, exports: { admin, db: null } };
  const router = require(path.join(raiz, 'nexia-ai/model-router'));
  const falso = {
    capabilities: () => ({ available: true }),
    chat: async () => { await new Promise((r) => setTimeout(r, 50 + Math.random() * 350)); return { text: 'Resposta simulada do teste de carga.' }; },
    stream: async function* () { await new Promise((r) => setTimeout(r, 50 + Math.random() * 350)); yield 'Resposta simulada.'; },
  };
  router.getRouter = () => new Proxy(falso, { get: (o, k) => (k in o ? o[k] : async () => ({ text: 'ok' })) });
  return require(path.join(raiz, 'netlify/functions/cortex-chat.js'));
}

async function umaPessoaFalsa(chat, n) {
  const t0 = Date.now();
  try {
    const r = await chat.handler({ httpMethod: 'POST', headers: { authorization: `Bearer pessoa-${n}`, 'content-type': 'application/json', 'x-forwarded-for': `10.0.${n >> 8}.${n & 255}` }, body: JSON.stringify({ message: `Olá, sou a pessoa ${n}. Qual o horário de funcionamento?`, stream: false, conversationId: `carga-${n}` }) });
    let provedor = null; try { const b = JSON.parse(r.body || '{}'); provedor = b.model || b.provider || null; } catch { /* corpo em stream */ }
    return { status: r.statusCode, ms: Date.now() - t0, provedor };
  } catch (e) { return { status: 0, ms: Date.now() - t0, erro: String(e.message).slice(0, 120) }; }
}

async function umaPessoaReal(url, token, n) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ message: `Teste de carga ${n}: responda só "ok".`, stream: false }), signal: AbortSignal.timeout(60000) });
    let provedor = null; try { const b = await r.json(); provedor = b.model || b.provider || null; } catch { /* sem json */ }
    return { status: r.status, ms: Date.now() - t0, provedor };
  } catch (e) { return { status: 0, ms: Date.now() - t0, erro: String(e.message).slice(0, 120) }; }
}

async function main() {
  const a = args(process.argv.slice(2));
  let tarefa;
  if (a.modo === 'falso') { const chat = prepararFalso(); tarefa = (n) => umaPessoaFalsa(chat, n); } else {
    const token = process.env.CORTEX_CARGA_TOKEN;
    if (!token) { console.log('Modo real precisa do segredo CORTEX_CARGA_TOKEN (login de teste). Nada foi enviado.'); process.exit(1); }
    tarefa = (n) => umaPessoaReal(a.url, token, n);
  }
  const t0 = Date.now();
  const res = await Promise.all(Array.from({ length: a.pessoas }, (_, n) => tarefa(n)));
  const rel = resumir(res, { modo: a.modo, pessoas: a.pessoas, duracaoMs: Date.now() - t0 });
  rel.amostra_erros = res.filter((r) => r.erro || r.status >= 500).slice(0, 5);
  const arq = path.join(a.saida, `carga-relatorio-${a.modo}-${a.pessoas}.json`);
  fs.writeFileSync(arq, JSON.stringify(rel, null, 2));
  console.log(`\nCortex — teste de carga (${a.modo}, ${a.pessoas} pessoas ao mesmo tempo)`);
  console.log(`| ok | 4xx | 5xx | p50 | p95 | máx | total |\n|---|---|---|---|---|---|---|\n| ${rel.ok} | ${rel.erros_4xx} | ${rel.erros_5xx} | ${rel.primeira_resposta_ms.p50} ms | ${rel.primeira_resposta_ms.p95} ms | ${rel.primeira_resposta_ms.max} ms | ${rel.duracao_total_ms} ms |`);
  console.log(rel.passou ? `✅ Passou (sem 5xx${a.modo === 'falso' ? `, p95 ≤ ${META_P95_MS} ms` : ''}). Relatório: ${arq}` : `❌ Não passou. Relatório: ${arq}`);
  process.exit(rel.passou ? 0 : 1);
}

if (require.main === module) main();
module.exports = { percentil, resumir, args };
