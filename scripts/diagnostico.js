#!/usr/bin/env node
'use strict';
// NEXIA — diagnóstico das peças que o site no ar usa (rodado no GitHub Actions, manual).
// Imprime só status e mensagens curtas de erro, nunca valores de segredos.
//   1. Firestore: uma listagem do Vault (mostra se falta índice composto).
//   2. Fila de tarefas: dispara um "sweep" (inofensivo) com NEXIA_JOBS_TOKEN.
//   3. Gemini: um pedido mínimo com GEMINI_API_KEY.
const out = (ok, name, detail) => console.log(`${ok ? 'OK     ' : 'FALHOU '} ${name}${detail ? ` — ${String(detail).replace(/\s+/g, ' ').slice(0, 400)}` : ''}`);
const redact = s => String(s || '').replace(/AIza[0-9A-Za-z_-]{20,}/g, '[chave]').replace(/gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,}/g, '[token]');

async function main() {
  const env = process.env;
  try {
    process.env.NODE_ENV = 'production';
    const { db } = require('../netlify/functions/firebase-init');
    if (!db) throw new Error('Firestore indisponível (chave de serviço).');
    const { createVault, createExecutionContext } = require('../nexia-ai/vault');
    const v = createVault({ db });
    const ctx = createExecutionContext({ tenantId: env.TENANT || 'nexia', actor: { type: 'system', id: 'diagnostico' } });
    const items = await v.Project.list(ctx, { limit: 5 });
    out(true, 'Firestore: listar projetos do Vault', `${items.length} projeto(s)`);
  } catch (e) { out(false, 'Firestore: listar projetos do Vault', redact(e && (e.message || e.code))); }

  if (!env.NEXIA_JOBS_TOKEN) out(false, 'Fila de tarefas', 'NEXIA_JOBS_TOKEN vazio');
  else {
    const r = await fetch('https://api.github.com/repos/gilcambe/nexia/actions/workflows/nexia-jobs.yml/dispatches', {
      method: 'POST', headers: { Authorization: `Bearer ${env.NEXIA_JOBS_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'nexia-diagnostico', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'develop', inputs: { job: JSON.stringify({ kind: 'sweep' }) } }),
    });
    const body = r.status === 204 ? '' : await r.text();
    out(r.status === 204, 'Fila de tarefas: disparar "sweep" com NEXIA_JOBS_TOKEN', `${r.status} ${redact((() => { try { return JSON.parse(body).message; } catch { return body.slice(0, 200); } })())}`);
    const who = await fetch('https://api.github.com/repos/gilcambe/nexia', { headers: { Authorization: `Bearer ${env.NEXIA_JOBS_TOKEN}`, 'User-Agent': 'nexia-diagnostico' } });
    out(who.ok, 'Fila de tarefas: token enxerga gilcambe/nexia', `${who.status}`);
  }

  if (!env.GEMINI_API_KEY) out(false, 'Gemini', 'GEMINI_API_KEY vazio');
  else {
    for (const model of ['gemini-2.5-flash']) {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Responda só OK.' }], max_tokens: 20 }),
      });
      const j = await r.json().catch(() => ({}));
      const msg = r.ok ? (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) : (j.error && (j.error.message || j.error.status)) || (Array.isArray(j) && j[0] && j[0].error && j[0].error.message);
      out(r.ok, `Gemini ${model}`, `${r.status} ${redact(msg)}`);
    }
  }
}
main().catch(e => { console.error('ERRO:', redact(e && e.message)); process.exit(1); });
