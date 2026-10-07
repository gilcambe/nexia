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
// Pista: cada pista usa seu próprio cliente/projeto de teste, para tarefas rodarem ao mesmo tempo.
// Modo econômico: pula as checagens de painel/chat e só refaz o onboarding se o projeto ainda não tem snapshot (poupa a cota grátis do Firestore).
const RAPIDO = process.env.RAPIDO === '1' && !!process.env.TASK;
// Todas as pistas usam o MESMO cliente e projeto de teste (-p1): o repositório só pode estar ligado a um projeto
// por tenant (UNIQUE), então projetos separados por pista não conseguiam fazer o onboarding. A pista só separa as chaves da execução.
const PISTA = /^[1-9]$/.test(process.env.PISTA || '') ? `-p${process.env.PISTA}` : '';
// Nível de autonomia do projeto de TESTE para a tarefa (vazio = não muda). 3 = o Cortex cria branch,
// commit e PR sozinho; nunca faz merge nem deploy (deploy exige 4 e produção sempre pede aprovação).
const AUTONOMY = /^[0-3]$/.test(process.env.AUTONOMY || '') ? Number(process.env.AUTONOMY) : null;
const UID = 'nexia-smoke';
const PROJ = PISTA ? '-p1' : '';
const WAIT_ONBOARD_S = Number(process.env.WAIT_ONBOARD_S || 420);
const WAIT_EXEC_S = Number(process.env.WAIT_EXEC_S || 1500);

const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = v => String(v == null ? '' : v).replace(/\s+/g, ' ').slice(0, 220);
// O log do Actions nem sempre é legível de fora (download bloqueado); o resumo também sai como
// anotação do job (::notice), que a API de check-runs devolve. Só status, nada de segredo.
const linhas = [];
const logOriginal = console.log;
console.log = (...a) => { linhas.push(a.join(' ')); logOriginal(...a); };
const erroOriginal = console.error;
console.error = (...a) => { linhas.push(a.join(' ')); erroOriginal(...a); };
const anotar = () => {
  const esc = t => t.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  logOriginal(`::notice title=Resumo do smoke::${esc(linhas.join('\n').slice(-60000))}`);
};
process.on('exit', anotar);

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
    const cl = await api('/nexia/clients', { method: 'POST', body: { name: 'Teste automático NEXIA', slug: `teste-automatico${PROJ}`, status: 'active' }, headers: { 'Idempotency-Key': `smoke-client-v1${PROJ}` } });
    let client = cl.json && cl.json.record;
    if (!client && cl.status === 409) client = ((await api('/nexia/clients')).json.items || []).find(c => c.slug === `teste-automatico${PROJ}`);
    report(!!client, 'Vault: criar cliente', `${cl.status} ${cl.json && (cl.json.error || '')} ${(cl.json && cl.json.causa) || ''}`);

    const pr = await api('/nexia/projects', { method: 'POST', body: { client_id: client && client.id, name: `Site de teste do Cortex${PROJ}`, slug: `site-teste-cortex${PROJ}`, type: 'website', status: 'active' }, headers: { 'Idempotency-Key': `smoke-project-v1${PROJ}` } });
    let project = pr.json && pr.json.record;
    if (!project && pr.status === 409) project = ((await api('/nexia/projects')).json.items || []).find(p => p.slug === `site-teste-cortex${PROJ}`);
    report(!!project, 'Vault: criar projeto', `${pr.status} ${pr.json && (pr.json.error || '')}`);

    const list = await api('/nexia/projects');
    report(list.status === 200 && (list.json.items || []).some(p => project && p.id === project.id), 'Vault: listar projetos', `${list.status} ${(list.json.items || []).length} projeto(s)`);

    if (project && !RAPIDO) {
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

    if (project && RAPIDO) {
      const [owner, repo] = REPO.split('/');
      const sn = await api(`/nexia/projects/${project.id}/snapshot`);
      if (sn.status !== 200) {
        const ob = await api(`/nexia/projects/${project.id}/onboard`, { method: 'POST', body: { repository: { owner, repo } } });
        report([201, 202].includes(ob.status), 'Onboarding: pedido aceito', `${ob.status}`);
        for (let t = 0; t < WAIT_ONBOARD_S && [201, 202].includes(ob.status); t += 15) {
          if ((await api(`/nexia/projects/${project.id}/snapshot`)).status === 200) break;
          await sleep(15000);
        }
      }
    }

    // Cortex (chat), sem streaming
    if (!RAPIDO) {
    const cx = await api('/cortex', { method: 'POST', body: { message: 'Responda só com a palavra OK.', tenantId: TENANT, stream: false } });
    const reply = cx.json && cx.json.reply;
    report(cx.status === 200 && !!reply, 'Cortex: responder no chat', `${cx.status} ${cx.json ? (cx.json.error || `${(cx.json._meta || {}).modelUsed || ''}: ${reply}`) : cx.text}`);
    }

    // Execução do orquestrador (opcional: a tarefa vem do input)
    if (TASK && project && AUTONOMY !== null && project.autonomy_level !== AUTONOMY) {
      const cur = await api(`/nexia/projects/${project.id}`);
      const up = cur.json && cur.json.record
        ? await api(`/nexia/projects/${project.id}`, { method: 'PATCH', body: { autonomy_level: AUTONOMY }, headers: { 'If-Match': `"v${cur.json.record.version}"` } })
        : cur;
      report(up.status === 200, 'Projeto de teste: autonomia', `${up.status} nível ${AUTONOMY}`);
    }
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
      if (last) {
        if (last.error_code) console.log(`  erro da execução: ${last.error_code}`);
        if (last.result_summary) console.log(`  resumo: ${short(last.result_summary)}`);
        // Etapa que falhou: resumo inteiro (até 3000 caracteres), para achar a causa sem abrir o banco.
        for (const s of last.plan || []) console.log(`  etapa ${s.step} ${s.agent}: ${s.status}${s.error_code ? ` [${s.error_code}]` : ''}${s.model ? ` (${s.model})` : ''} ${s.status === 'failed' ? String(s.summary || '').slice(0, 3000) : short(s.summary || '')}`);
        if (last.work_branch || last.pull_request) console.log(`  resultado: ramo ${last.work_branch || '-'} PR #${last.pull_request || '-'}`);
        if (last.status === 'failed') {
          // Ferramentas que a execução usou (mais recentes primeiro), para achar a causa sem abrir o banco.
          const tc = await api(`/nexia/tool-calls?project_id=${encodeURIComponent(project.id)}&limit=20`);
          for (const c of ((tc.json && tc.json.items) || []).filter(c => !c.execution_id || c.execution_id === last.execution_id).slice(0, 20)) {
            console.log(`  ferramenta ${c.tool}: ${c.status}${c.error_code ? ` [${c.error_code}]` : ''} ${short(c.input_summary || '')} → ${short(c.output_summary || '')}`);
          }
        }
      }
    }

    if (!RAPIDO) {
    const mt = await api('/nexia/metrics');
    report(mt.status === 200, 'Página central: métricas', `${mt.status}`);
    const ap = await api('/nexia/approvals');
    report(ap.status === 200, 'Aprovações pendentes', `${ap.status} ${(ap.json && ap.json.items || []).length}`);
    const ec = await api('/nexia/executions?limit=5');
    report(ec.status === 200, 'Execuções recentes', `${ec.status} ${(ec.json && ec.json.items || []).length}`);
    }
  } finally {
    report(await deleteTestUser(sa).catch(() => false), 'Apagar usuário de teste');
  }

  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} OK`);
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error('ERRO:', e && e.message); process.exit(1); });
