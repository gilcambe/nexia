'use strict';
// Revisor de PR do Jules: aprova PRs com IA grátis, adiciona label 'automerge'
// ou 'revisor-recusou', e fecha PRs vazios. Nunca aprova arquivos restritos.
// Desliga com REVIEW_PR=0.

const REPO = process.env.REPO || 'gilcambe/nexia';
const MAX_POR_RODADA = 6;
const MAX_DIFF = 45000;
const MAX_ADICOES = 400;
const NOTA_MIN = 8;
const MARCA = (sha) => `<!-- review-pr ${sha} -->`;

// Arquivos que nunca recebem 'automerge' pelo revisor automático.
const PROIBIDO = /^(\.github\/|firestore\.rules|firestore\.indexes|storage\.rules|\.env|wrangler|package(-lock)?\.json|cloudflare\/(worker|app)\.js|lib\/firebase-lite|sites\/[^/]+\/dados)|(secret|credential|auth|login|senha|\.pem$|\.key$)/i;

const SISTEMA = `Você é um revisor de código rigoroso do projeto NEXIA.
Regras do dono que o PR NÃO pode quebrar:
- Nada pago (nenhum provedor/serviço que cobre). Nenhuma chave, senha ou token escrito no código.
- O que está no ar não pode quebrar (Body Coach, Cortex/Central, Studio Lima, Bezsan). Nunca remover função existente.
- Nada de dados falsos/mocks apresentados como reais. Nada de API ou função inventada.
- Handler novo do servidor precisa estar registrado em cloudflare/functions.js e lib/routes.js.
- O PR deve fazer o que a tarefa pediu, e só isso.
Responda SOMENTE um JSON: {"aprovar": true|false, "nota": 0-10, "motivo": "uma frase", "problemas": ["..."]}.
Aprove só se tiver certeza de que está correto, completo e seguro.`;

// Importar funções utilitárias do revisor-gratis
const { issueDoPr, ciVerde, isRestrictedChange, isEmptyPR, escolher, mencionaCortexFila } = require('./revisor-gratis');



function decidir(votos) {
  const validos = votos.filter(Boolean);
  if (!validos.length) return { acao: 'esperar' };
  const recusa = validos.find(v => !v.aprovar || v.nota < NOTA_MIN);
  if (recusa) return { acao: 'recusar', voto: recusa };
  const provedores = new Set(validos.map(v => v.provider));
  if (provedores.size >= 2) return { acao: 'aprovar' };
  return { acao: 'esperar' };
}

// ---------- execução ----------
async function gh(token, method, path, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, json };
}

async function votar(router, lista, conteudo, usados) {
  for (const d of lista) {
    if (usados.has(d.provider)) continue;
    try {
      if (!router.capabilities(d).available) continue;
      const out = await Promise.race([
        router.chat(d, { system: SISTEMA, messages: [{ role: 'user', content: conteudo }], maxTokens: 1200 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000)),
      ]);
      const v = require('./revisor-gratis').lerVeredito(out && out.text);
      if (v) { usados.add(d.provider); return { ...v, provider: d.provider, model: d.model }; }
    } catch { /* cota ou erro: próximo modelo */ }
  }
  return null;
}

async function main() {
  if (process.env.REVIEW_PR === '0') return console.log('REVIEW_PR=0: desligado.');
  const token = process.env.GITHUB_TOKEN;
  const prs = (await gh(token, 'GET', '/pulls?state=open&base=develop&per_page=100')).json || [];
  const candidatos = escolher(prs);
  const { getRouter } = require('../nexia-ai/model-router');
  const { listFor } = require('../nexia-ai/orchestrator/models');
  const router = getRouter();
  const lista = [...listFor('reasoning'), ...listFor('coding'), ...listFor('fast')]
    .filter((d, i, arr) => d.provider !== 'anthropic' && arr.findIndex(x => x.provider === d.provider && x.model === d.model) === i);
  let feitos = 0;
  // Cache de corpos de issue para verificar 'cortex-fila'.
  const issuesPorNumero = {};
  for (const pr of candidatos) {
    if (feitos >= MAX_POR_RODADA) break;
    const runs = ((await gh(token, 'GET', `/commits/${pr.head.sha}/check-runs?per_page=100`)).json || {}).check_runs || [];
    if (!ciVerde(runs)) continue;
    const comentarios = (await gh(token, 'GET', `/issues/${pr.number}/comments?per_page=100`)).json || [];
    if (comentarios.some(c => String(c.body || '').includes(MARCA(pr.head.sha)))) continue;
    feitos++;
    const arquivos = (await gh(token, 'GET', `/pulls/${pr.number}/files?per_page=100`)).json || [];
    pr.files = arquivos;

    // PR vazio: fecha com comentário.
    if (isEmptyPR(pr)) {
      await gh(token, 'PATCH', `/pulls/${pr.number}`, { state: 'closed' });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}🪜 review-pr: PR vazio (sem arquivos alterados). Fechado automaticamente.` });
      console.log(`PR #${pr.number}: fechado (vazio).`);
      continue;
    }

    // Arquivos restritos: nunca aprova com 'automerge'.
    if (isRestrictedChange(pr)) {
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['revisor-recusou'] });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}🪜 review-pr: recusado. Altera arquivo(s) restrito(s), que nunca recebem 'automerge'.` });
      console.log(`PR #${pr.number}: recusado (arquivo restrito).`);
      continue;
    }

    // Deve mencionar issue com 'cortex-fila'.
    const n = issueDoPr(pr);
    if (n && !issuesPorNumero[n]) {
      const iss = (await gh(token, 'GET', `/issues/${n}`)).json || {};
      issuesPorNumero[n] = iss.body || '';
    }
    if (!mencionaCortexFila(pr, issuesPorNumero)) {
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['revisor-recusou'] });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}🪜 review-pr: recusado. A descrição não menciona uma issue contendo 'cortex-fila'.` });
      console.log(`PR #${pr.number}: recusado (sem issue cortex-fila).`);
      continue;
    }

    const conteudo = `TAREFA (issue #${n || '?'}): ${String(issuesPorNumero[n] || '').slice(0, 4000)}\n\nPR #${pr.number}: ${pr.title}\n`;
    const usados = new Set();
    const v1 = await votar(router, lista, conteudo, usados);
    const v2 = v1 && v1.aprovar && v1.nota >= NOTA_MIN ? await votar(router, lista, conteudo, usados) : null;
    const d = decidir([v1, v2]);
    d.votos = [v1, v2].filter(Boolean);
    const quem = (d.votos || [d.voto]).filter(Boolean).map(v => `${v.provider}${v.model ? `/${v.model}` : ''} nota ${v.nota}`).join(', ');

    if (d.acao === 'aprovar') {
      // Aprovação via IA grátis (modelo gratuito do NEXIA)
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['automerge'] });
      await gh(token, 'DELETE', `/issues/${pr.number}/labels/revisao-manual` });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}🪜 review-pr aprovado (${quem}). Aprovado via IA grátis. Entra sozinho com o CI verde.` });
      console.log(`PR #${pr.number}: aprovado via IA grátis (${quem}).`);
    } else if (d.acao === 'recusar') {
      const v = d.voto;
      const texto = `🪜 review-pr recusado (${quem}): ${v.motivo}${v.problemas.length ? `\n${v.problemas.map(p => `- ${p}`).join('\n')}` : ''}`;
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['revisor-recusou'] });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}${texto}` });
      console.log(`PR #${pr.number}: recusado (${v.motivo}).`);
    } else console.log(`PR #${pr.number}: sem IA com cota agora; tenta na próxima rodada.`);
  }
  console.log(`${candidatos.length} PR(s) do Jules, ${feitos} revisado(s).`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { decidir, MARCA, NOTA_MIN };
