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

// ── Último degrau: plano Claude Pro do dono (11/11/2026, autorizado: "sim, ligue") ──
// Oficial: `claude setup-token` → segredo CLAUDE_CODE_OAUTH_TOKEN. A cota é a MESMA que o dono usa no dia a dia,
// por isso: só depois de todas as grátis, no máximo CONTRATO_CLAUDE_DIA tarefas por dia (padrão 5), modelo Sonnet,
// só ferramentas de ler/editar arquivo (sem terminal) e, no fim, tudo fora dos arquivos do contrato é desfeito.
const { regraClaude } = require('../nexia-ai/contrato/claude-pro');
async function usadosHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  const r = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${REPO} label:contrato-claude updated:>=${hoje}`)}&per_page=1`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } });
  try { return (await r.json()).total_count || 0; } catch { return 0; }
}
async function degrauClaudePro(c, issue) {
  if (String(process.env.CONTRATO_DEGRAUS || '').trim() === 'pc') { console.log('  claude-pro: pulado (prova só do PC2)'); return null; }
  const regra = regraClaude(process.env, await usadosHoje());
  if (!regra.usar) { console.log(`  claude-pro: ${regra.motivo}`); return null; }
  // 1ª prova real (11/11): "Not logged in". Chave colada com espaço/quebra de linha ou texto a mais é comum:
  // limpa e mostra só o formato (nunca a chave).
  const bruta = String(process.env.CLAUDE_CODE_OAUTH_TOKEN || '');
  // A chave não tem espaço; no terminal ela quebra em várias linhas e a cópia traz as quebras: junta tudo
  // e pega do "sk-ant-oat" até o fim da chave (2ª prova: só a 1ª linha, 68 caracteres → 401).
  const junta = bruta.replace(/\s+/g, '');
  const chave = (junta.match(/sk-ant-oat[A-Za-z0-9_-]+/) || [junta])[0];
  process.env.CLAUDE_CODE_OAUTH_TOKEN = chave;
  console.log(`  claude-pro: chave com ${chave.length} caracteres; formato ${/^sk-ant-oat\d{2}-/.test(chave) ? 'ok (sk-ant-oat..)' : 'INESPERADO (gere de novo com: claude setup-token)'}${bruta !== chave ? '; havia espaço ou texto a mais (limpei)' : ''}`);
  const fs = require('node:fs');
  const testes = Object.fromEntries(c.testes.map(t => [t, fs.existsSync(t) ? fs.readFileSync(t, 'utf8') : null]));
  const prompt = [
    `Tarefa do Cortex KERNEX (issue #${N}): ${String(issue.title).slice(0, 200)}`,
    c.pedido.slice(0, 4000),
    `Mexa SOMENTE nestes arquivos: ${c.arquivos.join(', ')}. NÃO altere o teste ${c.testes.join(', ')}.`,
    `O teste de aceitação é: ${c.teste}. Leia o teste, implemente o que falta e termine. Responda só "pronto".`,
  ].join('\n\n');
  const t0 = Date.now();
  try {
    execFileSync('claude', ['-p', prompt, '--model', 'sonnet', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep', '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch'],
      { stdio: 'pipe', timeout: 15 * 60e3, env: { ...process.env } });
  } catch (e) {
    // Mostra a causa (saída do Claude Code), nunca o comando inteiro nem chaves.
    const saida = `${String(e.stderr || '')} ${String(e.stdout || '')}`.replace(/(sk-ant-|oauth|token)[^\s]*/gi, '***').trim().slice(-800);
    console.log(`  claude-pro: não terminou (código ${e.status ?? '-'}${e.signal ? ', ' + e.signal : ''}): ${saida || 'sem saída'}`);
  }
  // Desfaz qualquer arquivo fora do contrato e devolve o teste original.
  const mudados = git('status', '--porcelain', '-uall').split('\n').filter(Boolean).map(l => l.slice(3).trim());
  for (const f of mudados) {
    if (c.arquivos.includes(f) || c.testes.includes(f)) continue;
    try { git('checkout', '--', f); } catch { try { fs.rmSync(f, { recursive: true, force: true }); } catch { /* já saiu */ } }
  }
  for (const [t, v] of Object.entries(testes)) if (v !== null) fs.writeFileSync(t, v);
  await rotular('contrato-claude');
  const tr = await rodarTeste(c.teste);
  const seg = Math.round((Date.now() - t0) / 1000);
  console.log(`  claude-pro: teste ${tr.ok ? 'PASSOU' : 'falhou'} (${seg} s)`);
  const arquivos = c.arquivos.filter(f => mudados.includes(f) || git('status', '--porcelain', '--', f));
  return { ok: tr.ok, modelo: 'claude-code/sonnet (plano Pro)', arquivos, hist: { modelo: 'claude-code/sonnet (plano Pro)', aplicados: arquivos, recusas: [], teste: tr.ok } };
}

function rodarTeste(cmd) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  for (const k of Object.keys(env)) if (/KEY|TOKEN|SECRET|VAGA_/.test(k)) delete env[k];   // o teste não vê chave nenhuma
  try { execFileSync(process.execPath, cmd.split(' ').slice(1), { stdio: 'pipe', timeout: 180000, env }); return Promise.resolve({ ok: true, saida: '' }); }
  catch (e) { return Promise.resolve({ ok: false, saida: (String(e.stdout || '') + String(e.stderr || '')).slice(-6000) }); }
}

// Redundância (11/11, lote em linguagem natural): os 4 degraus eram todos do Groq e, com 5 tarefas juntas, o limite
// do Groq derrubou 2. A escada alterna fornecedores: 1º de cada fornecedor, depois o 2º de cada, e assim por diante.
function intercalar(lista) {
  const por = new Map();
  for (const d of lista) { if (!por.has(d.provider)) por.set(d.provider, []); por.get(d.provider).push(d); }
  const filas = [...por.values()], out = [];
  for (let i = 0; filas.some(f => f.length > i); i++) for (const f of filas) if (f[i]) out.push(f[i]);
  return out;
}

function modelos() {
  const { listFor } = require('../nexia-ai/orchestrator/models');
  const { getRouter } = require('../nexia-ai/model-router');
  const router = getRouter();
  const vistos = new Set();
  // Só IAs grátis (regra do dono: Claude no mínimo). CONTRATO_CLAUDE=1 põe o Claude como ÚLTIMO degrau.
  const todos = [...listFor('coding'), ...listFor('reasoning')].filter(d => d.provider !== 'anthropic')
    .filter(d => { const k = `${d.provider}/${d.model}`; if (vistos.has(k)) return false; vistos.add(k); try { return router.capabilities(d).available !== false; } catch { return false; } });
  // CONTRATO_DEGRAUS=0 pula as grátis (teste do último degrau, plano Claude Pro); vazio = 6.
  const n = String(process.env.CONTRATO_DEGRAUS || '').trim();
  // CONTRATO_DEGRAUS=pc: só o PC2 (prova do degrau local).
  const lista = n === 'pc' ? [] : intercalar(todos.filter(d => d.provider !== 'maquinas')).slice(0, n === '' ? 6 : Math.max(0, Math.min(12, Number(n) || 0)));
  // Último degrau GRÁTIS (11/11/2026): o PC2 do dono (Ollama, sem limite de cota), pela fila "maquinas" — o PC busca
  // a tarefa, nada fica aberto. Lento (CPU), por isso só depois das IAs da internet e antes do plano Claude Pro.
  // CONTRATO_PC=0 desliga; CONTRATO_PC_MODELO troca o modelo (padrão qwen3:8b). No teste "só Claude" (degraus=0) não entra.
  const pc = { provider: 'maquinas', model: process.env.CONTRATO_PC_MODELO || 'qwen3:8b' };
  if (n !== '0' && process.env.CONTRATO_PC !== '0') { try { if (router.capabilities(pc).available !== false) lista.push(pc); } catch { /* sem PC configurado */ } }
  if (process.env.CONTRATO_CLAUDE === '1') lista.push({ provider: 'anthropic', model: 'claude-sonnet-5-5' });
  return { router, lista };
}

// Mantém o processo vivo até o fim (11/11/2026): a espera pelo PC2 (fila "maquinas") usa timers "unref", que não
// seguram o Node; sem isto o script saía em 2 s com código 0 logo depois de mandar a tarefa ao PC (que fazia o
// trabalho em ~200 s sem ninguém esperando o resultado).
const manterVivo = setInterval(() => {}, 60 * 60 * 1000);
(async () => {
  if (!N || !TOKEN) { console.error('NUMERO e GH_TOKEN são obrigatórios'); process.exit(2); }
  const issue = (await gh('GET', `/issues/${N}`)).json;
  if (!issue || issue.pull_request) { console.error('issue não encontrada'); process.exit(2); }
  // Partes criadas pelo próprio planejador do Cortex (github-actions[bot] deste repo) vêm como CONTRIBUTOR;
  // sem isto toda parte de pedido grande era ignorada e o pedido nunca andava (12/11/2026, #3532).
  const doBot = issue.user && issue.user.login === 'github-actions[bot]';
  if (!CONFIAVEIS.has(issue.author_association) && !doBot) { console.log(`#${N}: autor sem permissão (${issue.author_association}); ignorado`); return; }
  const texto = `${issue.title}\n\n${issue.body || ''}`;
  let c = lerContrato(texto);
  const { router, lista } = modelos();
  // Pedido SEM contrato (nenhuma linha "Arquivos:"): a IA gera o teste e os portões conferem (gerador.js).
  // Se não der para virar contrato, a tarefa VOLTA para a fila no caminho antigo: o fluxo nunca para.
  let gerado = null;
  const voltarParaFila = async (motivo, rotulo) => {
    await comentar(`↩️ ${motivo}\nA tarefa volta para a fila no caminho antigo.`);
    await rotular(rotulo); await rotular('cortex-fila');
    await gh('DELETE', `/issues/${N}/labels/cortex-contrato`);
  };
  // Nenhuma IA respondeu (429/402/410): não é falha. Fica esperando a cota; o vigia do fluxo redispara em 30 min.
  const aguardarCota = async det => {
    await comentar(`⏳ Todas as IAs grátis estão sem cota ou fora do ar agora${det ? ` (${det})` : ''}. Não conto como falha: tento de novo sozinho em 30 min.`);
    await rotular('contrato-aguardando-cota');
    for (const l of ['contrato-falhou', 'contrato-nao-testavel']) await gh('DELETE', `/issues/${N}/labels/${l}`);
  };
  if (!c.ok && !/^\s*(?:[-*]\s*)?\**Arquivos\**\s*:/im.test(texto) && process.env.CONTRATO_GERAR !== '0') {
    const { gerar, revisarCobertura } = require('../nexia-ai/contrato/gerador');
    const checarSintaxe = f => { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); return true; } catch { return false; } };
    // Portão 8: outra IA grátis (não a que escreveu o teste) confere se o teste cobre o pedido. Sem cota, segue sem ele.
    const gratis = lista.filter(d => d.provider !== 'maquinas');
    const revisar = ({ pedido, codigo, modelo }) => revisarCobertura(router, gratis.filter(d => !(d.provider === modelo.provider && d.model === modelo.model)).slice(0, 3), pedido, codigo);
    gerado = await gerar({ pedido: texto, raiz: process.cwd(), router, modelos: lista, rodarTeste, checarSintaxe, revisar, log: s => console.log('  gerador: ' + s) });
    if (!gerado.ok && gerado.sem_cota) return aguardarCota('ao gerar o teste');
    if (!gerado.ok) return voltarParaFila(gerado.nao_testavel ? `Não dá para provar com teste automático (${gerado.motivo}).` : `Não consegui gerar um teste válido: ${gerado.motivo}.`, 'contrato-nao-testavel');
    c = gerado.contrato;
    await comentar(`📝 Contrato gerado por ${gerado.modelo}: arquivos ${c.arquivos.map(a => `\`${a}\``).join(', ')}; teste \`${c.teste}\` (falha hoje, passou nos portões).`);
  }
  if (!c.ok) { await comentar(`Contrato inválido: ${c.erros.join('; ')}.\nModelo:\n\`\`\`\nO que fazer...\nArquivos: \`caminho/arquivo.js\`\nTeste: \`node --test tests/unit/x.test.js\`\n\`\`\``); await rotular('contrato-invalido'); return; }
  console.log(`#${N}: ${c.arquivos.join(', ')} | ${c.teste} | degraus: ${lista.map(d => `${d.provider}/${d.model}`).join(' > ')}`);
  const t0 = Date.now();
  let r = await executar({ contrato: c, raiz: process.cwd(), router, modelos: lista, rodarTeste, porModelo: 2, log: s => console.log('  ' + s) });
  if (!r.ok) {
    // Último degrau: o plano Claude Pro do dono (CLAUDE_CODE_OAUTH_TOKEN), com teto diário. Só quando as grátis não resolveram.
    const rc = await degrauClaudePro(c, issue);
    if (rc) { r.historico.push(rc.hist); if (rc.ok) r = { ...r, ok: true, modelo: rc.modelo, arquivos: rc.arquivos, sem_cota: false }; }
  }
  const seg = Math.round((Date.now() - t0) / 1000);
  const hist = r.historico.map((h, i) => `${i + 1}. ${h.modelo}: ${h.erro ? 'sem resposta' : h.aplicados.length ? `aplicou ${h.aplicados.join(', ')}; teste ${h.teste ? 'passou' : 'falhou'}` : 'nada aplicado'}${h.recusas && h.recusas.length ? ` (recusas: ${h.recusas.slice(0, 2).join('; ')})` : ''}`).join('\n');
  if (!r.ok && r.sem_cota) return aguardarCota(r.historico.map(h => h.erro).filter(Boolean).slice(0, 3).join('; ').slice(0, 200));
  if (!r.ok && gerado) {
    try { require('node:fs').unlinkSync(gerado.testeArquivo); } catch { /* já saiu */ }
    return voltarParaFila(`Nenhuma IA fez o teste gerado passar (${r.tentativas} tentativa(s) em ${seg} s).\n${hist}`, 'contrato-falhou');
  }
  if (!r.ok) {
    await comentar(`❌ Não entreguei: ${r.motivo}. ${r.tentativas} tentativa(s) em ${seg} s.\n${hist}`);
    await rotular('contrato-falhou');
    process.exitCode = 1;
    return;
  }
  const { ramoDoContrato, corpoDoPr } = require('../nexia-ai/contrato/pr');
  const ramo = ramoDoContrato(N);
  git('config', 'user.name', 'Cortex KERNEX'); git('config', 'user.email', 'cortex@kernex.com.br');
  git('checkout', '-b', ramo);
  git('add', '--', ...r.arquivos, ...(gerado ? [gerado.testeArquivo] : []));   // teste gerado fica no CI para sempre
  git('commit', '-m', `Contrato #${N}: ${String(issue.title).slice(0, 60)}\n\nTeste de aceitação: ${c.teste}\nIA: ${r.modelo} (${r.tentativas} tentativa(s))`);
  git('push', 'origin', ramo);
  const dadosPr = { title: `Contrato #${N}: ${String(issue.title).slice(0, 70)}`, head: ramo, base: 'develop',
    body: corpoDoPr({ numero: N, teste: c.teste, modelo: r.modelo, tentativas: r.tentativas, seg, arquivos: r.arquivos, hist }) };
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
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => clearInterval(manterVivo));
