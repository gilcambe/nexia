'use strict';
// Fila fixa do Cortex: as tarefas são Issues do GitHub com o rótulo "cortex-fila" (grátis, sem Firestore).
// REGRA DO DONO: o Cortex nunca espera horário para a fila voltar. O workflow roda a cada 15 min E logo que cada execução termina.
// O workflow "Fila do Cortex" roda este script: conclui o que terminou, reenfileira o que
// falhou (na hora, sem esperar horário), alerta quando uma tarefa trava e despacha as próximas em até 3 pistas.
const REPO = process.env.REPO || 'gilcambe/nexia';
const BASE_URL = process.env.NEXIA_URL || 'https://nexia.gcbezerra.workers.dev';
// Repositório público: minutos do GitHub Actions são grátis e sem limite; 6 pistas dobram a vazão (CORTEX_PISTAS muda).
const PISTAS = Math.max(1, Math.min(10, Number(process.env.CORTEX_PISTAS) || 6));
const MAX_TENTATIVAS = 12;
const TENTATIVAS_ATE_DIVIDIR = 3;
// Rodada "verde" que não entrega o arquivo pedido (ex.: o Cortex não pode criar `.github/workflows/*`) abria um rascunho
// novo a cada ciclo, para sempre (18 rascunhos do gitleaks em 19/10). Depois de MAX_SEM_ENTREGA rodadas assim, trava.
const MAX_SEM_ENTREGA = 2;
// Rótulo sem-entrega-N: N = quantas rodadas terminaram sem entrega. Devolve o próximo passo depois de mais uma.
function depoisSemEntrega(labels) {
  const n = Math.max(0, ...labels.map(l => /^sem-entrega-(\d+)$/.exec(l)).filter(Boolean).map(m => Number(m[1]))) + 1;
  return { n, travar: n >= MAX_SEM_ENTREGA };
}
const CONFIAVEIS = ['OWNER', 'MEMBER', 'COLLABORATOR'];
const L = { fila: 'cortex-fila', rodando: 'cortex-rodando', feito: 'cortex-feito', travado: 'cortex-travado', dividido: 'cortex-dividido', parte: 'cortex-parte', semDivisao: 'cortex-sem-divisao', prioridade: 'cortex-prioridade' };
const MAX_CORPO = 2500;      // tarefa maior que isso é dividida em partes pequenas
const MAX_ARQUIVOS = 4;      // ou que mexe em mais arquivos do que isso

const nomes = i => (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
const numeroDe = (labels, prefixo) => {
  const m = labels.map(n => new RegExp(`^${prefixo}-(\\d+)$`).exec(n)).find(Boolean);
  return m ? Number(m[1]) : 0;
};
// Tarefa grande demais para uma rodada só: texto longo ou muitos arquivos citados. Partes e tarefas já tentadas não se dividem de novo.
function precisaDividir(i) {
  const ls = nomes(i);
  if (ls.includes(L.parte) || ls.includes(L.dividido) || ls.includes(L.semDivisao)) return false;
  const corpo = String(i.body || '');
  // Cópia exata ("Copie EXATAMENTE") é gravada direto, sem IA: dividir apagaria o código do pedido.
  if (require('./cortex-literal-direto').arquivosDiretos(i).length) return false;
  const arquivos = new Set(corpo.match(/[\w./-]+\.(?:js|ts|tsx|jsx|css|html|json|md|yml)\b/g) || []);
  return corpo.length > MAX_CORPO || arquivos.size > MAX_ARQUIVOS;
}
// Pais (rótulo "dividido") cujas partes já foram todas feitas: viram concluídos.
function paisConcluidos({ pais, partes }) {
  const porPai = new Map();
  for (const p of partes) {
    const m = /de #(\d+)\]/.exec(p.title || '');
    if (!m) continue;
    const k = Number(m[1]);
    (porPai.get(k) || porPai.set(k, []).get(k)).push(p);
  }
  return pais.filter(x => { const ps = porPai.get(x.number) || []; return ps.length > 0 && ps.every(p => p.state === 'closed' && nomes(p).includes(L.feito)); }).map(x => x.number);
}
// Caminhos de arquivo entre crases no pedido (ex.: `src/a/b.ts`). Servem para conferir se a entrega mexeu no que foi pedido.
function caminhosDoPedido(corpo) {
  const achados = String(corpo || '').match(/`[\w./-]*\/[\w.-]+\.(?:js|ts|tsx|jsx|css|html|json|md|yml|svg|webmanifest)`/g) || [];
  return [...new Set(achados.map(c => c.slice(1, -1)).filter(c => !c.startsWith('/') && !c.includes('..')))];
}
// Rede de segurança do "feito": o pedido cita arquivos, mas nenhum deles existe na develop nem em PR aberto = a rodada não entregou nada.
const palavras = t => new Set(String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{5,}/g) || []);
// Pedido sem arquivo citado: só vale como entregue se a rodada abriu um PR nexia/* parecido com o título (2+ palavras em comum).
async function entregouPr(token, titulo, runId) {
  try {
    const run = (await gh(token, 'GET', `/actions/runs/${runId}`)).json || {};
    const desde = new Date(run.created_at || 0).getTime();
    const alvo = palavras(titulo);
    const prs = (await gh(token, 'GET', '/pulls?state=all&sort=created&direction=desc&per_page=40')).json || [];
    return prs.some(pr => /^nexia\//.test((pr.head || {}).ref || '') && new Date(pr.created_at).getTime() >= desde
      && [...palavras(pr.title)].filter(w => alvo.has(w)).length >= 2);
  } catch { return true; }
}
// #852: arquivo que já existia na develop só conta se teve commit na develop depois do início da tarefa (`desde`).
async function entregouAlgo(token, corpo, desde) {
  const arquivos = corpo.files || [];
  if (!arquivos.length) return true;
  
  try {
    // Verifica PRs abertos contendo os arquivos
    const prs = (await gh(token, 'GET', '/pulls?state=open&per_page=100')).json || [];
    // Cache para arquivos dos PRs
    const arquivosPrCache = new Map();
    
    for (const arquivo of arquivos) {
      // Se não há data de início, considera como entregue
      if (!desde) return true;
      
      // Verifica se há PR aberto contendo o arquivo (preserva lógica existente)
      const temPrAberto = prs.some(pr => {
        // Usa cache para evitar chamadas repetidas
        if (!arquivosPrCache.has(pr.number)) {
          arquivosPrCache.set(pr.number, (pr.files || []).map(f => f.filename));
        }
        const arquivosPr = arquivosPrCache.get(pr.number);
        return arquivosPr.includes(arquivo);
      });
      
      if (temPrAberto) return true;
      
      // Verifica se há commit na develop depois de 'desde' usando GH API
      // GET /commits?sha=develop&path=<file>&since=<desde>&per_page=1
      const commitsDesp = (await gh(token, 'GET', `/commits?sha=develop&path=${arquivo}&since=${desde}&per_page=1`)).json;
      if (Array.isArray(commitsDesp) && commitsDesp.length > 0) {
        // Tem commit após 'desde': arquivo foi alterado, conta como entregue
        return true;
      }
      
      // Verifica se o arquivo existia antes de 'desde' usando until
      const commitsAntes = (await gh(token, 'GET', `/commits?sha=develop&path=${arquivo}&until=${desde}&per_page=1`)).json;
      if (Array.isArray(commitsAntes) && commitsAntes.length > 0) {
        // Arquivo existia antes de 'desde', não conta como entregue
        continue;
      }
    }
    
    // Nenhum arquivo teve commit após 'desde' nem está em PR aberto
    return false;
  } catch { return true; }
}
const minutos = (agora, iso) => (agora - new Date(iso).getTime()) / 60000;
// As partes de uma tarefa dividida são criadas pela própria fila (conta github-actions[bot], que o GitHub marca
// como CONTRIBUTOR). Elas contam como confiáveis: só quem tem acesso ao repositório consegue pôr rótulos.
const ROBO = 'github-actions[bot]';
const confiavel = i => CONFIAVEIS.includes(i.author_association) || ((i.user || {}).login === ROBO && nomes(i).includes(L.parte));
// "[Parte 2/3 de #359] ..." -> { pai: 359, k: 2 }
const parteDe = i => { const m = /^\[Parte (\d+)\/\d+ de #(\d+)\]/.exec(i.title || ''); return m ? { k: Number(m[1]), pai: Number(m[2]) } : null; };

// Função pura: recebe issues e execuções e devolve a lista de ações. Fácil de testar.
function decidir({ issues, runs, agora = Date.now(), pistas = PISTAS }) {
  const acoes = [];
  const ultimaRun = n => runs.filter(r => r.name === `Cortex #${n}`).sort((a, b) => b.id - a.id)[0] || null;
  const validas = issues.filter(i => !i.pull_request && confiavel(i) && nomes(i).includes(L.fila));
  const pistasEmUso = new Set();
  let ativas = 0;

  for (const i of validas) {
    const ls = nomes(i);
    // #1016: tarefa ainda aberta com cortex-feito (ex.: #800) fecha como concluída, sem pista nem "rodando".
    if (ls.includes(L.feito) && i.state !== 'closed') { acoes.push({ tipo: 'fechar-feito', numero: i.number }); continue; }
    if (ls.includes(L.travado)) continue;
    if (!ls.includes(L.rodando)) continue;
    const run = ultimaRun(i.number);
    const pista = numeroDe(ls, 'pista');
    if (run && run.status === 'completed') {
      if (run.conclusion === 'success') { acoes.push({ tipo: 'concluir', numero: i.number, run: run.id, corpo: String(i.body || ''), titulo: String(i.title || ''), desde: i.created_at || null }); continue; }
      if (run.cota) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: run.id, conclusao: 'cota do banco' }); continue; }
      const t = numeroDe(ls, 'tentativa') + 1;
      // Falhou 3 vezes inteira: o modelo grátis não dá conta do tamanho. Divide em partes pequenas em vez de repetir até travar.
      if (t === TENTATIVAS_ATE_DIVIDIR && !parteDe(i) && !ls.includes(L.parte) && !ls.includes(L.dividido) && !ls.includes(L.semDivisao)) {
        acoes.push({ tipo: 'dividir', numero: i.number, titulo: i.title || '', tarefa: String(i.body || '').trim(), limpar: true, tentativa: t }); continue;
      }
      acoes.push(t >= MAX_TENTATIVAS
        ? { tipo: 'travar', numero: i.number, tentativas: t, run: run.id }
        : { tipo: 'reenfileirar', numero: i.number, tentativa: t, run: run.id, conclusao: run.conclusion });
      continue;
    }
    // #1016: execução que não termina há mais de 2 h (presa na fila do Actions) libera a pista e devolve a tarefa.
    if (run && run.status !== 'completed' && minutos(agora, run.created_at || run.updated_at) > 120) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: run.id, conclusao: 'execução parada há 2 h' }); continue; }
    if (!run && minutos(agora, i.updated_at) > 20) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: null, conclusao: 'sem execução' }); continue; }
    ativas++;
    if (pista) pistasEmUso.add(pista);
  }

  const fila = validas
    .filter(i => { const ls = nomes(i); return !ls.includes(L.rodando) && !ls.includes(L.feito) && !ls.includes(L.travado) && !ls.includes(L.dividido); })
    // Rótulo cortex-prioridade passa na frente (ex.: correções que impedem o próprio Cortex de parar); depois, por número.
    .sort((a, b) => (nomes(b).includes(L.prioridade) - nomes(a).includes(L.prioridade)) || a.number - b.number);
  // Partes da mesma tarefa rodam em ordem: a parte 2 só sai quando a 1 terminou (uma costuma usar o arquivo da outra).
  const esperaAnterior = i => {
    const p = parteDe(i);
    // Parte anterior travada não segura as seguintes para sempre (regra do dono: a fila nunca para).
    return !!p && validas.some(o => o !== i && !nomes(o).includes(L.feito) && !nomes(o).includes(L.travado) && (x => x && x.pai === p.pai && x.k < p.k)(parteDe(o)));
  };
  for (const i of fila) {
    if (esperaAnterior(i)) continue;
    if (precisaDividir(i)) { acoes.push({ tipo: 'dividir', numero: i.number, titulo: i.title || '', tarefa: String(i.body || '').trim() }); continue; }
    if (ativas >= pistas) break;
    let pista = 1; while (pistasEmUso.has(pista)) pista++;
    pistasEmUso.add(pista); ativas++;
    acoes.push({ tipo: 'despachar', numero: i.number, pista, tarefa: String(i.body || '').trim() });
  }
  // Reenfileirados neste ciclo voltam à fila no próximo (o rótulo "rodando" sai agora).
  return acoes;
}

// Regra do dono: todo projeto termina com teste de pessoa. Fila vazia + trabalho concluído depois do último
// teste = dispara o workflow "Teste de pessoa" (uma vez por rodada de entregas).
function precisaTesteFinal({ abertas, feitoEm, testeEm }) {
  if (abertas > 0 || !feitoEm) return false;
  return !testeEm || new Date(testeEm).getTime() < new Date(feitoEm).getTime();
}

// Sonda do banco do Cortex: UMA escrita pequena. Se o limite grátis do dia acabou, a fila não despacha tarefas novas
// (cada tentativa só queimaria mais escritas); volta sozinha no ciclo seguinte em que a sonda passar. Não é espera por horário.
async function sondarUm(txt, fetchImpl, tokenImpl) {
  try {
    const sa = JSON.parse(txt);
    if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    const token = tokenImpl ? await tokenImpl(sa) : await require('../lib/firebase-lite/google-auth').createTokenSource(sa).getToken();
    const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/diag_tmp/sonda-fila`;
    const h = { Authorization: `Bearer ${token}` };
    // A cota de LEITURA costuma acabar antes da de escrita: testa as duas.
    const rl = await fetchImpl(url, { method: 'GET', headers: h });
    if (!rl.ok && rl.status !== 404) {
      const c = await rl.text();
      if (rl.status === 429 || /RESOURCE_EXHAUSTED/.test(c)) return { ok: false, motivo: 'limite grátis de leitura do banco acabou' };
      return { ok: true, motivo: `sonda inconclusiva (${rl.status})` };
    }
    const r = await fetchImpl(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { t: { stringValue: new Date().toISOString() } } }) });
    if (r.ok) return { ok: true };
    const corpo = await r.text();
    if (r.status === 429 || /RESOURCE_EXHAUSTED/.test(corpo)) return { ok: false, motivo: 'limite grátis de escrita do banco acabou' };
    return { ok: true, motivo: `sonda inconclusiva (${r.status})` };
  } catch (e) {
    return { ok: true, motivo: `sonda falhou (${e.message})` };
  }
}

// Vale se QUALQUER banco do rodízio (B, C) ainda tem cota de leitura e escrita.
async function sondarCota(env = process.env, fetchImpl = (...a) => fetch(...a), tokenImpl = null) {
  if (env.NEXIA_D1_TOKEN && env.NEXIA_D1_ACCOUNT_ID) return { ok: true, motivo: 'banco de reserva D1 ativo' }; // o Vault cai nele sozinho quando o Firebase estoura
  const textos = ['B', 'C'].map(l => (env[`FIREBASE_SERVICE_ACCOUNT_${l}`] || '').trim()).filter(Boolean);
  if (!textos.length) {
    const b64 = (env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').replace(/\s/g, '');
    if (!b64) return { ok: true, motivo: 'sem conta configurada' };
    textos.push(Buffer.from(b64, 'base64').toString('utf8'));
  }
  let ultimo = null;
  for (const txt of textos) {
    const r = await sondarUm(txt, fetchImpl, tokenImpl);
    if (r.ok) return r;
    ultimo = r;
  }
  return ultimo;
}

async function gh(token, method, path, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch { /* vazio */ }
  return { status: r.status, json };
}

const SISTEMA_DIVISOR = 'Você divide uma tarefa grande de programação em tarefas pequenas para uma IA executar uma de cada vez. Regras: de 2 a 5 partes; cada parte é completa por si só (a IA não vê as outras), mexe em UM arquivo ou em poucos relacionados e diz o caminho exato do arquivo, o trecho a mudar e o resultado esperado; copie dos detalhes da tarefa original tudo o que a parte precisa (nomes, textos, caminhos); a ordem das partes deve funcionar de cima para baixo. Responda SOMENTE com um array JSON de textos, sem explicação nem markdown.';

// Pede a um modelo grátis (rodízio) para dividir a tarefa. Sem resposta válida devolve null e a tarefa segue inteira.
async function dividirComIA(tarefa, router, lista) {
  for (const d of lista) {
    try {
      const cap = router.capabilities(d);
      if (!cap.available) continue;
      const out = await Promise.race([router.chat(d, { system: SISTEMA_DIVISOR, messages: [{ role: 'user', content: tarefa.slice(0, 12000) }], maxTokens: 3000, cache: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 40000))]);
      const m = out && out.text && /\[[\s\S]*\]/.exec(out.text);
      const arr = m && JSON.parse(m[0]);
      if (Array.isArray(arr) && arr.length >= 2 && arr.length <= 5 && arr.every(t => typeof t === 'string' && t.trim().length >= 30 && t.length <= 3500)) return arr.map(t => t.trim());
    } catch { /* tenta o próximo modelo */ }
  }
  return null;
}

async function executar(token, acao, dividir) {
  const n = acao.numero;
  const addLabel = l => gh(token, 'POST', `/issues/${n}/labels`, { labels: [l] });
  const delLabel = l => gh(token, 'DELETE', `/issues/${n}/labels/${encodeURIComponent(l)}`);
  const comentar = t => gh(token, 'POST', `/issues/${n}/comments`, { body: `${t}\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_` });
  // Rótulos pista-N de rodadas antigas confundiam a contagem de pistas livres: fica só o da rodada atual.
  const limparPistas = async (manter = 0) => { for (let k = 1; k <= 10; k++) if (k !== manter) await delLabel(`pista-${k}`).catch(() => null); };
  if (acao.tipo === 'dividir') {
    if (acao.limpar) {
      // Veio de uma tarefa que falhou: sai da pista (rodando) e anota a tentativa; se a divisão falhar, ela volta inteira para a fila.
      await delLabel(L.rodando);
      await limparPistas();
      if (acao.tentativa) await addLabel(`tentativa-${acao.tentativa}`);
    }
    const partes = dividir ? await dividir(acao.tarefa) : null;
    if (!partes) { await addLabel(L.semDivisao); await comentar('Não consegui dividir esta tarefa agora; ela segue inteira.'); return; }
    const criadas = [];
    for (let k = 0; k < partes.length; k++) {
      const r = await gh(token, 'POST', '/issues', { title: `[Parte ${k + 1}/${partes.length} de #${n}] ${String(acao.titulo).replace(/^NEXIA:\s*/, '').slice(0, 60)}`, body: partes[k], labels: [L.fila, L.parte] });
      if (r.status === 201) criadas.push(r.json.number);
    }
    if (criadas.length !== partes.length) { await comentar(`Só criei ${criadas.length} de ${partes.length} partes; deixei a tarefa inteira.`); await addLabel(L.semDivisao); return; }
    await addLabel(L.dividido);
    await comentar(`Tarefa grande dividida em ${partes.length} partes pequenas: ${criadas.map(c => `#${c}`).join(', ')}. Quando todas terminarem, esta é concluída.`);
  } else if (acao.tipo === 'concluir-pai') {
    await delLabel(L.dividido); await addLabel(L.feito);
    await comentar('Todas as partes foram concluídas.');
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'despachar') {
    await limparPistas(acao.pista);
    await addLabel(L.rodando); await addLabel(`pista-${acao.pista}`);
    const d = await gh(token, 'POST', '/actions/workflows/smoke-logado.yml/dispatches', {
      ref: 'develop', inputs: { url: BASE_URL, task: acao.tarefa, autonomia: '3', pista: String(acao.pista), modo: 'economico', tarefa_id: String(n) },
    });
    if (d.status !== 204) { await delLabel(L.rodando); await comentar(`Não consegui disparar o Cortex (${d.status}). Tento de novo no próximo ciclo.`); }
  } else if (acao.tipo === 'concluir') {
    if (!(await entregouAlgo(token, acao.corpo, acao.desde))) {
      const ls = nomes((await gh(token, 'GET', `/issues/${n}`)).json || {});
      const { n: k, travar } = depoisSemEntrega(ls);
      await delLabel(L.rodando); await limparPistas();
      for (let j = 1; j < k; j++) await delLabel(`sem-entrega-${j}`);
      await addLabel(travar ? L.travado : `sem-entrega-${k}`);
      const alvo = caminhosDoPedido(acao.corpo).slice(0, 3).join(', ') || 'nenhum PR parecido com o pedido';
      await comentar(travar
        ? `${k} rodadas terminaram sem entregar o código (${alvo}). Travei para não abrir mais rascunhos repetidos; precisa de olhar humano.`
        : `A rodada terminou sem erro, mas não achei o código entregue (${alvo}). Não marquei como feita; volta para a fila (${k}/${MAX_SEM_ENTREGA}).`);
      return;
    }
    await delLabel(L.rodando); await limparPistas(); await addLabel(L.feito);
    await comentar(`Concluída pelo Cortex: https://github.com/${REPO}/actions/runs/${acao.run}`);
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'reenfileirar') {
    await delLabel(L.rodando); await limparPistas();
    for (const l of [`tentativa-${acao.tentativa - 1}`]) if (acao.tentativa > 1) await delLabel(l);
    await addLabel(`tentativa-${acao.tentativa}`);
  } else if (acao.tipo === 'fechar-feito') {
    await delLabel(L.rodando); await limparPistas();
    await comentar('Esta tarefa já tinha o rótulo cortex-feito; fechei como concluída.');
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'travar') {
    await delLabel(L.rodando); await limparPistas(); await addLabel(L.travado);
    await comentar(`Tarefa travada depois de ${acao.tentativas} tentativas (última: https://github.com/${REPO}/actions/runs/${acao.run}). Precisa de olhar humano.`);
  }
}

// Token da GitHub App do NEXIA (pode abrir PR; o NEXIA_JOBS_TOKEN cria ramo e arquivo mas o GitHub recusa o PR).
async function tokenDaApp() {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  const { createAuth } = require('../nexia-ai/github-adapter/auth');
  const [owner, repo] = REPO.split('/');
  const auth = createAuth({ env: process.env, fetchImpl: fetch, apiBase: 'https://api.github.com' });
  const h = await auth.headersFor({ owner, repo }, { write: true, permissions: { contents: 'write', pull_requests: 'write' } });
  return String(h.Authorization || '').replace(/^Bearer /, '') || null;
}

async function literalDireto(token, issues) {
  let escrita = process.env.NEXIA_JOBS_TOKEN || token; // chave do dono (autorizada): o CI roda nos PRs que ela abre
  try { escrita = (await tokenDaApp()) || escrita; } catch (e) { console.log(`App do NEXIA indisponível (${e.message}); uso a chave da fila.`); }
  try {
    const { processarDiretos } = require('./cortex-literal-direto');
    const lerArquivo = async p => {
      const r = await gh(escrita, 'GET', `/contents/${p}?ref=develop`);
      return r.status === 200 && r.json.content ? { sha: r.json.sha, content: Buffer.from(r.json.content, 'base64').toString('utf8') } : null;
    };
    const base = (await gh(escrita, 'GET', '/git/ref/heads/develop')).json;
    const rodape = '\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_';
    return await processarDiretos({
      issues, abertosPRs: (await gh(token, 'GET', '/pulls?state=open&per_page=100')).json || [], lerArquivo,
      gravar: async (ramo, arqs, msg) => {
        const c = await gh(escrita, 'POST', '/git/refs', { ref: `refs/heads/${ramo}`, sha: base.object.sha });
        if (c.status !== 201) throw new Error(`ramo ${c.status}`);
        for (const a of arqs) {
          const w = await gh(escrita, 'PUT', `/contents/${a.path}`, { message: msg, content: Buffer.from(a.content).toString('base64'), branch: ramo, sha: a.sha });
          if (w.status >= 300) throw new Error(`gravar ${a.path} ${w.status}`);
        }
      },
      abrirPR: async (ramo, i, arqs) => {
        const r = await gh(escrita, 'POST', '/pulls', { title: `Cópia literal do pedido #${i.number}`, head: ramo, base: 'develop', body: `Pedido #${i.number}, gravado direto (sem IA): ${arqs.map(a => '`' + a.path + '`').join(', ')}.\n\nNão fecha o pedido: a fila fecha quando o arquivo estiver na develop.` });
        if (r.status !== 201) throw new Error(`PR ${r.status} ${String((r.json || {}).message || '').slice(0, 120)}`);
        return r.json.number;
      },
      concluir: async n => {
        await gh(token, 'DELETE', `/issues/${n}/labels/${L.travado}`); await gh(token, 'DELETE', `/issues/${n}/labels/${L.rodando}`);
        await gh(token, 'POST', `/issues/${n}/labels`, { labels: [L.feito] });
        await gh(token, 'POST', `/issues/${n}/comments`, { body: `Os arquivos pedidos já estão na develop, idênticos ao pedido. Concluída.${rodape}` });
        await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
      },
      comentar: (n, t) => gh(token, 'POST', `/issues/${n}/comments`, { body: t + rodape }),
    });
  } catch (e) { console.log(`cópia direta falhou (${e.message}); a fila normal segue.`); return new Set(); }
}

// Rascunhos parados (#1017): PR aberto, em rascunho, do app do Cortex, título "NEXIA:", sem commit novo há 72 h
// e sem rótulo automerge → fecha com um comentário (nada é apagado: o ramo fica e o PR pode ser reaberto).
// No máximo 10 por ciclo. Nunca mexe em PR que não é rascunho nem em PR de outra pessoa.
const PARADO_MS = 72 * 3600e3;
const MAX_FECHAR_RASCUNHOS = 10;
const MSG_RASCUNHO_PARADO = 'Fechado por estar parado há 3 dias. A tarefa continua na fila do Cortex e pode abrir um PR novo.';
const doCortex = pr => { const u = pr.user || {}; return u.type === 'Bot' && /^nexia[\w-]*\[bot\]$/.test(u.login || ''); };
// Pré-filtro sem pedir nada ao GitHub (a data do último commit vem depois, só para estes).
function candidatosRascunho(prs, agora = Date.now()) {
  return (prs || []).filter(pr => pr.state === 'open' && pr.draft === true && /^NEXIA:/.test(pr.title || '') && doCortex(pr)
    && !nomes(pr).includes('automerge') && agora - Date.parse(pr.created_at || 0) >= PARADO_MS);
}
// commitEm: { [numero do PR]: data ISO do último commit }. Sem data conhecida, não fecha.
function rascunhosParados({ prs, commitEm = {}, agora = Date.now(), max = MAX_FECHAR_RASCUNHOS }) {
  return candidatosRascunho(prs, agora).filter(pr => {
    const t = Date.parse(commitEm[pr.number] || '');
    return Number.isFinite(t) && agora - t >= PARADO_MS;
  }).slice(0, max).map(pr => pr.number);
}

async function fecharRascunhosParados(token) {
  let escrita = token;
  try { escrita = (await tokenDaApp()) || token; } catch { /* sem app: usa a chave do workflow */ }
  const prs = [];
  for (let pag = 1; pag <= 3; pag++) {
    const lote = (await gh(token, 'GET', `/pulls?state=open&per_page=100&page=${pag}`)).json || [];
    prs.push(...lote);
    if (lote.length < 100) break;
  }
  const commitEm = {};
  for (const pr of candidatosRascunho(prs).slice(0, 30)) {
    const c = (await gh(token, 'GET', `/commits/${pr.head && pr.head.sha}`)).json;
    commitEm[pr.number] = c && c.commit && ((c.commit.committer && c.commit.committer.date) || (c.commit.author && c.commit.author.date));
  }
  const fechar = rascunhosParados({ prs, commitEm });
  for (const n of fechar) {
    await gh(escrita, 'POST', `/issues/${n}/comments`, { body: MSG_RASCUNHO_PARADO });
    const r = await gh(escrita, 'PATCH', `/pulls/${n}`, { state: 'closed' });
    console.log(`rascunho parado #${n}: fechado (${r.status}).`);
  }
  return fechar;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN.');
  for (const l of Object.values(L)) await gh(token, 'POST', '/labels', { name: l, color: '1d76db' });
  // Todas as abertas (antes só as 50 mais novas: as antigas sumiam da fila e as tarefas "rodando" nelas nunca fechavam).
  const issues = [];
  for (let pag = 1; pag <= 10; pag++) {
    const lote = (await gh(token, 'GET', `/issues?state=open&labels=${L.fila}&per_page=100&page=${pag}`)).json || [];
    issues.push(...lote);
    if (lote.length < 100) break;
  }
  const runs = ((await gh(token, 'GET', '/actions/workflows/smoke-logado.yml/runs?per_page=60')).json || {}).workflow_runs || [];
  // Marca as falhas causadas pela cota do banco (o resumo do smoke traz o código do Firestore).
  for (const r of runs.filter(x => x.status === 'completed' && x.conclusion !== 'success' && /^Cortex #/.test(x.name || '')).slice(0, 6)) {
    try {
      const jobs = ((await gh(token, 'GET', `/actions/runs/${r.id}/jobs`)).json || {}).jobs || [];
      for (const j of jobs) {
        const an = (await gh(token, 'GET', `/check-runs/${j.id}/annotations?per_page=50`)).json || [];
        if (an.some(a => /RESOURCE_EXHAUSTED/.test(`${a.message || ''}`))) r.cota = true;
      }
    } catch { /* sem anotação: segue como falha comum */ }
  }
  // Cópia literal ("Copie EXATAMENTE") não passa por IA: grava direto e a fila normal não despacha essas tarefas.
  const direto = await literalDireto(token, issues);
  let acoes = decidir({ issues: issues.filter(i => !direto.has(i.number)), runs });
  // Sem escrita disponível no banco, despachar só queima mais cota: segura as tarefas novas (o resto segue).
  if (acoes.some(a => a.tipo === 'despachar')) {
    const sonda = await sondarCota();
    if (!sonda.ok) { console.log(`cota esgotada (${sonda.motivo}): ${acoes.filter(a => a.tipo === 'despachar').length} tarefa(s) esperam na fila sem despachar.`); acoes = acoes.filter(a => a.tipo !== 'despachar'); }
    else if (sonda.motivo) console.log(`sonda: ${sonda.motivo}`);
  }
  // Pais divididos: quando todas as partes terminam, o pai é concluído.
  const pais = issues.filter(i => !i.pull_request && nomes(i).includes(L.dividido));
  if (pais.length) {
    const partes = ((await gh(token, 'GET', `/issues?state=all&labels=${L.parte}&per_page=100`)).json || []).filter(i => !i.pull_request);
    for (const n of paisConcluidos({ pais, partes })) acoes.push({ tipo: 'concluir-pai', numero: n });
  }
  // O divisor usa só modelos grátis (rodízio); o roteador só é carregado se houver algo para dividir.
  let dividir = null;
  if (acoes.some(a => a.tipo === 'dividir')) {
    const { getRouter } = require('../nexia-ai/model-router');
    const { listFor } = require('../nexia-ai/orchestrator/models');
    const router = getRouter();
    dividir = t => dividirComIA(t, router, listFor('fast'));
  }
  for (const a of acoes) { console.log(`${a.tipo} #${a.numero}${a.pista ? ` pista ${a.pista}` : ''}${a.tentativa ? ` tentativa ${a.tentativa}` : ''}`); await executar(token, a, dividir); }
  console.log(`${issues.length} na fila, ${acoes.length} ação(ões).`);
  try { await fecharRascunhosParados(token); } catch (e) { console.log(`rascunhos parados: ${e.message}`); }
  const ignoradas = issues.filter(i => !i.pull_request && !confiavel(i));
  if (ignoradas.length) console.log(`ignoradas (autor sem acesso): ${ignoradas.map(i => `#${i.number}`).join(', ')}`);
  if (!issues.length) {
    const feitas = ((await gh(token, 'GET', `/issues?state=closed&labels=${L.feito}&sort=updated&direction=desc&per_page=5`)).json || []).filter(i => !i.pull_request);
    const testes = ((await gh(token, 'GET', '/actions/workflows/teste-humano.yml/runs?per_page=1')).json || {}).workflow_runs || [];
    if (precisaTesteFinal({ abertas: 0, feitoEm: feitas[0] && feitas[0].closed_at, testeEm: testes[0] && testes[0].created_at })) {
      const r = await gh(token, 'POST', '/actions/workflows/teste-humano.yml/dispatches', { ref: 'develop' });
      console.log(`fila vazia: teste de pessoa disparado (${r.status}).`);
    }
  }
}

module.exports = { entregouAlgo, depoisSemEntrega, MAX_SEM_ENTREGA, rascunhosParados, candidatosRascunho, MSG_RASCUNHO_PARADO, tokenDaApp, TENTATIVAS_ATE_DIVIDIR, caminhosDoPedido, sondarCota, decidir, precisaTesteFinal, precisaDividir, paisConcluidos, dividirComIA, MAX_TENTATIVAS };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
