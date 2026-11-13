#!/usr/bin/env node
'use strict';
// Sentinela (#2382): a cada 30 min confere se os sites no ar respondem e se o CI da develop está verde.
// Só lê. Se algo cair, abre (ou atualiza) UMA issue "🚨 Sentinela"; quando tudo volta, comenta e fecha.
// Sem dependência externa: usa fetch do Node 20. Uso: GH_TOKEN=... node scripts/sentinel.js [--seco]
const REPO = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const TITULO = '🚨 Sentinela: algo saiu do ar';
const TENTATIVAS = 2; // site só conta como fora depois de 2 tentativas seguidas

/** Função pura: quais sites conferir (só sites próprios; Instagram e afins ficam de fora). */
function sitesParaConferir(lista) {
  const fora = /instagram\.com|facebook\.com|wa\.me|play\.google\.com/i;
  const vistos = new Set();
  return (lista || []).filter((p) => p && /^https?:\/\//.test(p.site || '') && !fora.test(p.site))
    .filter((p) => (vistos.has(p.site) ? false : vistos.add(p.site)))
    .map((p) => ({ id: p.id, nome: p.nome, url: p.site }));
}

/** Função pura: texto da issue a partir dos problemas. */
function montarRelatorio(problemas, agoraIso) {
  return [`Conferido em ${agoraIso} (UTC).`, '', ...problemas.map((p) => `- **${p.nome}**: ${p.motivo}`), '',
    'A Sentinela comenta e fecha esta issue sozinha quando tudo voltar.'].join('\n');
}

/** Função pura: o último CI da develop terminou em falha? */
function ciQuebrado(runs) {
  const ult = (runs || []).find((r) => r.status === 'completed');
  return ult && ult.conclusion === 'failure' ? { nome: 'CI da develop', motivo: `última execução falhou: ${ult.html_url}` } : null;
}

async function conferirSite(s, fetchImpl = fetch) {
  let ultimo = '';
  for (let t = 0; t < TENTATIVAS; t++) {
    try {
      const r = await fetchImpl(s.url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'kernex-sentinela' } });
      if (r.status < 500) return null; // 2xx/3xx/4xx = o servidor respondeu (tela de login pode dar 401/403)
      ultimo = `respondeu ${r.status}`;
    } catch (e) { ultimo = `não respondeu (${e.name === 'TimeoutError' ? 'mais de 15 s' : e.message})`; }
  }
  return { nome: s.nome, motivo: `${s.url} ${ultimo}` };
}

async function gh(caminho, opcoes = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${caminho}`, { ...opcoes, headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' } });
  if (!r.ok) throw new Error(`GitHub ${caminho} → ${r.status}`);
  return r.status === 204 ? null : r.json();
}

async function main() {
  const seco = process.argv.includes('--seco');
  const { NO_AR } = require('../central/produtos.js');
  const sites = sitesParaConferir(NO_AR);
  const problemas = (await Promise.all(sites.map((s) => conferirSite(s)))).filter(Boolean);
  if (TOKEN) {
    try {
      const { workflow_runs: runs } = await gh('/actions/workflows/ci.yml/runs?branch=develop&event=push&per_page=5');
      const c = ciQuebrado(runs); if (c) problemas.push(c);
    } catch (e) { console.log('CI não conferido:', e.message); }
  }
  console.log(`Sentinela: ${sites.length} site(s) conferidos, ${problemas.length} problema(s).`);
  problemas.forEach((p) => console.log(`  ✖ ${p.nome}: ${p.motivo}`));
  if (seco || !TOKEN) return;
  const abertas = await gh('/issues?state=open&labels=sentinela&per_page=5');
  const aberta = abertas.find((i) => i.title === TITULO);
  if (problemas.length) {
    const corpo = montarRelatorio(problemas, new Date().toISOString().slice(0, 16));
    if (aberta) await gh(`/issues/${aberta.number}/comments`, { method: 'POST', body: JSON.stringify({ body: corpo }) });
    else await gh('/issues', { method: 'POST', body: JSON.stringify({ title: TITULO, body: corpo, labels: ['sentinela'] }) });
  } else if (aberta) {
    await gh(`/issues/${aberta.number}/comments`, { method: 'POST', body: JSON.stringify({ body: '✅ Tudo voltou ao ar. Fechando.' }) });
    await gh(`/issues/${aberta.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { sitesParaConferir, montarRelatorio, ciQuebrado, conferirSite };
