'use strict';
// Fila fixa do Cortex: as tarefas são Issues do GitHub com o rótulo "cortex-fila" (grátis, sem Firestore).
// REGRA DO DONO: o Cortex nunca espera horário para a fila voltar. O workflow roda a cada 15 min E logo que cada execução termina.
// O workflow "Fila do Cortex" roda este script: conclui o que terminou, reenfileira o que
// falhou (na hora, sem esperar horário), alerta quando uma tarefa trava e despacha as próximas em até 3 pistas.
const REPO = process.env.REPO || 'gilcambe/nexia';
const BASE_URL = process.env.NEXIA_URL || 'https://nexia.gcbezerra.workers.dev';
const PISTAS = 3;
const MAX_TENTATIVAS = 12;
const CONFIAVEIS = ['OWNER', 'MEMBER', 'COLLABORATOR'];
const L = { fila: 'cortex-fila', rodando: 'cortex-rodando', feito: 'cortex-feito', travado: 'cortex-travado', dividido: 'cortex-dividido', parte: 'cortex-parte', semDivisao: 'cortex-sem-divisao' };
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
const minutos = (agora, iso) => (agora - new Date(iso).getTime()) / 60000;

// Função pura: recebe issues e execuções e devolve a lista de ações. Fácil de testar.
function decidir({ issues, runs, agora = Date.now(), pistas = PISTAS }) {
  const acoes = [];
  const ultimaRun = n => runs.filter(r => r.name === `Cortex #${n}`).sort((a, b) => b.id - a.id)[0] || null;
  const validas = issues.filter(i => !i.pull_request && CONFIAVEIS.includes(i.author_association) && nomes(i).includes(L.fila));
  const pistasEmUso = new Set();
  let ativas = 0;

  for (const i of validas) {
    const ls = nomes(i);
    if (ls.includes(L.feito) || ls.includes(L.travado)) continue;
    if (!ls.includes(L.rodando)) continue;
    const run = ultimaRun(i.number);
    const pista = numeroDe(ls, 'pista');
    if (run && run.status === 'completed') {
      if (run.conclusion === 'success') { acoes.push({ tipo: 'concluir', numero: i.number, run: run.id }); continue; }
      if (run.cota) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: run.id, conclusao: 'cota do banco' }); continue; }
      const t = numeroDe(ls, 'tentativa') + 1;
      acoes.push(t >= MAX_TENTATIVAS
        ? { tipo: 'travar', numero: i.number, tentativas: t, run: run.id }
        : { tipo: 'reenfileirar', numero: i.number, tentativa: t, run: run.id, conclusao: run.conclusion });
      continue;
    }
    if (!run && minutos(agora, i.updated_at) > 20) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: null, conclusao: 'sem execução' }); continue; }
    ativas++;
    if (pista) pistasEmUso.add(pista);
  }

  const fila = validas
    .filter(i => { const ls = nomes(i); return !ls.includes(L.rodando) && !ls.includes(L.feito) && !ls.includes(L.travado) && !ls.includes(L.dividido); })
    .sort((a, b) => a.number - b.number);
  for (const i of fila) {
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
      const out = await Promise.race([router.chat(d, { system: SISTEMA_DIVISOR, messages: [{ role: 'user', content: tarefa.slice(0, 12000) }], maxTokens: 3000 }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 40000))]);
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
  if (acao.tipo === 'dividir') {
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
    await addLabel(L.rodando); await addLabel(`pista-${acao.pista}`);
    const d = await gh(token, 'POST', '/actions/workflows/smoke-logado.yml/dispatches', {
      ref: 'develop', inputs: { url: BASE_URL, task: acao.tarefa, autonomia: '3', pista: String(acao.pista), modo: 'economico', tarefa_id: String(n) },
    });
    if (d.status !== 204) { await delLabel(L.rodando); await comentar(`Não consegui disparar o Cortex (${d.status}). Tento de novo no próximo ciclo.`); }
  } else if (acao.tipo === 'concluir') {
    await delLabel(L.rodando); await addLabel(L.feito);
    await comentar(`Concluída pelo Cortex: https://github.com/${REPO}/actions/runs/${acao.run}`);
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'reenfileirar') {
    await delLabel(L.rodando);
    for (const l of [`tentativa-${acao.tentativa - 1}`]) if (acao.tentativa > 1) await delLabel(l);
    await addLabel(`tentativa-${acao.tentativa}`);
  } else if (acao.tipo === 'travar') {
    await delLabel(L.rodando); await addLabel(L.travado);
    await comentar(`Tarefa travada depois de ${acao.tentativas} tentativas (última: https://github.com/${REPO}/actions/runs/${acao.run}). Precisa de olhar humano.`);
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN.');
  for (const l of Object.values(L)) await gh(token, 'POST', '/labels', { name: l, color: '1d76db' });
  const issues = (await gh(token, 'GET', `/issues?state=open&labels=${L.fila}&per_page=50`)).json || [];
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
  let acoes = decidir({ issues, runs });
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
  if (!issues.length) {
    const feitas = ((await gh(token, 'GET', `/issues?state=closed&labels=${L.feito}&sort=updated&direction=desc&per_page=5`)).json || []).filter(i => !i.pull_request);
    const testes = ((await gh(token, 'GET', '/actions/workflows/teste-humano.yml/runs?per_page=1')).json || {}).workflow_runs || [];
    if (precisaTesteFinal({ abertas: 0, feitoEm: feitas[0] && feitas[0].closed_at, testeEm: testes[0] && testes[0].created_at })) {
      const r = await gh(token, 'POST', '/actions/workflows/teste-humano.yml/dispatches', { ref: 'develop' });
      console.log(`fila vazia: teste de pessoa disparado (${r.status}).`);
    }
  }
}

module.exports = { sondarCota, decidir, precisaTesteFinal, precisaDividir, paisConcluidos, dividirComIA, MAX_TENTATIVAS };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
