'use strict';
// Context Engine (spec §5 "Memória em camadas", §19): monta um contexto compacto,
// relevante e verificável para a tarefa, a partir do Vault, dentro de um orçamento
// de tokens. Nunca envia o Vault inteiro: cada camada tem limite, e cada item leva
// o id do registro de origem.
const { overlap } = require('../text');

const DEFAULT_BUDGET = 1200;          // tokens estimados
const CHARS_PER_TOKEN = 4;            // estimativa conservadora para PT/EN
const estimate = s => Math.ceil(String(s).length / CHARS_PER_TOKEN);

const OPEN_TASK = ['todo', 'in_progress', 'blocked'];
const OPEN_ERROR = ['open', 'investigating'];

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Ordena por relevância com a mensagem e, em empate, pelo mais recente. */
function rank(items, message, textOf, dateOf) {
  return items
    .map(x => ({ x, rel: message ? overlap(message, textOf(x)) : 0, at: dateOf(x) || '' }))
    .sort((a, b) => b.rel - a.rel || b.at.localeCompare(a.at))
    .map(r => r.x);
}

/**
 * @param {{ vault, ctx, projectId: string, message?: string, budgetTokens?: number, now?: Date }} o
 * @returns {{ project_id, client_id, text, sections, items, tokens_estimated, budget_tokens, dropped }}
 */
async function buildContext({ vault, ctx, projectId, message = '', budgetTokens = DEFAULT_BUDGET, now = new Date() }) {
  const project = await vault.Project.get(ctx, projectId);
  const client = await vault.Client.get(ctx, project.client_id).catch(() => null);
  const where = { project_id: projectId };
  const [snaps, decisions, tasks, errors, deployments, memoriesP, conversations, artifacts, envs, repos] = await Promise.all([
    vault.ProjectSnapshot.list(ctx, { where, limit: 20 }),
    vault.Decision.list(ctx, { where, limit: 100 }),
    vault.Task.list(ctx, { where, limit: 200 }),
    vault.Error.list(ctx, { where, limit: 100 }),
    vault.Deployment.list(ctx, { where, limit: 50 }),
    vault.Memory.list(ctx, { where, limit: 200 }),
    vault.Conversation.list(ctx, { where, limit: 50 }),
    vault.Artifact.list(ctx, { where, limit: 200 }),
    vault.Environment.list(ctx, { where, limit: 20 }),
    vault.Repository.list(ctx, { where, limit: 20 }),
  ]);
  const memoriesC = client ? await vault.Memory.list(ctx, { where: { client_id: client.id }, limit: 200 }) : [];
  const nowIso = now.toISOString();
  const usableMemory = m => m.status === 'approved' && (!m.expires_at || m.expires_at > nowIso);
  const memories = [...new Map([...memoriesP, ...memoriesC].filter(usableMemory).map(m => [m.id, m])).values()];
  const snapshot = snaps.sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0] || null;

  // Itens por camada, em ordem de prioridade. Cada item: { layer, ref, text }.
  const L = [];
  const push = (layer, ref, text) => L.push({ layer, ref, text });

  // Identidade
  push('identity', project.id, `Projeto: ${project.name} (${project.type}, ${project.status}, autonomia ${project.autonomy_level})${project.description ? ` — ${clip(project.description, 200)}` : ''}`);
  if (client) push('identity', client.id, `Cliente: ${client.name} (${client.status})`);

  // Fatos (snapshot, repositório, ambientes)
  if (snapshot) {
    const f = [];
    if (snapshot.stack.length) f.push(`stack ${snapshot.stack.join(', ')}`);
    if (snapshot.frameworks.length) f.push(`frameworks ${snapshot.frameworks.join(', ')}`);
    if (snapshot.commands) f.push(`comandos ${Object.entries(snapshot.commands).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    if (snapshot.deploy_target) f.push(`deploy ${snapshot.deploy_target}`);
    if (snapshot.firebase_project) f.push(`firebase ${snapshot.firebase_project}`);
    if (snapshot.cloudflare_ref) f.push(`cloudflare ${snapshot.cloudflare_ref}`);
    push('fact', snapshot.id, `Snapshot ${snapshot.generated_at.slice(0, 10)}: ${f.join('; ')}`);
    if (snapshot.architecture) push('fact', snapshot.id, `Arquitetura: ${clip(snapshot.architecture, 400)}`);
  }
  for (const r of repos.slice(0, 3)) push('fact', r.id, `Repositório: ${r.owner}/${r.repo} (branch padrão ${r.default_branch})`);
  for (const e of envs.slice(0, 4)) {
    push('fact', e.id, `Ambiente ${e.name}: ${e.provider}${e.urls.length ? ` ${e.urls.slice(0, 2).join(' ')}` : ''}${e.secret_refs.length ? `; variáveis: ${e.secret_refs.map(s => s.name).slice(0, 12).join(', ')}` : ''}`);
  }
  for (const m of rank(memories.filter(m => m.layer === 'fact' || m.layer === 'identity'), message, m => m.content, m => m.updated_at).slice(0, 5)) {
    push('fact', m.id, `Fato aprovado: ${clip(m.content, 300)}`);
  }

  // Decisões
  const accepted = decisions.filter(d => d.status === 'accepted');
  for (const d of rank(accepted, message, d => `${d.title} ${d.decision}`, d => d.decided_at).slice(0, 5)) {
    push('decision', d.id, `Decisão (${d.decided_at.slice(0, 10)}): ${clip(d.title, 120)} — ${clip(d.decision, 240)}`);
  }

  // Estado
  const open = tasks.filter(t => OPEN_TASK.includes(t.status));
  for (const t of rank(open, message, t => `${t.title} ${t.description || ''}`, t => t.updated_at).slice(0, 5)) {
    push('state', t.id, `Tarefa ${t.status} [${t.priority}]: ${clip(t.title, 160)}`);
  }
  const lastDeployment = deployments.slice().sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (lastDeployment) push('state', lastDeployment.id, `Último deploy: ${lastDeployment.release} (${lastDeployment.commit_sha.slice(0, 7)}) ${lastDeployment.status} em ${lastDeployment.started_at.slice(0, 16)}`);
  for (const e of rank(errors.filter(x => OPEN_ERROR.includes(x.status)), message, x => x.message, x => x.last_seen_at).slice(0, 3)) {
    push('state', e.id, `Erro ${e.severity} ${e.status}: ${clip(e.message, 200)}`);
  }

  // Preferências
  for (const m of rank(memories.filter(m => m.layer === 'preference'), message, m => m.content, m => m.updated_at).slice(0, 5)) {
    push('preference', m.id, `Preferência: ${clip(m.content, 240)}`);
  }

  // Histórico (conversas resumidas e memórias de histórico/decisão)
  for (const c of rank(conversations, message, c => `${c.title} ${c.summary}`, c => c.started_at).slice(0, 3)) {
    push('history', c.id, `Conversa ${c.started_at.slice(0, 10)}: ${clip(c.title, 100)} — ${clip(c.summary, 240)}`);
  }
  for (const m of rank(memories.filter(m => ['history', 'state', 'decision'].includes(m.layer)), message, m => m.content, m => m.updated_at).slice(0, 3)) {
    push('history', m.id, `Memória (${m.layer}): ${clip(m.content, 240)}`);
  }

  // Conhecimento derivado: documentos relevantes à mensagem (título e caminho, sem conteúdo)
  const relevantDocs = message ? artifacts.filter(a => overlap(message, `${a.title} ${a.uri}`) > 0) : [];
  for (const a of relevantDocs.slice(0, 5)) push('derived', a.id, `Documento: ${a.title} (${a.uri})`);
  for (const m of rank(memories.filter(m => m.layer === 'derived'), message, m => m.content, m => m.updated_at).slice(0, 3)) {
    push('derived', m.id, `Derivado: ${clip(m.content, 240)}`);
  }

  // Orçamento: identidade sempre entra; o resto em ordem de prioridade até o limite.
  const kept = [];
  const dropped = [];
  let used = estimate('CONTEXTO DO PROJETO (Vault)\n');
  for (const item of L) {
    const cost = estimate(item.text) + 1;
    if (item.layer === 'identity' || used + cost <= budgetTokens) { kept.push(item); used += cost; }
    else dropped.push({ layer: item.layer, ref: item.ref });
  }
  const LABEL = { identity: 'Identidade', fact: 'Fatos', decision: 'Decisões', state: 'Estado', preference: 'Preferências', history: 'Histórico', derived: 'Documentação' };
  const sections = {};
  for (const it of kept) (sections[it.layer] = sections[it.layer] || []).push(it);
  const text = Object.entries(sections)
    .map(([layer, items]) => `### ${LABEL[layer]}\n${items.map(i => `- ${i.text} [${i.ref}]`).join('\n')}`)
    .join('\n');

  return {
    project_id: project.id,
    client_id: project.client_id,
    text,
    sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.map(i => ({ ref: i.ref, text: i.text }))])),
    items: kept.length,
    tokens_estimated: estimate(text),
    budget_tokens: budgetTokens,
    dropped,
  };
}

module.exports = { buildContext, estimate, DEFAULT_BUDGET };
