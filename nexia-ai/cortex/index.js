'use strict';
// Ponte entre o chat legado (cortex-chat) e o NEXIA AI (Fase 4).
// Quando há projeto em jogo, resolve o projeto (Project Resolver) e devolve o
// contexto compacto do Vault (Context Engine) ou uma pergunta de desambiguação.
// Quando não há (sem acesso ao Vault, sem projetos, mensagem sem relação), devolve
// { mode: 'none' } e o chat segue exatamente o fluxo anterior.
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../vault');
const { resolveProject, loadIndex } = require('../project-resolver');
const { buildContext } = require('../context-engine');

const STATE_COLLECTION = 'nexia_chat_state'; // fora de vault_*: regras negam todo acesso de cliente
const TENANT_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const ID_RE = /^prj_[0-9a-f]{32}$/;
const CONV_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const EXPLICIT_LAYERS = [1, 2, 3, 4];

/** Mesmo critério das regras vault_* e de /api/nexia: master ou admin do próprio tenant (perfil). */
async function canUseVault(db, uid, role, tenantId) {
  if (!uid || !TENANT_RE.test(tenantId || '')) return false;
  if (role === 'master') return true;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const p = snap.data();
  return p.role === 'master' || (p.role === 'admin' && (p.tenantSlug || p.tenant) === tenantId);
}

/**
 * @param {{ db, uid, role, tenantId, message, projectId?, conversationId?, budgetTokens? }} o
 * @returns {Promise<{ mode: 'none' } | { mode: 'context', text, project, context } | { mode: 'ask', question, candidates, project }>}
 */
async function resolveForChat(o) {
  const { db, uid, role, tenantId, message } = o;
  if (!db || !(await canUseVault(db, uid, role, tenantId))) return { mode: 'none', reason: 'no_vault_access' };
  const vault = createVault({ db });
  const ctx = createExecutionContext({ tenantId, actor: { type: 'user', id: uid } });
  const tenant = await db.collection('tenants').doc(tenantId).get();
  if (!tenant.exists) return { mode: 'none', reason: 'tenant_not_found' };
  const index = await loadIndex(vault, ctx);
  if (!index.projects.length) return { mode: 'none', reason: 'no_projects' };

  const conv = CONV_RE.test(o.conversationId || '') ? o.conversationId : 'default';
  const stateRef = db.collection(STATE_COLLECTION).doc(crypto.createHash('sha256').update(`${tenantId}|${uid}|${conv}`).digest('hex'));
  const state = (await stateRef.get()).data() || {};
  const recent = Array.isArray(state.project_ids) ? state.project_ids.filter(id => ID_RE.test(id)) : [];

  const pc = await resolveProject({
    vault, ctx, index, message,
    selectedProjectId: ID_RE.test(o.projectId || '') ? o.projectId : undefined,
    conversationProjectId: recent[0], recentProjectIds: recent,
  });
  const explicit = pc.rationale.some(r => EXPLICIT_LAYERS.includes(r.layer))
    || pc.candidates.length > 1 && pc.candidates.every(c => c.score >= 0.5);

  if (pc.project_id) {
    const context = await buildContext({ vault, ctx, projectId: pc.project_id, message, budgetTokens: o.budgetTokens });
    await stateRef.set({ tenant_id: tenantId, uid, project_ids: [pc.project_id, ...recent.filter(id => id !== pc.project_id)].slice(0, 5),
      updated_at: new Date() }, { merge: true });
    return { mode: 'context', text: context.text, project: pc, context };
  }
  if (pc.needs_confirmation && explicit) return { mode: 'ask', question: pc.question, candidates: pc.candidates, project: pc };
  return { mode: 'none', reason: 'no_project_in_play', project: pc };
}

/** Seção acrescentada ao system prompt quando há contexto. */
function promptSection(r) {
  if (!r || r.mode !== 'context' || !r.text) return '';
  return `\n## CONTEXTO DO PROJETO (Vault NEXIA AI)\nUse estes dados como fonte de verdade sobre o projeto; cite o id entre colchetes quando usar um item. Se algo necessário não estiver aqui, diga que não está no Vault em vez de supor.\n${r.text}\n`;
}

module.exports = { resolveForChat, promptSection, canUseVault, STATE_COLLECTION };
