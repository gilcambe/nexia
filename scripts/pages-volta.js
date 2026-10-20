#!/usr/bin/env node
// Volta automática no Cloudflare Pages (#806), igual ao `wrangler rollback` do Worker. Grátis (API do Cloudflare).
//   node scripts/pages-volta.js antes <projeto>                 → grava `anterior=<id>` em $GITHUB_OUTPUT
//   node scripts/pages-volta.js conferir <projeto> <url> <id>   → testa o site; se falhar 3 vezes, volta para <id>
// Precisa de CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID (os mesmos que o deploy já usa).
'use strict';
const fs = require('node:fs');

const API = 'https://api.cloudflare.com/client/v4';

/** Último deployment de produção que terminou bem (o que está no ar antes do deploy novo). */
function escolherAnterior(lista) {
  const ok = (lista || []).filter((d) => d && d.id && (d.environment || 'production') === 'production'
    && (!d.latest_stage || (d.latest_stage.name === 'deploy' && d.latest_stage.status === 'success')));
  ok.sort((a, b) => String(b.created_on || '').localeCompare(String(a.created_on || '')));
  return ok[0] ? ok[0].id : '';
}

async function cf(caminho, { token, fetchImpl, method = 'GET' }) {
  const r = await fetchImpl(API + caminho, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`Cloudflare ${r.status}: ${JSON.stringify(j.errors || '').slice(0, 200)}`);
  return j.result;
}

async function anterior(projeto, { token, conta, fetchImpl }) {
  const lista = await cf(`/accounts/${conta}/pages/projects/${encodeURIComponent(projeto)}/deployments?env=production&per_page=10`, { token, fetchImpl });
  return escolherAnterior(lista);
}

/** Site no ar = resposta abaixo de 500 (o Body Coach pode redirecionar ou pedir login). */
async function siteNoAr(url, { fetchImpl, tentativas = 3, esperaMs = 10000, dormir = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetchImpl(url, { redirect: 'manual', headers: { 'User-Agent': 'nexia-pages-volta' } });
      if (r.status > 0 && r.status < 500) return true;
    } catch { /* tenta de novo */ }
    if (i < tentativas - 1) await dormir(esperaMs);
  }
  return false;
}

async function conferir(projeto, url, idAnterior, o) {
  if (await siteNoAr(url, o)) return { ok: true };
  if (!idAnterior) return { ok: false, voltou: false, motivo: 'sem deploy anterior para voltar' };
  await cf(`/accounts/${o.conta}/pages/projects/${encodeURIComponent(projeto)}/deployments/${encodeURIComponent(idAnterior)}/rollback`, { ...o, method: 'POST' });
  return { ok: false, voltou: true };
}

async function main(argv, env) {
  const [acao, projeto, url, id] = argv;
  const o = { token: env.CLOUDFLARE_API_TOKEN, conta: env.CLOUDFLARE_ACCOUNT_ID, fetchImpl: (...a) => fetch(...a) };
  if (!o.token || !o.conta || !projeto) { console.log('pages-volta: sem token/conta/projeto; nada a fazer.'); return 0; }
  if (acao === 'antes') {
    const a = await anterior(projeto, o).catch((e) => { console.log('pages-volta: não li o deploy anterior:', e.message); return ''; });
    console.log(`pages-volta: deploy no ar antes = ${a || '(nenhum)'}`);
    if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `anterior=${a}\n`);
    return 0;
  }
  if (acao === 'conferir') {
    const r = await conferir(projeto, url, id, o);
    if (r.ok) { console.log(`pages-volta: ${url} no ar.`); return 0; }
    console.log(`::error::${url} não respondeu depois do deploy. ${r.voltou ? 'Voltei para o deploy anterior ' + id + '.' : r.motivo}`);
    return 1;
  }
  console.log('uso: pages-volta.js antes <projeto> | conferir <projeto> <url> <idAnterior>');
  return 2;
}

if (require.main === module) main(process.argv.slice(2), process.env).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });

module.exports = { escolherAnterior, anterior, siteNoAr, conferir, main };
