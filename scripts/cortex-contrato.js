#!/usr/bin/env node
'use strict';
// Roda UM contrato (issue com "Arquivos:" e "Teste:") com o executor de contrato e abre o PR se o teste passar.
// Uso no Actions: NUMERO=123 GH_TOKEN=... node scripts/cortex-contrato.js   (workflow cortex-contrato.yml)
// Sem Firebase, sem Vault, sem produção: só o repositório, as IAs grátis e o teste.
const { execFileSync } = require('node:child_process');
const { lerContrato, executar } = require('../nexia-ai/contrato/executor');

const REPO = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';
const N = Number(process.env.NUMERO);
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const CONFIAVEIS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

async function gh(method, rota, body, token = TOKEN) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${rota}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* vazio */ }
  return { status: r.status, json: j };
}
async function tokenDaApp() {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  const { createAuth } = require('../nexia-ai/github-adapter/auth');
  const [owner, repo] = REPO.split('/');
  const auth = createAuth({ env: process.env, fetchImpl: fetch, apiBase: 'https://api.github.com' });
  const h = await auth.headersFor({ owner, repo }, { write: true, permissions: { contents: 'write', pull_requests: 'write' } });
  return String(h.Authorization || '').replace(/^Bearer /, '') || null;
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const comentar = corpo => gh('POST', `/issues/${N}/comments`, { body: `${corpo}\n\n---\n_Executor de contrato do Cortex (teste decide)_` });
const rotular = l => gh('POST', `/issues/${N}/labels`, { labels: [l] });

function rodarTeste(cmd) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  for (const k of Object.keys(env)) if (/KEY|TOKEN|SECRET|VAGA_/.test(k)) delete env[k];   // o teste não vê chave nenhuma
  try { execFileSync(process.execPath, cmd.split(' ').slice(1), { stdio: 'pipe', timeout: 180000, env }); return Promise.resolve({ ok: true, saida: '' }); }
  catch (e) { return Promise.resolve({ ok: false, saida: (String(e.stdout || '') + String(e.stderr || '')).slice(-6000) }); }
}

function modelos() {
  const { listFor } = require('../nexia-ai/orchestrator/models');
  const { getRouter } = require('../nexia-ai/model-router');
  const router = getRouter();
  const vistos = new Set();
  // Só IAs grátis (regra do dono: Claude no mínimo). CONTRATO_CLAUDE=1 põe o Claude como ÚLTIMO degrau.
  const lista = [...listFor('coding'), ...listFor('reasoning')].filter(d => d.provider !== 'anthropic')
    .filter(d => { const k = `${d.provider}/${d.model}`; if (vistos.has(k)) return false; vistos.add(k); try { return router.capabilities(d).available !== false; } catch { return false; } })
    .slice(0, Number(process.env.CONTRATO_DEGRAUS) || 4);
  if (process.env.CONTRATO_CLAUDE === '1') lista.push({ provider: 'anthropic', model: 'claude-sonnet-5-5' });
  return { router, lista };
}

(async () => {
  if (!N || !TOKEN) { console.error('NUMERO e GH_TOKEN são obrigatórios'); process.exit(2); }
  const issue = (await gh('GET', `/issues/${N}`)).json;
  if (!issue || issue.pull_request) { console.error('issue não encontrada'); process.exit(2); }
  if (!CONFIAVEIS.has(issue.author_association)) { console.log(`#${N}: autor sem permissão (${issue.author_association}); ignorado`); return; }
  const c = lerContrato(`${issue.title}\n\n${issue.body || ''}`);
  if (!c.ok) { await comentar(`Contrato inválido: ${c.erros.join('; ')}.\nModelo:\n\`\`\`\nO que fazer...\nArquivos: \`caminho/arquivo.js\`\nTeste: \`node --test tests/unit/x.test.js\`\n\`\`\``); await rotular('contrato-invalido'); return; }
  const { router, lista } = modelos();
  console.log(`#${N}: ${c.arquivos.join(', ')} | ${c.teste} | degraus: ${lista.map(d => `${d.provider}/${d.model}`).join(' > ')}`);
  const t0 = Date.now();
  const r = await executar({ contrato: c, raiz: process.cwd(), router, modelos: lista, rodarTeste, porModelo: 2, log: s => console.log('  ' + s) });
  const seg = Math.round((Date.now() - t0) / 1000);
  const hist = r.historico.map((h, i) => `${i + 1}. ${h.modelo}: ${h.erro ? 'sem resposta' : h.aplicados.length ? `aplicou ${h.aplicados.join(', ')}; teste ${h.teste ? 'passou' : 'falhou'}` : 'nada aplicado'}${h.recusas && h.recusas.length ? ` (recusas: ${h.recusas.slice(0, 2).join('; ')})` : ''}`).join('\n');
  if (!r.ok) {
    await comentar(`❌ Não entreguei: ${r.motivo}. ${r.tentativas} tentativa(s) em ${seg} s.\n${hist}`);
    await rotular('contrato-falhou');
    process.exitCode = 1;
    return;
  }
  const ramo = `cortex/contrato-${N}-${Date.now().toString(36)}`;
  git('config', 'user.name', 'Cortex KERNEX'); git('config', 'user.email', 'cortex@kernex.com.br');
  git('checkout', '-b', ramo);
  git('add', '--', ...r.arquivos);
  git('commit', '-m', `Contrato #${N}: ${String(issue.title).slice(0, 60)}\n\nTeste de aceitação: ${c.teste}\nIA: ${r.modelo} (${r.tentativas} tentativa(s))`);
  git('push', 'origin', ramo);
  const dadosPr = { title: `Contrato #${N}: ${String(issue.title).slice(0, 70)}`, head: ramo, base: 'develop',
    body: `Fecha #${N}\n\nEntregue pelo executor de contrato: o teste de aceitação \`${c.teste}\` falhava antes e passa agora.\nIA: ${r.modelo}; ${r.tentativas} tentativa(s); ${seg} s.\nArquivos: ${r.arquivos.map(f => `\`${f}\``).join(', ')}\n\n${hist}` };
  // 11/11: a 1ª prova abriu o ramo mas o PR voltou vazio. Mostra o erro exato e tenta a chave do próprio Actions.
  // A GitHub App do NEXIA abre o PR (e o CI roda nele). A NEXIA_JOBS_TOKEN não pode abrir PR (403) e a chave do
  // Actions abre, mas o GitHub NÃO roda o CI em PR aberto por ela (visto em 3491-3496): é só o último recurso.
  let pr = { status: 0, json: null };
  try { const app = await tokenDaApp(); if (app) pr = await gh('POST', '/pulls', dadosPr, app); } catch (e) { console.log(`App do NEXIA indisponível (${e.message})`); }
  if (pr.status !== 201) pr = await gh('POST', '/pulls', dadosPr);
  const semCi = pr.status !== 201;
  if (pr.status !== 201 && process.env.GITHUB_TOKEN_ACAO) {
    console.log(`PR com a chave principal falhou (${pr.status}: ${(pr.json && pr.json.message) || '-'}); tentando a chave do Actions`);
    pr = await gh('POST', '/pulls', dadosPr, process.env.GITHUB_TOKEN_ACAO);
  }
  if (pr.status !== 201) {
    const msg = `${pr.status}: ${(pr.json && (pr.json.message + ' ' + JSON.stringify(pr.json.errors || ''))) || '-'}`.slice(0, 300);
    await comentar(`✅ Teste de aceitação passou com ${r.modelo} em ${seg} s, mas não consegui abrir o PR (${msg}). O código está no ramo \`${ramo}\`.`);
    await rotular('contrato-sem-pr');
    console.error(`PR falhou: ${msg}`);
    process.exitCode = 1;
    return;
  }
  await comentar(`✅ Teste de aceitação passou com ${r.modelo} em ${seg} s. PR: #${pr.json.number}${semCi ? ' (aberto pela chave do Actions: o CI NÃO roda sozinho neste PR; precisa de nova execução)' : ''}`);
  if (semCi) await rotular('contrato-sem-ci');
  await rotular('contrato-pr');
  console.log(`PR #${pr.json.number}`);
})().catch(e => { console.error(e); process.exit(1); });
