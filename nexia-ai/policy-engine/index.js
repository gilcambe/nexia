'use strict';
// Policy Engine (spec §15 "Níveis de risco", §23 "Autonomia gradual").
// Decide se a chamada de uma ferramenta é automática, requer confirmação humana ou é
// proibida, a partir de: risco declarado pela ferramenta (LOW/MEDIUM/HIGH/CRITICAL),
// nível de autonomia do projeto (0–5), ambiente e a ToolPolicy do projeto.
//
// Padrão (sem regra do projeto):
//   LOW       → auto (leitura, busca, análise, testes)
//   MEDIUM    → auto se autonomia ≥ min_autonomy da ferramenta (padrão 1); senão confirm
//   HIGH      → auto se autonomia ≥ min_autonomy (padrão 3); senão confirm
//   CRITICAL  → confirm sempre (produção, secrets, exclusão, migração destrutiva, billing)
//   produção  → qualquer risco acima de LOW pede confirmação, em qualquer autonomia
//   ferramenta desconhecida → forbidden
// Regras do projeto: "forbidden" e "confirm" sempre valem; "auto" só vale para risco
// até HIGH e fora de produção (não dá para liberar CRITICAL nem produção por regra).
// A regra mais específica ganha (ferramenta exata > curinga; com ambiente > sem);
// "forbidden" em qualquer regra que case ganha de todas.
const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const DEFAULT_MIN_AUTONOMY = { LOW: 0, MEDIUM: 1, HIGH: 3, CRITICAL: Infinity };

function matches(pattern, tool) {
  if (pattern === '*') return true;
  const p = pattern.split('.');
  const t = tool.split('.');
  if (p[p.length - 1] === '*') return t.length >= p.length && p.slice(0, -1).every((seg, i) => seg === '*' || seg === t[i]);
  return p.length === t.length && p.every((seg, i) => seg === '*' || seg === t[i]);
}

function specificity(rule) {
  const wild = (rule.tool.match(/\*/g) || []).length;
  return (rule.tool === '*' ? 0 : 100 - wild * 10 + rule.tool.split('.').length) + (rule.environment ? 1000 : 0);
}

/**
 * @param {{ tool?: { name, risk, min_autonomy? }, project: { autonomy_level }, environment?: string, policy?: { rules } }} o
 * @returns {{ decision: 'auto'|'confirm'|'forbidden', reason: string, risk?: string, rule?: object }}
 */
function decide({ tool, project, environment, policy }) {
  if (!tool || !RISK_ORDER.hasOwnProperty(tool.risk)) return { decision: 'forbidden', reason: 'Ferramenta desconhecida ou sem nível de risco declarado.' };
  const autonomy = Number.isInteger(project && project.autonomy_level) ? project.autonomy_level : 0;
  const risk = tool.risk;
  const prod = environment === 'production';
  const min = Number.isInteger(tool.min_autonomy) ? tool.min_autonomy : DEFAULT_MIN_AUTONOMY[risk];

  let base;
  if (risk === 'LOW') base = { decision: 'auto', reason: 'Risco LOW (leitura/análise).' };
  else if (risk === 'CRITICAL') base = { decision: 'confirm', reason: 'Risco CRITICAL sempre exige confirmação humana.' };
  else if (prod) base = { decision: 'confirm', reason: `Risco ${risk} em produção exige confirmação humana.` };
  else if (autonomy >= min) base = { decision: 'auto', reason: `Risco ${risk} permitido na autonomia ${autonomy} (mínimo ${min}).` };
  else base = { decision: 'confirm', reason: `Risco ${risk} exige autonomia ${min}; o projeto está no nível ${autonomy}.` };

  const rules = ((policy && policy.rules) || [])
    .filter(r => matches(r.tool, tool.name) && (!r.environment || r.environment === environment));
  if (!rules.length) return { ...base, risk };

  const forbid = rules.find(r => r.decision === 'forbidden');
  if (forbid) return { decision: 'forbidden', reason: `Proibida pela política do projeto (${forbid.tool}${forbid.environment ? ` em ${forbid.environment}` : ''}).`, risk, rule: forbid };
  const rule = rules.slice().sort((a, b) => specificity(b) - specificity(a))[0];
  if (rule.decision === 'confirm') return { decision: 'confirm', reason: `Política do projeto pede confirmação (${rule.tool}).`, risk, rule };
  // rule.decision === 'auto'
  if (RISK_ORDER[risk] > RISK_ORDER.HIGH || (prod && risk !== 'LOW')) {
    return { ...base, reason: `${base.reason} A política do projeto não pode liberar ${prod ? 'produção' : 'risco CRITICAL'}.`, risk, rule };
  }
  return { decision: 'auto', reason: `Liberada pela política do projeto (${rule.tool}).`, risk, rule };
}

module.exports = { decide, matches, RISK_ORDER, DEFAULT_MIN_AUTONOMY };
