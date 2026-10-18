'use strict';
// Meu Cortex: o que já entrou na develop mas ainda não está no ar, e o botão "Publicar agora" (Deploy Cloudflare).
// Quem aperta o botão é o dono: é a autorização de publicar.

const REPO = 'gilcambe/nexia';
const FLUXO = '/repos/' + REPO + '/actions/workflows/deploy-cloudflare.yml';

async function situacao(gh) {
  const [ok, ultimos] = await Promise.all([
    gh(FLUXO + '/runs?status=success&branch=develop&per_page=1'),
    gh(FLUXO + '/runs?per_page=1&branch=develop'),
  ]);
  const feito = (ok.workflow_runs || [])[0];
  const agora = (ultimos.workflow_runs || [])[0];
  let mudancas = 0;
  let titulos = [];
  if (feito) {
    const c = await gh('/repos/' + REPO + '/compare/' + feito.head_sha + '...develop');
    mudancas = c.ahead_by || 0;
    titulos = (c.commits || []).slice(-5).reverse().map((x) => String((x.commit || {}).message || '').split('\n')[0].slice(0, 100));
  }
  return {
    mudancas, titulos,
    ultimoDeploy: feito ? { quando: feito.updated_at, link: feito.html_url } : null,
    emAndamento: !!agora && agora.status !== 'completed',
    falhou: !!agora && agora.status === 'completed' && agora.conclusion === 'failure',
  };
}

async function publicar(gh) {
  const s = await situacao(gh);
  if (s.emAndamento) return { status: 400, corpo: { error: 'Já tem uma publicação em andamento. Espere terminar.' } };
  await gh(FLUXO + '/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'develop', inputs: { confirm: 'DEPLOY' } }) });
  return { status: 200, corpo: { ok: true, mensagem: 'Publicação começou. Em uns 3 minutos o app novo está no ar.' } };
}

module.exports = { situacao, publicar };
