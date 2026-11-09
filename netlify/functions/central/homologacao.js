'use strict';
// Central (#3269): tela Homologação. Lê o check-run "Homologação — resultado" do último CI da develop
// (gravado por scripts/homologacao/publicar-check.js) e o status do portão do repo privado GSD Lab.
// Só dados verdadeiros: sem resultado = "nunca rodou"; sem acesso = "sem acesso".
const REPO = 'gilcambe/nexia';
const PRIVADO = 'gilcambe/avaya-gsd';

async function ultimoCi(gh) {
  const r = await gh('/repos/' + REPO + '/actions/workflows/ci.yml/runs?branch=develop&per_page=10');
  const runs = (r && r.workflow_runs) || [];
  return { feito: runs.find((x) => x.status === 'completed') || null, rodando: runs.find((x) => x.status !== 'completed') || null };
}

async function carregar(gh) {
  const { feito, rodando } = await ultimoCi(gh);
  let resultado = null; let link = feito ? feito.html_url : null;
  if (feito) {
    const c = await gh('/repos/' + REPO + '/commits/' + feito.head_sha + '/check-runs?check_name=' + encodeURIComponent('Homologação — resultado')).catch(() => null);
    const run = c && (c.check_runs || [])[0];
    if (run && run.output && run.output.text) { try { resultado = JSON.parse(run.output.text); link = run.html_url || link; } catch { resultado = null; } }
  }
  let privado = { status: 'sem-acesso', quando: null, link: null };
  try {
    const p = await gh('/repos/' + PRIVADO + '/actions/workflows/homologacao.yml/runs?per_page=5');
    const ult = ((p && p.workflow_runs) || []).find((x) => x.status === 'completed');
    privado = ult ? { status: ult.conclusion === 'success' ? 'verde' : 'vermelho', quando: ult.updated_at, link: ult.html_url } : { status: 'nunca', quando: null, link: null };
  } catch { /* token sem acesso ao repo privado: mostra "sem acesso", nunca inventa */ }
  return {
    aprovado: resultado ? !!resultado.aprovado : null,
    produtos: resultado ? resultado.produtos : {},
    quando: resultado ? resultado.quando : null,
    commit: feito ? feito.head_sha : null,
    rodandoAgora: !!rodando,
    link,
    gsdLab: privado,
    conferidoEm: new Date().toISOString(),
    origem: 'check "Homologação — resultado" do último CI da develop (GitHub)',
  };
}

async function rodar(gh) {
  await gh('/repos/' + REPO + '/actions/workflows/ci.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'develop' }) });
  let gsd = false;
  try { await gh('/repos/' + PRIVADO + '/actions/workflows/homologacao.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) }); gsd = true; } catch { /* sem acesso */ }
  return { ok: true, mensagem: 'Mandei homologar tudo' + (gsd ? ' (inclusive o GSD Lab)' : '') + '. Leva uns 10 minutos; o resultado aparece aqui.' };
}

module.exports = { carregar, rodar, REPO, PRIVADO };
