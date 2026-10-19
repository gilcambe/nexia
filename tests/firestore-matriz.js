'use strict';
// #814 Matriz "quem lê/escreve o quê" das regras do Firestore (firestore.rules), por coleção e por papel.
// Cada linha: documento (ou coleção, em "list"), operação e os papéis que PODEM. Todo papel fora de "pode"
// tem que ser negado. Rodada no Emulator por tests/integration/firestore-matriz.test.js.
// Mudou uma regra? Mude a linha aqui no mesmo PR. Publicar regras continua dependendo do dono.

// Papéis: anon (sem login), aluno e coach do Body Coach (contas comuns, sem tenant), membro e admin de um
// tenant (cliente da NEXIA), dono (master da NEXIA). "outro" é um usuário comum de outro tenant.
const PAPEIS = ['anon', 'aluno', 'coach', 'membro', 'admin', 'outro', 'dono'];

const USUARIOS = {
  anon: null,
  aluno: { role: 'user', tenantSlug: 'guest', email: 'aluno@x.com' },
  coach: { role: 'user', tenantSlug: 'guest', email: 'coach@x.com' },
  membro: { role: 'user', tenantSlug: 'tenant-a', email: 'membro@a.com' },
  admin: { role: 'admin', tenantSlug: 'tenant-a', email: 'admin@a.com' },
  outro: { role: 'user', tenantSlug: 'tenant-b', email: 'outro@b.com' },
  dono: { role: 'master', tenantSlug: 'nexia', email: 'dono@nexia.com' },
};

const refeicao = { name: 'Almoço', calories: 600, protein: 40, carbs: 60, fat: 20 };

const SEMENTES = {
  'bodycoach_users/aluno/meals/m1': refeicao,
  'bodycoach_users/aluno/medical_exams/e1': { title: 'Hemograma', taken_at: '2026-10-01' },
  'bodycoach_users/aluno/progress_entries/p1': { taken_at: '2026-10-01', weight_kg: 80, image_url: 'data:image/jpeg;base64,AAAA' },
  'bodycoach_users/aluno/profile/main': { full_name: 'Aluno', email: 'aluno@x.com' },
  'tenants/tenant-a': { slug: 'tenant-a', plan: 'free', name: 'A' },
  'tenants/tenant-b': { slug: 'tenant-b', plan: 'pro', name: 'B' },
  'tenants/tenant-a/members/membro': { role: 'user' },
  'tenants/tenant-a/cortex_memory/membro_default': { history: ['oi'] },
  'tenants/tenant-a/strike_campaigns/s1': { nome: 'Campanha' },
  'tenants/tenant-a/notifications/n1': { texto: 'Aviso' },
  'tenants/tenant-a/strike_pool/p1': { v: 1 },
  'tenants/tenant-a/striker_prospects/p1': { v: 1 },
  'tenants/tenant-a/pool_notifications/n1': { texto: 'Aviso' },
  'tenants/tenant-a/kpi/k1': { v: 1 },
  'tenants/tenant-a/billing/b1': { total: 10 },
  'tenants/tenant-a/usage/u1': { calls: 1 },
  'tenants/tenant-a/audit_log/l1': { a: 1 },
  'tenants/tenant-a/rag_docs/r1': { t: 'doc' },
  'tenants/tenant-a/sentinel/s1': { ok: true },
  'tenants/tenant-a/modules/m1': { on: true },
  'tenants/tenant-a/config/brand': { cor: '#000' },
  'tenants/tenant-a/osint_log/o1': { q: 'x' },
  'tenants/tenant-a/clients/c1': { nome: 'Cliente A' },
  'tenants/tenant-b/clients/c1': { nome: 'Cliente B' },
  'nexia_config/public': { v: 1 },
  'system/overrides': { v: 1 },
  'system_status/last': { ok: true },
  'sentinel_reports/r1': { ok: true },
  'sentinel_heals/h1': { ok: true },
  'vault_projects/p1': { tenant_id: 'tenant-a', name: 'Projeto A' },
  'vault_projects/p2': { tenant_id: 'tenant-b', name: 'Projeto B' },
  'vault_idempotency/i1': { tenant_id: 'tenant-a' },
  'vault_unique/u1': { tenant_id: 'tenant-a' },
  // Coleções que só o servidor (Admin SDK) usa: nenhum cliente lê nem grava.
  'bc_acesso/aluno': { plano: 'mensal' },
  'bc_diretorio/coach': { nome: 'Coach' },
  'bc_conversas/coach_aluno': { de: 'coach' },
  'bc_conversas/coach_aluno/mensagens/m1': { texto: 'oi' },
  'bc_cupons/C1': { desconto: 10 },
  'bc_push/aluno': { token: 'x' },
  'bc_config/geral': { v: 1 },
  'cortex_logs/l1': { msg: 'x' },
  'agents/a1': { nome: 'Agente' },
};

const TODOS_LOGADOS = ['aluno', 'coach', 'membro', 'admin', 'outro', 'dono'];
const L = (doc, op, pode, extra = {}) => ({ doc, op, pode, ...extra });

const MATRIZ = [
  // Perfil do usuário
  L('users/aluno', 'read', ['aluno', 'dono'], { nota: 'perfil é só do dono da conta e do master' }),
  L('users/aluno', 'update', ['aluno', 'dono'], { dados: { displayName: 'Novo nome' } }),
  L('users/aluno', 'update', ['dono'], { dados: { role: 'master' }, nota: 'ninguém se promove' }),
  L('users/aluno', 'update', ['dono'], { dados: { tenantSlug: 'tenant-a' }, nota: 'ninguém entra em tenant sozinho' }),
  L('users/aluno', 'delete', ['dono']),
  L('users/novo', 'create', [], { dados: { uid: 'novo', role: 'user' }, nota: 'perfil de outra pessoa' }),
  L('users', 'list', ['dono'], { nota: 'só o master lista usuários' }),

  // Body Coach: dados de saúde (LGPD) só do próprio aluno. Coach e master veem pelo servidor, com consentimento.
  L('bodycoach_users/aluno/meals/m1', 'read', ['aluno']),
  L('bodycoach_users/aluno/meals', 'list', ['aluno']),
  L('bodycoach_users/aluno/meals/m2', 'create', ['aluno'], { dados: refeicao }),
  L('bodycoach_users/aluno/meals/m1', 'delete', ['aluno']),
  L('bodycoach_users/aluno/medical_exams/e1', 'read', ['aluno'], { nota: 'exame médico' }),
  L('bodycoach_users/aluno/progress_entries/p1', 'read', ['aluno'], { nota: 'foto do corpo' }),
  L('bodycoach_users/aluno/profile/main', 'update', ['aluno'], { dados: { full_name: 'Outro nome' } }),
  L('bodycoach_users/aluno/meals/m3', 'create', [], { dados: { ...refeicao, user_id: 'coach' }, nota: 'user_id de outra pessoa' }),
  L('bodycoach_users/aluno/segredos/x', 'create', [], { nota: 'coleção fora da lista' }),

  // Tenant (cliente da NEXIA) e subcoleções
  L('tenants/tenant-a', 'read', ['membro', 'admin', 'dono']),
  L('tenants/tenant-a', 'update', ['admin', 'dono'], { dados: { name: 'A2' } }),
  L('tenants/tenant-a', 'update', ['dono'], { dados: { plan: 'enterprise' }, nota: 'plano e cobrança só o master' }),
  L('tenants/tenant-c', 'create', ['dono'], { dados: { slug: 'tenant-c' } }),
  L('tenants/tenant-a', 'delete', ['dono']),
  L('tenants/tenant-a/members/membro', 'read', ['membro', 'admin', 'dono']),
  L('tenants/tenant-a/members/novo', 'create', ['admin', 'dono']),
  L('tenants/tenant-a/cortex_memory/membro_default', 'read', ['membro', 'dono'], { nota: 'memória é de cada um' }),
  L('tenants/tenant-a/cortex_memory/membro_default', 'update', ['membro', 'dono']),
  L('tenants/tenant-a/strike_campaigns/s1', 'read', ['membro', 'admin']),
  L('tenants/tenant-a/strike_campaigns/s2', 'create', ['membro', 'admin']),
  L('tenants/tenant-a/notifications/n1', 'read', ['membro', 'admin']),
  L('tenants/tenant-a/notifications/n2', 'create', ['membro', 'admin']),
  L('tenants/tenant-a/notifications/n1', 'update', ['admin', 'dono']),
  L('tenants/tenant-a/strike_pool/p1', 'read', ['membro', 'admin']),
  L('tenants/tenant-a/strike_pool/p1', 'update', ['membro', 'admin']),
  L('tenants/tenant-a/striker_prospects/p1', 'read', ['membro', 'admin']),
  L('tenants/tenant-a/striker_prospects/p1', 'update', ['membro', 'admin']),
  L('tenants/tenant-a/pool_notifications/n2', 'create', ['membro', 'admin']),
  L('tenants/tenant-a/pool_notifications/n1', 'delete', ['admin', 'dono']),
  L('tenants/tenant-a/kpi/k1', 'read', ['membro', 'admin']),
  L('tenants/tenant-a/kpi/k1', 'update', ['admin', 'dono']),
  L('tenants/tenant-a/billing/b1', 'read', ['admin', 'dono']),
  L('tenants/tenant-a/billing/b1', 'update', ['dono']),
  L('tenants/tenant-a/usage/u1', 'read', ['admin', 'dono']),
  L('tenants/tenant-a/usage/u1', 'update', ['dono'], { nota: 'cota é do servidor; membro não zera a própria cota' }),
  L('tenants/tenant-a/audit_log/l1', 'read', ['admin', 'dono']),
  L('tenants/tenant-a/audit_log/l2', 'create', [], { nota: 'auditoria só pelo servidor' }),
  L('tenants/tenant-a/audit_log/l1', 'update', [], { nota: 'registro de auditoria não muda' }),
  L('tenants/tenant-a/audit_log/l1', 'delete', []),
  L('tenants/tenant-a/rag_docs/r1', 'read', ['membro', 'admin']),
  L('tenants/tenant-a/rag_docs/r1', 'update', ['admin', 'dono']),
  L('tenants/tenant-a/sentinel/s1', 'read', ['admin', 'dono']),
  L('tenants/tenant-a/sentinel/s1', 'update', ['dono']),
  L('tenants/tenant-a/modules/m1', 'read', ['membro', 'admin', 'dono']),
  L('tenants/tenant-a/modules/m1', 'update', ['admin', 'dono']),
  L('tenants/tenant-a/config/brand', 'read', ['membro', 'admin', 'dono']),
  L('tenants/tenant-a/config/brand', 'update', ['admin', 'dono']),
  L('tenants/tenant-a/osint_log/o1', 'read', ['admin', 'dono']),
  L('tenants/tenant-a/osint_log/o2', 'create', ['membro', 'admin']),
  L('tenants/tenant-a/osint_log/o1', 'update', []),
  L('tenants/tenant-a/clients/c1', 'read', ['membro', 'admin', 'dono'], { nota: 'subcoleção sem regra própria' }),
  L('tenants/tenant-a/clients/c2', 'create', ['admin', 'dono']),
  L('tenants/tenant-b/clients/c1', 'read', ['outro', 'dono'], { nota: 'um tenant não vê o outro' }),

  // Configuração e estado da plataforma
  L('nexia_config/public', 'read', TODOS_LOGADOS),
  L('nexia_config/public', 'update', ['dono']),
  L('system/overrides', 'read', ['dono']),
  L('system/overrides', 'update', ['dono']),
  L('system_status/last', 'read', ['admin', 'dono']),
  L('system_status/last', 'update', []),
  L('sentinel_reports/r1', 'read', ['admin', 'dono']),
  L('sentinel_reports/r1', 'update', []),
  L('sentinel_heals/h1', 'read', ['admin', 'dono']),

  // NEXIA AI Vault: só leitura, master em tudo e admin no próprio tenant; ninguém grava pelo cliente.
  L('vault_projects/p1', 'read', ['admin', 'dono']),
  L('vault_projects/p2', 'read', ['dono']),
  L('vault_projects/p1', 'update', []),
  L('vault_idempotency/i1', 'read', []),
  L('vault_unique/u1', 'read', []),

  // Só o servidor: nenhum cliente, nem o master pelo app, lê ou grava.
  ...['bc_acesso/aluno', 'bc_diretorio/coach', 'bc_conversas/coach_aluno', 'bc_conversas/coach_aluno/mensagens/m1', 'bc_cupons/C1',
    'bc_push/aluno', 'bc_config/geral', 'cortex_logs/l1', 'agents/a1'].flatMap((d) => [L(d, 'read', []), L(d, 'update', [])]),
  L('qualquer_coisa/x', 'create', [], { nota: 'o resto é negado' }),
];

module.exports = { PAPEIS, USUARIOS, SEMENTES, MATRIZ };
