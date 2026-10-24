// Cortex → Jules sem esperar ninguém: de hora em hora, a 1ª tarefa travada (cortex-travado) ainda não enviada
// vai sozinha para o Jules (Google, grátis: 15 por dia, 3 ao mesmo tempo), que abre o PR sem automerge.
// Usa o mesmo envio do botão "Mandar para o Jules" do /meu-cortex. Desliga com JULES_AUTO=0.
// Só 1 por hora: fica abaixo das 15 por dia e não ocupa as 3 vagas do plano grátis de uma vez.
async function rodar(at, { env = process.env, fetchFn = fetch } = {}) {
  const m = new Date(at).getUTCMinutes();
  if (m < 20 || m >= 25) return { skipped: 'fora da batida das :20' };
  if (env.JULES_AUTO === '0') return { skipped: 'JULES_AUTO=0' };
  if (!env.JULES_API_KEY && !env.JULES_API_KEY1) return { skipped: 'sem chave do Jules' };
  const { criarPedidos, nomes } = require('../netlify/functions/central/pedidos-gh.js');
  const { mandarParaJules } = require('../netlify/functions/central/pedidos-jules.js');
  const p = criarPedidos(env, fetchFn);
  if (!p.temToken) return { skipped: 'sem token do GitHub' };
  const lista = await p.gh('/repos/gilcambe/nexia/issues?state=open&labels=cortex-travado&per_page=50&sort=created&direction=asc');
  const alvo = (lista || []).find(i => !i.pull_request && !nomes(i).some(n => ['jules-enviado', 'cortex-dividido', 'cortex-alerta', 'so-humano'].includes(n)));
  if (!alvo) return { enviados: 0 };
  const r = await mandarParaJules(p, alvo.number, 'o robô (automático, tarefa travada)', { env, fetchFn });
  return { issue: alvo.number, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) };
}

module.exports = { rodar };
