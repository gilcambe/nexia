// Cortex nunca fica parado numa tarefa travada. Escada automática (a cada 15 min, cron do Worker):
//   1) o Cortex tenta até 12 vezes, dividindo a tarefa em partes no caminho (scripts/cortex-fila.js);
//   2) travou → vai sozinha para o Jules (Google, grátis: 15 por dia, 3 ao mesmo tempo), que abre o PR;
//   3) ESPERA_JULES_H sem PR aberto → volta para o Cortex do zero (rótulo cortex-retomada, tentativas zeradas);
//   4) travou de novo → Jules de novo; mesmo tempo sem PR outra vez → rótulo so-humano + comentário (o vigia avisa no celular).
// No máximo 2 envios ao Jules e 1 retomada por tarefa: nunca fica em laço nem repete rascunhos.
// Usa o mesmo envio do botão "Mandar para o Jules" do /meu-cortex. Desliga com JULES_AUTO=0.
const REPO = '/repos/gilcambe/nexia';
// Pedido do dono (25/10/2026): nada de horas esperando. 2 h já dá tempo real para o Jules codar e testar
// uma tarefa pequena; passou disso, volta ao Cortex (pode ir ao Jules de novo depois).
const ESPERA_JULES_H = 2;
const IGNORAR = ['cortex-dividido', 'cortex-alerta', 'so-humano'];

// Decide o que fazer com as issues travadas (função pura, testada).
function decidir(issues, prs, agora, nomes) {
  const prDe = (n) => prs.some(p => new RegExp(`#${n}(?!\\d)`).test(`${p.title || ''}\n${p.body || ''}`));
  const travadas = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-travado') && !nomes(i).some(n => IGNORAR.includes(n)));
  // Parte grande do plano do Cortex (rótulo cortex-jules, scripts/cortex-plano.js) vai antes das travadas: ela nem tentou na IA grátis.
  const planejada = issues.find(i => !i.pull_request && nomes(i).includes('cortex-jules') && !nomes(i).includes('jules-enviado') && !nomes(i).some(n => IGNORAR.includes(n)));
  const enviar = planejada || travadas.find(i => !nomes(i).includes('jules-enviado'));
  const voltar = travadas.filter(i => nomes(i).includes('jules-enviado') && !prDe(i.number)
    && (agora - Date.parse(i.updated_at || 0)) / 36e5 >= ESPERA_JULES_H);
  return {
    enviar: enviar ? enviar.number : null,
    retomar: voltar.filter(i => !nomes(i).includes('cortex-retomada')).map(i => i.number),
    humano: voltar.filter(i => nomes(i).includes('cortex-retomada')).map(i => i.number),
  };
}

async function rodar(at, { env = process.env, fetchFn = fetch } = {}) {
  if (new Date(at).getUTCMinutes() % 15 >= 5) return { skipped: 'fora da batida de 15 min' };
  if (env.JULES_AUTO === '0') return { skipped: 'JULES_AUTO=0' };
  if (!env.JULES_API_KEY && !env.JULES_API_KEY1) return { skipped: 'sem chave do Jules' };
  const { criarPedidos, nomes } = require('../netlify/functions/central/pedidos-gh.js');
  const { mandarParaJules } = require('../netlify/functions/central/pedidos-jules.js');
  const p = criarPedidos(env, fetchFn);
  if (!p.temToken) return { skipped: 'sem token do GitHub' };
  const travadas = await p.gh(`${REPO}/issues?state=open&labels=cortex-travado&per_page=100&sort=created&direction=asc`);
  const planejadas = await p.gh(`${REPO}/issues?state=open&labels=cortex-jules&per_page=50&sort=created&direction=asc`).catch(() => []);
  const pl = Array.isArray(planejadas) ? planejadas : [];
  const issues = [...pl, ...(Array.isArray(travadas) ? travadas : []).filter(t => !pl.some(x => x.number === t.number))];
  const prs = await p.gh(`${REPO}/pulls?state=open&per_page=100`);
  const d = decidir(issues || [], prs || [], at, nomes);
  const out = { retomadas: [], humano: [] };
  const tirar = (n, l) => p.gh(`${REPO}/issues/${n}/labels/${encodeURIComponent(l)}`, { method: 'DELETE' }).catch(() => null);
  const por = (n, ls) => p.gh(`${REPO}/issues/${n}/labels`, { method: 'POST', body: JSON.stringify({ labels: ls }) }).catch(() => null);
  const comentar = (n, body) => p.gh(`${REPO}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body }) }).catch(() => null);

  for (const n of d.retomar) {
    const i = issues.find(x => x.number === n);
    for (const l of nomes(i).filter(l => l === 'cortex-travado' || l === 'jules-enviado' || l === 'cortex-rodando' || /^(tentativa|sem-entrega|pista)-\d+$/.test(l))) await tirar(n, l);
    await por(n, ['cortex-retomada']);
    await comentar(n, `O Jules não abriu PR em ${ESPERA_JULES_H} h. A tarefa voltou para o Cortex do zero (agora ele lê arquivos grandes em partes). Se travar de novo, vai outra vez para o Jules.`);
    out.retomadas.push(n);
  }
  for (const n of d.humano) {
    await por(n, ['so-humano']);
    await comentar(n, 'O Cortex e o Jules tentaram 2 vezes cada e não entregaram. Precisa de você: abra o /meu-cortex e mande um pedido menor, ou peça para a Claude fazer esta tarefa.');
    out.humano.push(n);
  }
  if (d.enviar) {
    const r = await mandarParaJules(p, d.enviar, 'o robô (automático, tarefa travada)', { env, fetchFn });
    Object.assign(out, { issue: d.enviar, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) });
  } else out.enviados = 0;
  return out;
}

module.exports = { rodar, decidir, ESPERA_JULES_H };
