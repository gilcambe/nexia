'use strict';
// scripts/handle-draft-prs.js
// Lista PRs em draft do repositório, filtra os criados há mais de 48h,
// verifica se o CI não está verde e, se verdadeiro, fecha o PR com
// comentário explicativo, remove a label 'draft' e adiciona 'fila-revisao'.
// Roda com: node scripts/handle-draft-prs.js  (precisa de GITHUB_TOKEN)

const REPO = process.env.REPO || 'gilcambe/nexia';
const API = 'https://api.github.com';
const HORAS_DRAFT_MAX = 48;
const MARCA = (sha) => `<!-- handle-draft-prs ${sha} -->`;

async function gh(token, method, path, body) {
  const r = await fetch(`${API}/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, json };
}

function haMaisDe(horas, dataIso) {
  if (!dataIso) return false;
  return (Date.now() - new Date(dataIso).getTime()) > horas * 60 * 60 * 1000;
}

// CI verde: pelo menos um check-run concluído com sucesso e nenhum falhando/pendente.
async function ciVerde(token, sha) {
  const runs = ((await gh(token, 'GET', `/commits/${sha}/check-runs?per_page=100`)).json || {}).check_runs || [];
  if (!runs.length) return false; // sem CI = não pode considerar verde
  const concluidos = runs.filter(c => c.status === 'completed');
  if (!concluidos.length) return false; // tudo ainda rodando
  return concluidos.every(c => ['success', 'skipped', 'neutral'].includes(c.conclusion));
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN.');

  // Garante rótulos usados.
  for (const nome of ['draft', 'fila-revisao']) {
    await gh(token, 'POST', '/labels', { name: nome, color: 'fbca04' }).catch(() => null);
  }

  const prs = ((await gh(token, 'GET', '/pulls?state=open&sort=created&direction=asc&per_page=100')).json || []);
  const drafts = prs.filter(pr => pr.draft === true);
  let fechados = 0;
  let analisados = 0;

  for (const pr of drafts) {
    analisados++;
    const numero = pr.number;
    const criadoEm = pr.created_at;
    if (!haMaisDe(HORAS_DRAFT_MAX, criadoEm)) continue;

    const verde = await ciVerde(token, pr.head.sha);
    if (verde) continue; // CI verde: deixa em draft

    // Comentário explicativo.
    const corpo = `${MARCA(pr.head.sha)}Este PR estava em rascunho (draft) há mais de ${HORAS_DRAFT_MAX}h e o CI não está verde. Fechei o rascunho para não ficar parado.\n\nO que fazer agora:\n- Se ainda precisa de trabalho: volte a abrir como rascunho quando estiver pronto.\n- Se já está pronto para revisão: remova o rascunho e a label 'fila-revisao' já está adicionada para entrar na fila de revisão.\n\n---\n_Gerado pelo [handle-draft-prs](https://github.com/${REPO})_`;

    await gh(token, 'POST', `/issues/${numero}/comments`, { body: corpo });

    // Remove label 'draft' e adiciona 'fila-revisao'.
    await gh(token, `DELETE /issues/${numero}/labels/draft`).catch(() => null);
    await gh(token, 'POST', `/issues/${numero}/labels`, { labels: ['fila-revisao'] });

    // Fecha o PR.
    const r = await gh(token, 'PATCH', `/pulls/${numero}`, { state: 'closed' });
    if (r.status === 200) fechados++;
    console.log(`#${numero}: draft antigo com CI não verde → fechado, comentário e label fila-revisao (${r.status}).`);
  }

  console.log(`Analisados ${analisados} draft(s), ${fechados} fechado(s).`);
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { haMaisDe, ciVerde, MARCA };
