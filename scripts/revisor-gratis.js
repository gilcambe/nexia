'use strict';
// Revisor grátis (escada de IAs, docs/ESCADA-IA.md, pedido do dono em 26/10/2026: "é inadmissível o Cortex travar").
// Causa real de tarefas paradas: PRs do Cortex e do Jules com CI verde que mexem em área "sensível" ficavam esperando
// a revisão da Claude para sempre (rótulo revisao-manual ou sem rótulo). Agora 2 IAs grátis de provedores diferentes
// revisam o diff com as regras do projeto. As duas aprovam → rótulo automerge (o Merge automático junta com CI verde).
// Alguma recusa → rótulo revisor-recusou + comentário no PR e na issue; a escada (cloudflare/jules-auto.js) trata o PR
// recusado como "sem PR" e a tarefa segue para o próximo degrau. Nunca aprova .github/, regras do Firestore ou segredos.
// Desliga com REVISOR_GRATIS=0.

const REPO = process.env.REPO || 'gilcambe/nexia';
const MAX_POR_RODADA = 6;
const MAX_DIFF = 45000;
const MAX_ADICOES = 400;   // dono (26/10): só PR pequeno entra sozinho; nunca quebrar o que funciona
const NOTA_MIN = 8;
const MARCA = (sha) => `<!-- revisor-gratis ${sha} -->`;
// Nunca aprovado pelo revisor: workflows/deploy, regras, segredos, login, Worker principal, dependências e dados de clientes.
// Chat do Cortex ao vivo (regressão real: o PR #1898 mudou o model-router e derrubou o chat). Estes arquivos
// nunca entram pelo revisor grátis: precisam do teste rápido do chat ao vivo (resposta + tempo) antes do merge.
const CHAT_VIVO = /^(nexia-ai\/(model-router|orchestrator)\/|netlify\/functions\/cortex-|lib\/cortex-chat)/;
const PROIBIDO = /^(\.github\/|firestore\.rules|firestore\.indexes|storage\.rules|\.env|wrangler|package(-lock)?\.json|cloudflare\/(worker|app)\.js|lib\/firebase-lite|sites\/[^/]+\/dados)|(secret|credential|auth|login|senha|\.pem$|\.key$)/i;

const SISTEMA = `Você é um revisor de código rigoroso do projeto NEXIA (Node 20, Cloudflare Worker grátis, Firebase sem Blaze, React/Vite).
Regras do dono que o PR NÃO pode quebrar:
- Nada pago (nenhum provedor/serviço que cobre). Nenhuma chave, senha ou token escrito no código.
- O que está no ar não pode quebrar (Body Coach, Cortex/Central, Studio Lima, Bezsan). Nunca remover função existente.
- Nada de dados falsos/mocks apresentados como reais. Nada de API ou função inventada (ex.: router.complete não existe).
- Não criar estrutura de outro framework que o projeto não usa (Express/Mongoose/Vue/EJS em pastas que não existem).
- Handler novo do servidor precisa estar registrado em cloudflare/functions.js e lib/routes.js.
- O PR deve fazer o que a tarefa pediu, e só isso.
Responda SOMENTE um JSON: {"aprovar": true|false, "nota": 0-10, "motivo": "uma frase", "problemas": ["..."]}.
Aprove só se tiver certeza de que está correto, completo e seguro.`;

// ---------- funções puras (testadas) ----------
function issueDoPr(pr) {
  const m = /(?:fecha|closes|fixes|resolve[sd]?|de)\s+#(\d+)/i.exec(`${pr.title || ''}\n${pr.body || ''}`) || /#(\d{3,})/.exec(`${pr.title || ''}\n${pr.body || ''}`);
  return m ? Number(m[1]) : null;
}

function ciVerde(runs) {
  const r = (runs || []).filter(c => c.name !== 'Merge automático' && c.name !== 'Testar com login');
  return r.some(c => c.name === 'Typecheck, testes e build')
    && r.every(c => c.status === 'completed' && ['success', 'skipped', 'neutral'].includes(c.conclusion));
}

// Quais PRs revisar: branch nexia/ deste repositório, para develop, sem automerge e sem recusa anterior.
function escolher(prs) {
  return (prs || []).filter(pr => pr.base && pr.base.ref === 'develop'
    && pr.head && pr.head.repo && pr.head.repo.full_name === REPO && /^nexia\//.test(pr.head.ref || '')
    && !/demo/i.test(pr.title || '')
    && !(pr.labels || []).some(l => ['automerge', 'revisor-recusou', 'so-humano', 'dono-aprovou'].includes(l.name)));
}

// Barreiras objetivas antes de gastar IA. Devolve um motivo (string) ou null.
function barreira(arquivos, pr) {
  const nomes = arquivos.map(a => a.filename);
  const ruim = nomes.find(n => PROIBIDO.test(n));
  if (ruim) return `mexe em ${ruim} (só o dono ou a Claude aprovam isso)`;
  const chat = nomes.find(n => CHAT_VIVO.test(n));
  if (chat) return `mexe no chat do Cortex (${chat}): só entra depois do teste do chat ao vivo (resposta e tempo)`;
  if ((pr.additions || 0) > MAX_ADICOES || nomes.length > 10) return `grande demais (${nomes.length} arquivos, +${pr.additions}); precisa ser dividido`;
  if (!nomes.length) return 'PR vazio';
  return null;
}

function montarDiff(arquivos) {
  let out = '';
  for (const a of arquivos) {
    const bloco = `\n### ${a.filename} (${a.status}, +${a.additions} -${a.deletions})\n${a.patch || '(binário ou grande demais para mostrar)'}\n`;
    if (out.length + bloco.length > MAX_DIFF) { out += `\n### ${a.filename} (cortado: diff grande)\n`; continue; }
    out += bloco;
  }
  return out;
}

function lerVeredito(texto) {
  const m = /\{[\s\S]*\}/.exec(String(texto || ''));
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    if (typeof v.aprovar !== 'boolean') return null;
    return { aprovar: v.aprovar, nota: Number(v.nota) || 0, motivo: String(v.motivo || '').slice(0, 300), problemas: (Array.isArray(v.problemas) ? v.problemas : []).map(String).slice(0, 6) };
  } catch { return null; }
}

// Decisão final: SEMPRE 2 provedores diferentes aprovando com nota mínima; 1 voto só nunca aprova.
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
      const v = lerVeredito(out && out.text);
      if (v) { usados.add(d.provider); return { ...v, provider: d.provider, model: d.model }; }
    } catch { /* cota ou erro: próximo modelo */ }
  }
  return null;
}

async function main() {
  if (process.env.REVISOR_GRATIS === '0') return console.log('REVISOR_GRATIS=0: desligado.');
  const token = process.env.GITHUB_TOKEN;
  const prs = (await gh(token, 'GET', '/pulls?state=open&base=develop&per_page=100')).json || [];
  const candidatos = escolher(prs);
  const { getRouter } = require('../nexia-ai/model-router');
  const { listFor } = require('../nexia-ai/orchestrator/models');
  const { TEXTO: LICOES } = require('../nexia-ai/orchestrator/licoes');
  const router = getRouter();
  const vistos = new Set();
  const lista = [...listFor('reasoning'), ...listFor('coding'), ...listFor('fast')]
    .filter(d => d.provider !== 'anthropic' && !vistos.has(`${d.provider}/${d.model}`) && vistos.add(`${d.provider}/${d.model}`));
  let feitos = 0;
  for (const pr of candidatos) {
    if (feitos >= MAX_POR_RODADA) break;
    const runs = ((await gh(token, 'GET', `/commits/${pr.head.sha}/check-runs?per_page=100`)).json || {}).check_runs || [];
    if (!ciVerde(runs)) continue;
    const comentarios = (await gh(token, 'GET', `/issues/${pr.number}/comments?per_page=100`)).json || [];
    if (comentarios.some(c => String(c.body || '').includes(MARCA(pr.head.sha)))) continue;
    feitos++;
    const arquivos = (await gh(token, 'GET', `/pulls/${pr.number}/files?per_page=100`)).json || [];
    const n = issueDoPr(pr);
    const tarefa = n ? ((await gh(token, 'GET', `/issues/${n}`)).json || {}).body || '' : '';
    const pare = barreira(arquivos, pr);
    let d;
    if (pare) d = { acao: 'recusar', voto: { motivo: pare, problemas: [], provider: 'regra', nota: 0 } };
    else {
      const conteudo = `${LICOES}\n\nTAREFA (issue #${n || '?'}):\n${String(tarefa).slice(0, 4000)}\n\nPR #${pr.number}: ${pr.title}\n${montarDiff(arquivos)}`;
      const usados = new Set();
      const v1 = await votar(router, lista, conteudo, usados);
      const v2 = v1 && v1.aprovar && v1.nota >= NOTA_MIN ? await votar(router, lista, conteudo, usados) : null;
      d = decidir([v1, v2]);
      d.votos = [v1, v2].filter(Boolean);
    }
    const quem = (d.votos || [d.voto]).filter(Boolean).map(v => `${v.provider}${v.model ? `/${v.model}` : ''} nota ${v.nota}`).join(', ');
    if (d.acao === 'aprovar') {
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['automerge'] });
      await gh(token, 'DELETE', `/issues/${pr.number}/labels/revisao-manual`);
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}🪜 Revisor grátis aprovou (${quem}). Entra sozinho com o CI verde.` });
      console.log(`PR #${pr.number}: aprovado (${quem}).`);
    } else if (d.acao === 'recusar') {
      const v = d.voto;
      const texto = `🪜 Revisor grátis recusou (${quem}): ${v.motivo}${v.problemas.length ? `\n${v.problemas.map(p => `- ${p}`).join('\n')}` : ''}`;
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['revisor-recusou'] });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `${MARCA(pr.head.sha)}${texto}\n\nA tarefa segue a escada (docs/ESCADA-IA.md).` });
      if (n) await gh(token, 'POST', `/issues/${n}/comments`, { body: `${texto}\n\nPR #${pr.number} recusado. Na próxima tentativa, corrija estes pontos.` });
      console.log(`PR #${pr.number}: recusado (${v.motivo}).`);
    } else console.log(`PR #${pr.number}: sem IA com cota agora; tenta na próxima rodada.`);
  }
  console.log(`${candidatos.length} PR(s) esperando revisão, ${feitos} revisado(s).`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { issueDoPr, ciVerde, escolher, barreira, montarDiff, lerVeredito, decidir, MARCA, NOTA_MIN };
