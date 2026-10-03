'use strict';
// Gates de QA (spec §22). Cada gate só passa com evidência de ferramenta: check run do
// GitHub (nome do check), veredito do Reviewer, Deployment do Vault. Sem evidência, o gate
// fica "pending" e a execução não é dada como concluída (spec §27: não fingir sucesso).
//
// Gates 1–7 vêm dos checks do commit/PR. Como cada repositório nomeia seus checks de um
// jeito, a correspondência é por nome; um check pode ser evidência de vários gates (ex.:
// "Typecheck, testes e build"). Gates obrigatórios sem check correspondente ficam
// pending; os opcionais (lint, integração, E2E) viram not_applicable.
const GATES = Object.freeze([
  { gate: 1, name: 'typecheck', re: /type ?check|tsc|typescript|types/i, required: false },
  { gate: 2, name: 'lint', re: /lint|eslint|format/i, required: false },
  { gate: 3, name: 'unit tests', re: /test|unit|jest|vitest|mocha/i, required: true },
  { gate: 4, name: 'integration tests', re: /integra|emulator|emulador/i, required: false },
  { gate: 5, name: 'build', re: /build/i, required: true },
  { gate: 6, name: 'security/dependency checks', re: /secret|gitleaks|audit|security|codeql|depend|snyk|trivy/i, required: true },
  { gate: 7, name: 'E2E/smoke', re: /e2e|playwright|cypress|smoke/i, required: false },
  { gate: 8, name: 'reviewer agent' },
  { gate: 9, name: 'deploy staging' },
  { gate: 10, name: 'health check' },
  { gate: 11, name: 'production policy' },
]);

function fromChecks(def, checks) {
  const hits = checks.filter(c => def.re.test(c.name));
  if (!hits.length) return { status: def.required ? 'pending' : 'not_applicable', evidence: def.required ? 'nenhum check do CI corresponde a este gate' : 'sem check correspondente no CI' };
  const names = hits.map(c => c.name).slice(0, 3).join(', ');
  if (hits.some(c => c.status === 'completed' && !['success', 'skipped', 'neutral'].includes(c.conclusion))) return { status: 'failed', evidence: `check: ${names}` };
  if (hits.every(c => c.status === 'completed')) return { status: 'passed', evidence: `check: ${names}` };
  return { status: 'pending', evidence: `em execução: ${names}` };
}

/**
 * @param {{ checks?: {name,status,conclusion}[]|null, ref?: string, review?: {verdict}|null, security?: {verdict}|null,
 *           wantsStaging?: boolean, deployment?: {id,status}|null, wantsProduction?: boolean }} ev
 * @returns {{ gate, name, status, evidence }[]}
 */
function evaluateGates(ev) {
  const out = [];
  for (const def of GATES) {
    let r;
    if (def.gate <= 7) {
      if (!ev.checks) r = { status: 'pending', evidence: 'sem commit/PR para verificar' };
      else {
        r = fromChecks(def, ev.checks);
        if (def.gate === 6 && r.status === 'pending' && /nenhum check/.test(r.evidence) && ev.security && ev.security.verdict === 'approve') r = { status: 'passed', evidence: 'Security Agent aprovou (sem check de dependências no CI)' };
        if (def.gate === 6 && r.status !== 'failed' && ev.security && ev.security.verdict === 'changes_requested') r = { status: 'failed', evidence: 'Security Agent apontou problemas' };
      }
    } else if (def.gate === 8) {
      r = !ev.review ? { status: 'pending', evidence: 'sem revisão' }
        : ev.review.verdict === 'approve' ? { status: 'passed', evidence: 'Reviewer Agent aprovou' } : { status: 'failed', evidence: 'Reviewer Agent pediu mudanças' };
    } else if (def.gate === 9 || def.gate === 10) {
      if (!ev.wantsStaging) r = { status: 'not_applicable', evidence: 'pedido sem publicação em staging' };
      else if (!ev.deployment) r = { status: 'pending', evidence: 'staging ainda não disparado' };
      else if (ev.deployment.status === 'succeeded') r = { status: 'passed', evidence: def.gate === 9 ? `Deployment ${ev.deployment.id}` : `smoke/health do pipeline (${ev.deployment.id})` };
      else if (ev.deployment.status === 'failed') r = { status: 'failed', evidence: `Deployment ${ev.deployment.id} falhou` };
      else r = { status: 'pending', evidence: `Deployment ${ev.deployment.id} ${ev.deployment.status}` };
    } else {
      r = ev.wantsProduction ? { status: 'pending', evidence: 'produção exige aprovação humana' } : { status: 'not_applicable', evidence: 'pedido sem produção' };
    }
    out.push({ gate: def.gate, name: def.name, status: r.status, evidence: String(r.evidence).slice(0, 300) });
  }
  return out;
}

/** succeeded só se todo gate passou ou não se aplica; failed se algum falhou; senão pending. */
function verdict(gates) {
  if (gates.some(g => g.status === 'failed')) return 'failed';
  if (gates.every(g => g.status === 'passed' || g.status === 'not_applicable')) return 'passed';
  return 'pending';
}

module.exports = { GATES, evaluateGates, verdict };
