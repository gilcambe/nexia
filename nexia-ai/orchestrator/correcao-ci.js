'use strict';
// #828 (Melhoria C10): quando o CI do PR do Cortex falha, a fila manda o pedido de novo com as últimas
// 80 linhas do erro (até 2 vezes) antes de pedir ajuda. O pedido vem com a marca abaixo: o Orchestrator
// separa o erro do pedido, então a branch e o PR continuam os mesmos (o nome da branch vem do pedido).
const MARCA = '\n\n<<<CORRECAO-CI>>>\n';
const LINHAS = 60;
const MAX_CORRECOES = 2;
const CHECK_CI = 'Typecheck, testes e build';

/** "pedido + MARCA + erro" → { pedido, erro }. Sem marca, erro = ''. */
function separarCi(texto) {
  const s = String(texto || '');
  const i = s.indexOf(MARCA);
  return i < 0 ? { pedido: s.trim(), erro: '' } : { pedido: s.slice(0, i).trim(), erro: s.slice(i + MARCA.length).trim() };
}

/** Últimas N linhas úteis do log do Actions (sem o carimbo de hora nem cores ANSI). */
function ultimasLinhas(log, n = LINHAS) {
  const linhas = String(log || '').split(/\r?\n/)
    .map(l => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, '').replace(/\x1b\[[0-9;]*m/g, '').trimEnd())
    .filter(l => l && !/^##\[(group|endgroup)\]/.test(l) && !/^Post job cleanup|^Cleaning up orphan/.test(l));
  return linhas.slice(-n).join('\n');
}

/** Texto que vai para o modelo na rodada de correção. */
const feedbackCi = (erro, rodada) => `conserte o CI deste PR; não abra PR novo (correção ${rodada} de ${MAX_CORRECOES}). Leia o erro, ache a causa e corrija no MESMO ramo, com um novo commit. Últimas linhas do log do CI:\n${erro}`;

/** Pedido do PR aberto pelo NEXIA AI ("Pedido: ...\n\nExecution: ..."). */
function pedidoDoPr(body) {
  const m = /^Pedido: ([\s\S]*?)\n\nExecution:/.exec(String(body || ''));
  return m ? separarCi(m[1]).pedido : '';
}

const MARCA_COMENTARIO = /<!-- cortex-ci sha=([0-9a-f]{7,40}) n=(\d+) -->/g;
/** Correções já pedidas neste PR (lidas dos comentários da fila): { n, shas }. */
function correcoesFeitas(comentarios) {
  const shas = new Set();
  let n = 0;
  for (const c of comentarios || []) for (const m of String(c.body || '').matchAll(MARCA_COMENTARIO)) { shas.add(m[1]); n = Math.max(n, Number(m[2])); }
  return { n, shas };
}

/**
 * Decide o que fazer com um PR do Cortex cujo CI falhou.
 * @returns {{ tipo: 'corrigir', rodada } | { tipo: 'ajuda' } | { tipo: 'esperar' } | null}
 */
function decidirCorrecao({ pr, checks, comentarios }) {
  if (!pr || !/^nexia\//.test((pr.head || {}).ref || '') || pr.state === 'closed') return null;
  const ci = (checks || []).filter(c => c.name === CHECK_CI);
  if (!ci.length || ci.some(c => c.status !== 'completed') || !ci.some(c => c.conclusion === 'failure')) return null;
  const sha = String((pr.head || {}).sha || '');
  const { n, shas } = correcoesFeitas(comentarios);
  if ([...shas].some(s => sha.startsWith(s))) return { tipo: 'esperar' };   // já pedimos correção deste commit
  if (n >= MAX_CORRECOES) {
    const agora = Date.now();
    const criadoEm = Date.parse((pr || {}).created_at || 0);
    const m = /#(\d+)/.exec(String((pr || {}).body || ''));
    const issueNum = m ? Number(m[1]) : null;
    if (agora - criadoEm >= 24 * 3600e3) {
      return { tipo: 'fechar', issueNum };
    }
    return /cortex-ajuda-ci/.test(JSON.stringify(comentarios || [])) ? null : { tipo: 'ajuda' };
  }
  return { tipo: 'corrigir', rodada: n + 1 };
}

const comentarioCi = (sha, n) => `<!-- cortex-ci sha=${String(sha).slice(0, 12)} n=${n} -->`;

module.exports = { MARCA, LINHAS, MAX_CORRECOES, CHECK_CI, separarCi, ultimasLinhas, feedbackCi, pedidoDoPr, correcoesFeitas, decidirCorrecao, comentarioCi };
