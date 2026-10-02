'use strict';
// Project Resolver (spec §5 "Identificação de cliente/projeto"): resolve o projeto
// de uma solicitação em 8 camadas e devolve um ProjectContext
// { project_id, client_id, confidence, rationale, candidates, needs_confirmation, question }.
// Só lê o Vault. A justificativa cita a camada e o campo que casou, nunca dados sensíveis.
const { containsPhrase, overlap, normalize } = require('../text');

const DEFAULTS = Object.freeze({
  threshold: 0.7,        // abaixo disso, pergunta (camada 8)
  margin: 0.15,          // diferença mínima entre o 1º e o 2º candidato
  minCandidate: 0.3,     // candidatos abaixo disso não aparecem na pergunta
  maxCandidates: 5,
});

// Peso de cada camada. Combinação por "ou ruidoso": 1 - Π(1 - s).
const W = Object.freeze({
  selected: 1.0,          // 1. selecionado na UI
  projectName: 0.9,       // 2. nome/slug do projeto mencionado
  projectAlias: 0.8,      // 3. alias do projeto
  clientOnly: 0.85,       // 3. cliente mencionado e ele tem um único projeto ativo
  clientShared: 0.5,      // 3. cliente mencionado com vários projetos ativos
  repository: 0.95,       // 4. repositório owner/repo atual
  workspace: 0.9,         // 4. pasta de trabalho dentro do workspace do projeto
  conversation: 0.6,      // 5. projeto da conversa
  history: 0.4,           // 6. histórico recente (decai por posição)
  semantic: 0.45,         // 7. busca no Vault (lexical; ver ADR)
});

const ACTIVE_PROJECT = ['planning', 'active', 'maintenance'];

function combine(scores) { return 1 - scores.reduce((acc, s) => acc * (1 - s), 1); }
const round = n => Math.round(n * 1000) / 1000;

/** Carrega clientes, projetos e repositórios ativos do tenant (um retrato para resolver). */
async function loadIndex(vault, ctx) {
  const [clients, projects, repos] = await Promise.all([
    vault.Client.list(ctx, { limit: 200 }),
    vault.Project.list(ctx, { limit: 200 }),
    vault.Repository.list(ctx, { limit: 200 }),
  ]);
  return { clients, projects: projects.filter(p => ACTIVE_PROJECT.includes(p.status)), repos };
}

function normPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * @param {object} o
 * @param {object} o.vault, o.ctx
 * @param {string} [o.message]                    texto do usuário
 * @param {string} [o.selectedProjectId]          camada 1
 * @param {{owner, repo}} [o.repository]          camada 4
 * @param {string} [o.workspacePath]              camada 4
 * @param {string} [o.conversationProjectId]      camada 5
 * @param {string[]} [o.recentProjectIds]         camada 6 (mais recente primeiro)
 * @param {object} [o.options]                    limiares
 * @param {object} [o.index]                      retrato já carregado (opcional)
 */
async function resolveProject(o) {
  const opt = { ...DEFAULTS, ...(o.options || {}) };
  const idx = o.index || await loadIndex(o.vault, o.ctx);
  const msg = o.message || '';
  const byProject = new Map(idx.projects.map(p => [p.id, { project: p, signals: [] }]));
  const add = (projectId, layer, field, score) => {
    const c = byProject.get(projectId);
    if (c) c.signals.push({ layer, field, score });
  };

  // 1. Selecionado na UI
  if (o.selectedProjectId && byProject.has(o.selectedProjectId)) add(o.selectedProjectId, 1, 'selected_project', W.selected);

  // 2. Nome ou slug do projeto mencionado
  for (const p of idx.projects) {
    if (containsPhrase(msg, p.name)) add(p.id, 2, 'project.name', W.projectName);
    else if (containsPhrase(msg, p.slug.replace(/-/g, ' '))) add(p.id, 2, 'project.slug', W.projectName);
  }

  // 3. Aliases do projeto e nome/slug/aliases do cliente
  for (const p of idx.projects) {
    if ((p.aliases || []).some(a => containsPhrase(msg, a))) add(p.id, 3, 'project.aliases', W.projectAlias);
  }
  for (const c of idx.clients) {
    const names = [c.name, c.slug.replace(/-/g, ' '), ...(c.aliases || []), ...(c.identifiers || []).filter(i => i.kind !== 'domain').map(i => i.value)];
    const domainHit = (c.identifiers || []).some(i => i.kind === 'domain' && normalize(msg).includes(normalize(i.value)));
    if (!domainHit && !names.some(n => containsPhrase(msg, n))) continue;
    const own = idx.projects.filter(p => p.client_id === c.id);
    for (const p of own) add(p.id, 3, own.length === 1 ? 'client.name (projeto único)' : 'client.name', own.length === 1 ? W.clientOnly : W.clientShared);
  }

  // 4. Repositório / workspace atual
  if (o.repository && o.repository.owner && o.repository.repo) {
    for (const r of idx.repos) {
      if (r.owner.toLowerCase() === String(o.repository.owner).toLowerCase() && r.repo.toLowerCase() === String(o.repository.repo).toLowerCase()) {
        add(r.project_id, 4, 'repository', W.repository);
      }
    }
  }
  if (o.workspacePath) {
    const wp = normPath(o.workspacePath);
    for (const p of idx.projects) {
      const lp = p.workspace && normPath(p.workspace.local_path);
      if (lp && (wp === lp || wp.startsWith(lp + '/'))) add(p.id, 4, 'workspace.local_path', W.workspace);
    }
  }

  // 5. Projeto da conversa
  if (o.conversationProjectId) add(o.conversationProjectId, 5, 'conversation.project', W.conversation);

  // 6. Histórico recente (decai: 0.4, 0.2, 0.13, ...)
  (o.recentProjectIds || []).slice(0, 5).forEach((id, i) => add(id, 6, 'recent_history', W.history / (i + 1)));

  // 7. Busca no Vault: sobreposição lexical com descrição/stack/nome (só se nada mais forte casou)
  const strong = [...byProject.values()].some(c => c.signals.some(s => s.layer <= 4));
  if (!strong && msg) {
    for (const p of idx.projects) {
      const doc = [p.name, p.description, (p.stack || []).join(' '), (p.aliases || []).join(' ')].join(' ');
      const sim = overlap(msg, doc);
      if (sim >= 0.34) add(p.id, 7, 'vault_lexical_match', round(W.semantic * Math.min(1, sim * 1.5)));
    }
  }

  // Pontuação e ordenação
  const clientName = id => (idx.clients.find(c => c.id === id) || {}).name;
  const ranked = [...byProject.values()]
    .filter(c => c.signals.length)
    .map(c => ({ project_id: c.project.id, client_id: c.project.client_id, name: c.project.name,
      client_name: clientName(c.project.client_id) || null, score: round(combine(c.signals.map(s => s.score))), signals: c.signals }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const top = ranked[0];
  const second = ranked[1];
  const candidates = ranked.filter(r => r.score >= opt.minCandidate).slice(0, opt.maxCandidates)
    .map(({ project_id, client_id, name, client_name, score }) => ({ project_id, client_id, name, client_name, score }));

  // 8. Abaixo do limiar ou empate → perguntar
  const confident = !!top && top.score >= opt.threshold && (!second || top.score - second.score >= opt.margin);
  const result = {
    project_id: confident ? top.project_id : null,
    client_id: confident ? top.client_id : null,
    confidence: top ? top.score : 0,
    rationale: top ? top.signals.map(s => ({ layer: s.layer, field: s.field, score: s.score })) : [],
    candidates,
    needs_confirmation: !confident && candidates.length > 0,
    question: null,
    thresholds: { threshold: opt.threshold, margin: opt.margin },
  };
  if (result.needs_confirmation) {
    result.question = candidates.length === 1
      ? `Você está falando do projeto "${candidates[0].name}"${candidates[0].client_name ? ` (${candidates[0].client_name})` : ''}?`
      : `Encontrei ${candidates.length} projetos possíveis. Qual deles? ${candidates.map((c, i) => `${i + 1}) ${c.name}${c.client_name ? ` (${c.client_name})` : ''}`).join('; ')}.`;
  }
  return result;
}

module.exports = { resolveProject, loadIndex, combine, DEFAULTS, WEIGHTS: W };
