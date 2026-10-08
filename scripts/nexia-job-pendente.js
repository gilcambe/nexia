#!/usr/bin/env node
'use strict';
// Fallback grátis da fila de tarefas quando a cota do Firestore acaba nos DOIS projetos (principal e B).
// Estado guardado em Issues do GitHub com o rótulo "nexia-job-pendente" (sem Firestore, sem serviço pago).
//   guardar  — (workflow "NEXIA Jobs") cria a Issue com o pedido, se ainda não existe uma igual.
//   reenviar — (workflow "Fila do Cortex", a cada 15 min) despacha de novo os pedidos parados há mais de
//              RETRY_MIN minutos e fecha a Issue. Se a cota ainda não voltou, a tarefa cria outra Issue.
// O pedido só tem ids (o validateJob confere); nada de segredo nem conteúdo.
const crypto = require('crypto');
const { validateJob } = require('../nexia-ai/jobs');

const LABEL = 'nexia-job-pendente';
const RETRY_MIN = 60;
const BOT = 'github-actions[bot]';

const chave = job => crypto.createHash('sha256').update(JSON.stringify(job)).digest('hex').slice(0, 16);
const titulo = job => `nexia-job pendente ${job.kind} ${chave(job)}`;

function lerPedido(body) {
  const m = /```json\n([\s\S]*?)\n```/.exec(String(body || ''));
  if (!m) return null;
  try { return validateJob(JSON.parse(m[1])); } catch { return null; }
}

// Função pura: quais Issues reenviar agora.
function paraReenviar(issues, agora = Date.now(), retryMin = RETRY_MIN) {
  return issues
    .filter(i => !i.pull_request && i.user && i.user.login === BOT)
    .filter(i => (i.labels || []).some(l => (typeof l === 'string' ? l : l.name) === LABEL))
    .filter(i => (agora - new Date(i.created_at).getTime()) / 60000 >= retryMin)
    .map(i => ({ numero: i.number, job: lerPedido(i.body) }))
    .filter(x => x.job);
}

function criarApi({ token, repo, fetchImpl = (...a) => fetch(...a) }) {
  return async (method, path, body) => {
    const r = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nexia-job-pendente', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  };
}

async function guardar({ api, job }) {
  const v = validateJob(job);
  const t = titulo(v);
  const abertas = await api('GET', `/issues?state=open&labels=${LABEL}&per_page=100`);
  if (abertas.some(i => i.title === t)) return { guardado: false, motivo: 'ja_existe' };
  await api('POST', '/issues', { title: t, labels: [LABEL],
    body: `Cota grátis do Firestore esgotada nos dois bancos. A "Fila do Cortex" despacha de novo em ${RETRY_MIN} min.\n\n\`\`\`json\n${JSON.stringify(v)}\n\`\`\`\n` });
  return { guardado: true };
}

async function reenviar({ api, ref = 'develop', agora = Date.now() }) {
  const abertas = await api('GET', `/issues?state=open&labels=${LABEL}&per_page=100`);
  const lista = paraReenviar(abertas, agora);
  for (const x of lista) {
    await api('POST', '/actions/workflows/nexia-jobs.yml/dispatches', { ref, inputs: { job: JSON.stringify(x.job) } });
    await api('PATCH', `/issues/${x.numero}`, { state: 'closed', state_reason: 'completed' });
  }
  return { reenviados: lista.length };
}

if (require.main === module) {
  const modo = process.argv[2];
  const api = criarApi({ token: process.env.GITHUB_TOKEN, repo: process.env.REPO || 'gilcambe/nexia' });
  const fs = require('fs');
  (async () => {
    if (modo === 'guardar') {
      const f = process.env.NEXIA_PENDING_FILE;
      if (!f || !fs.existsSync(f)) return console.log('[pendente] nada a guardar');
      console.log('[pendente]', JSON.stringify(await guardar({ api, job: JSON.parse(fs.readFileSync(f, 'utf8')) })));
    } else if (modo === 'reenviar') {
      console.log('[pendente]', JSON.stringify(await reenviar({ api, ref: process.env.REF || 'develop' })));
    } else { console.error('uso: nexia-job-pendente.js guardar|reenviar'); process.exit(2); }
  })().catch(e => { console.log(`::warning title=Pendentes do nexia-job::${String(e.message).slice(0, 200)}`); process.exit(modo === 'guardar' ? 1 : 0); });
}

module.exports = { LABEL, titulo, lerPedido, paraReenviar, guardar, reenviar, criarApi };
