#!/usr/bin/env node
'use strict';
// NEXIA — teste do site no ar COM login (só pela API; nunca Playwright contra produção).
// Cria um usuário de teste temporário (uid nexia-smoke, papel master por custom claim), entra
// com ele, testa Vault, projetos, onboarding, Cortex e execuções, e apaga o usuário no fim.
// Imprime só status e mensagens de erro, nunca tokens nem chaves. Uso (no GitHub Actions):
//   BASE=https://... FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/smoke-logado.js
const { createTokenSource, signRS256, b64url } = require('../lib/firebase-lite/google-auth');

const BASE = String(process.env.BASE || '').replace(/\/+$/, '');
const TENANT = process.env.TENANT || 'nexia';
const REPO = process.env.REPO || 'gilcambe/nexia';
const TASK = process.env.TASK || '';
const UID = 'nexia-smoke';
const WAIT_ONBOARD_S = Number(process.env.WAIT_ONBOARD_S || 420);
const WAIT_EXEC_S = Number(process.env.WAIT_EXEC_S || 900);

const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = v => String(v == null ? '' : v).replace(/\s+/g, ' ').slice(0, 220);
function report(ok, name, detail) {
  results.push({ ok, name });
  console.log(`${ok ? 'OK     ' : 'FALHOU '} ${name}${detail ? ` — ${short(detail)}` : ''}`);
}

async function idTokenFor(sa, apiKey) {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, sub: sa.client_email, iat, exp: iat + 3600, uid: UID,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    claims: { role: 'master', tenantSlug: TENANT },
  }));
  const custom = `${header}.${claims}.${b64url(await signRS256(sa.private_key, `${header}.${claims}`))}`;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.idToken) throw new Error(`login de teste falhou: ${r.status} ${j.error && j.error.message}`);
  return j.idToken;
}

async function deleteTestUser(sa) {
  const token = await createTokenSource(sa).getToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ localId: UID }),
  });
  return r.ok;
}

async function main() {
  if (!/^https:\/\//.test(BASE)) throw new Error('BASE precisa começar com https://');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_BASE64.');
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));

  const cfg = await fetch(`${BASE}/api/firebase-config`).then(r => r.json());
  report(!!cfg.apiKey, 'Configuração do Firebase no site', cfg.projectId);
  const idToken = await idTokenFor(sa, cfg.apiKey);
  report(true, 'Login com usuário de teste temporário');

  const api = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const r = await fetch(`${BASE}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, 'X-Tenant-Id': TENANT, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* SSE ou texto */ }
    return { status: r.status, json, text, etag: r.headers.get('etag') };
  };

  try {
    const me = await api('/nexia/me');
    report(me.status === 200 && me.json.role === 'master' && me.json.canUseVault, 'Quem sou eu (/me)', `${me.status} ${me.json && me.json.role}`);

    // Vault: cliente e projeto de teste (idempotentes: rodar de novo reaproveita)
    const cl = await api('/nexia/clients', { method: 'POST', body: { name: 'Teste automático NEXIA', slug: 'teste-automatico', status: 'active' }, headers: { 'Idempotency-Key': 'smoke-client-v1' } });
    let client = cl.json && cl.json.record;
    if (!client && cl.status === 409) client = ((await api('/nexia/clients')).json.items || []).find(c => c.slug === 'teste-automatico');
    report(!!client, 'Vault: criar cliente', `${cl.status} ${cl.json && (cl.json.error || '')}`);

    const pr = await api('/nexia/projects', { method: 'POST', body: { client_id: client && client.id, name: 'Site de teste do Cortex', slug: 'site-teste-cortex', type: 'website', status: 'active' }, headers: { 'Idempotency-Key': 'smoke-project-v1' } });
    let project = pr.json && pr.json.record;
    if (!project && pr.status === 409) project = ((await api('/nexia/projects')).json.items || []).find(p => p.slug === 'site-teste-cortex');
    report(!!project, 'Vault: criar projeto', `${pr.status} ${pr.json && (pr.json.error || '')}`);

    const list = await api('/nexia/projects');
    report(list.status === 200 && (list.json.items || []).some(p => project && p.id === project.id), 'Vault: listar projetos', `${list.status} ${(list.json.items || []).length} projeto(s)`);

    if (project) {
      const hist = await api(`/nexia/projects/${project.id}/history`);
      report(hist.status === 200, 'Vault: histórico do projeto', `${hist.status} ${(hist.json.items || []).length} versão(ões)`);

      // Onboarding: lê o repositório no GitHub (fila do GitHub Actions) e grava o snapshot
      const [owner, repo] = REPO.split('/');
      const ob = await api(`/nexia/projects/${project.id}/onboard`, { method: 'POST', body: { repository: { owner, repo } } });
      report([201, 202].includes(ob.status), 'Onboarding: pedido aceito', `${ob.status} ${ob.json && (ob.json.error || JSON.stringify(ob.json.job || ''))}`);
      let snap = null;
      for (let t = 0; t < WAIT_ONBOARD_S && [201, 202].includes(ob.status); t += 15) {
        const s = await api(`/nexia/projects/${project.id}/snapshot`);
        if (s.status === 200) { snap = s.json.record; break; }
        await sleep(15000);
      }
      report(!!snap, 'Onboarding: snapshot do repositório no Vault', snap ? `stack: ${(snap.stack || []).join(', ')}` : 'sem snapshot no tempo limite');

      const ctx = await api(`/nexia/projects/${project.id}/context?message=${encodeURIComponent('como publicar')}`);
      report(ctx.status === 200, 'Contexto do projeto para a IA', `${ctx.status}`);
    }

    // Cortex (chat), sem streaming
    const cx = await api('/cortex', { method: 'POST', body: { message: 'Responda só com a palavra OK.', tenantId: TENANT, stream: false } });
    const reply = cx.json && cx.json.reply;
    report(cx.status === 200 && !!reply, 'Cortex: responder no chat', `${cx.status} ${cx.json ? (cx.json.error || `${(cx.json._meta || {}).modelUsed || ''}: ${reply}`) : cx.text}`);

    // Execução do orquestrador (opcional: a tarefa vem do input)
    if (TASK && project) {
      const ex = await api('/nexia/executions', { method: 'POST', body: { message: TASK, project_id: project.id }, headers: { 'Idempotency-Key': `smoke-exec-${Date.now()}` } });
      const exec = ex.json && ex.json.execution;
      report([200, 202].includes(ex.status) && !!exec, 'Execução: pedido aceito', `${ex.status} ${ex.json && (ex.json.error || (exec && exec.status) || ex.json.decision || '')}`);
      let last = exec;
      for (let t = 0; exec && t < WAIT_EXEC_S; t += 20) {
        const g = await api(`/nexia/executions/${exec.id}`);
        last = g.json && g.json.record;
        if (last && ['succeeded', 'failed', 'cancelled', 'waiting_approval', 'needs_input'].includes(last.status)) break;
        await sleep(20000);
      }
      report(!!last && ['succeeded', 'waiting_approval'].includes(last.status), 'Execução: terminou', last ? `${last.status} intent=${last.intent} modelos=${(last.models || []).join(',')}` : 'sem registro');
      if (last) console.log('  etapas:', short(JSON.stringify((last.plan || []).map(s => [s.agent, s.status, s.error_code || '', s.summary || '']))));
    }

    const mt = await api('/nexia/metrics');
    report(mt.status === 200, 'Página central: métricas', `${mt.status}`);
    const ap = await api('/nexia/approvals');
    report(ap.status === 200, 'Aprovações pendentes', `${ap.status} ${(ap.json && ap.json.items || []).length}`);
    const ec = await api('/nexia/executions?limit=5');
    report(ec.status === 200, 'Execuções recentes', `${ec.status} ${(ec.json && ec.json.items || []).length}`);
  } finally {
    report(await deleteTestUser(sa).catch(() => false), 'Apagar usuário de teste');
  }

  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} OK`);
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error('ERRO:', e && e.message); process.exit(1); });
