// Cortex nunca fica parado numa tarefa travada. Escada automática (a cada 15 min, cron do Worker):
//   1) o Cortex tenta até 12 vezes, dividindo a tarefa em partes no caminho (scripts/cortex-fila.js);
//   2) travou → vai sozinha para o Jules (Google, grátis: 15 por dia, 3 ao mesmo tempo), que abre o PR;
//   3) ESPERA_JULES_H sem PR aberto → volta para o Cortex do zero (rótulo cortex-retomada, tentativas zeradas);
//   4) travou de novo → Jules de novo; mesmo tempo sem PR outra vez → rótulo vez-do-claude (degrau 3 da docs/ESCADA-IA.md).
// PR recusado pelo revisor grátis (scripts/revisor-gratis.js, rótulo revisor-recusou) conta como "sem PR": a tarefa sobe de degrau.
// No máximo 2 envios ao Jules e 1 retomada por tarefa: nunca fica em laço nem repete rascunhos.
// Usa o mesmo envio do botão "Mandar para o Jules" do /meu-cortex. Desliga com JULES_AUTO=0.
const REPO = '/repos/gilcambe/nexia';
// Pedido do dono (25 e 26/10/2026): nada de horas esperando. 1 h dá para o Jules codar e testar uma tarefa pequena;
// passou disso, volta ao Cortex (pode ir ao Jules de novo depois).
const ESPERA_JULES_H = 1;
const IGNORAR = ['cortex-dividido', 'cortex-alerta', 'so-humano', 'vez-do-claude'];
const ROTULO_CLAUDE = 'vez-do-claude';
const COR_CLAUDE = '#d97706';

// Cria o rótulo vez-do-claude (cor #d97706) se ainda não existir.
async function garantirRotulo(p) {
  await p.gh(`${REPO}/labels`, { method: 'POST', body: JSON.stringify({ name: ROTULO_CLAUDE, color: COR_CLAUDE }) }).catch(() => null);
}

// Decide o que fazer com as issues travadas (função pura, testada).
function decidir(issues, prs, agora, nomes, enviadosHoje = 0) {
  const recusado = (p) => (p.labels || []).some(l => (l.name || l) === 'revisor-recusou');
  const prDe = (n) => prs.some(p => !recusado(p) && new RegExp(`#${n}(?!\\d)`).test(`${p.title || ''}\n${p.body || ''}`));
  const travadas = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-travado') && !nomes(i).some(n => IGNORAR.includes(n)));
  // Parte grande do plano do Cortex (rótulo cortex-jules, scripts/cortex-plano.js) vai antes das travadas: ela nem tentou na IA grátis.
  const planejada = issues.find(i => !i.pull_request && nomes(i).includes('cortex-jules') && !nomes(i).includes('jules-enviado') && !nomes(i).some(n => IGNORAR.includes(n)));
  
  // Conta envios reais do dia (issues com jules-enviado atualizadas desde 00:00 UTC)
  const inicioDia = new Date(agora);
  inicioDia.setUTCHours(0, 0, 0, 0);
  const enviadosHojeReais = issues.filter(i => 
    nomes(i).includes('jules-enviado') && 
    Date.parse(i.updated_at || 0) >= inicioDia.getTime()
  ).length;
  
  const totalHoje = Math.max(enviadosHoje, enviadosHojeReais);
  const cotaEsgotada = totalHoje >= 15;
  
  // Define o que enviar para o Jules (se a cota não estiver esgotada)
  let enviarParaJules = planejada || travadas.find(i => !nomes(i).includes('jules-enviado'));
  if (cotaEsgotada && enviarParaJules) {
    // Se a cota estiver esgotada, não envia, mas marca como vez-do-claude
    enviarParaJules = null;
  }
  
  // Issues que voltaram do Jules e vão para vez-do-claude
  const voltar = travadas.filter(i => nomes(i).includes('jules-enviado') && !prDe(i.number)
    && (agora - Date.parse(i.updated_at || 0)) / 36e5 >= ESPERA_JULES_H);
  
  // Issues que vão para vez-do-claude (já voltaram do Jules ou cota esgotada)
  const claude = [];
  
  // Item 1: travadas que já voltaram do Jules (têm cortex-retomada), sem PR → vez-do-claude
  voltar.filter(i => nomes(i).includes('cortex-retomada')).forEach(i => {
    claude.push(i.number);
  });
  
  // Item 2: se cota esgotada, a travada sem jules-enviado vai para vez-do-claude
  if (cotaEsgotada && enviarParaJules === null) {
    travadas.filter(i => !nomes(i).includes('jules-enviado')).forEach(i => {
      claude.push(i.number);
    });
  }
  
  // Issues que o Claude deve devolver ao degrau 2 (se não estiver trabalhando e sem PR)
  const devolver = [];
  const issuesVezDoClaude = issues.filter(i => nomes(i).includes('vez-do-claude') && !nomes(i).includes('claude-trabalhando'));
  
  issuesVezDoClaude.forEach(i => {
    if (!prDe(i.number) && !cotaEsgotada) {
      // Se não tem PR e a cota não está esgotada, devolve ao degrau 2
      devolver.push(i.number);
    }
  });
  
  return {
    enviar: enviarParaJules ? enviarParaJules.number : null,
    retomar: voltar.filter(i => !nomes(i).includes('cortex-retomada')).map(i => i.number),
    humano: voltar.filter(i => nomes(i).includes('cortex-retomada')).map(i => i.number),
    claude: claude,
    devolver: devolver,
    enviadosHoje: totalHoje
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
  await garantirRotulo(p);
  const travadas = await p.gh(`${REPO}/issues?state=open&labels=cortex-travado&per_page=100&sort=created&direction=asc`);
  const planejadas = await p.gh(`${REPO}/issues?state=open&labels=cortex-jules&per_page=50&sort=created&direction=asc`).catch(() => []);
  const pl = Array.isArray(planejadas) ? planejadas : [];
  const issues = [...pl, ...(Array.isArray(travadas) ? travadas : []).filter(t => !pl.some(x => x.number === t.number))];
  const prs = await p.gh(`${REPO}/pulls?state=open&per_page=100`);
  const d = decidir(issues || [], prs || [], at, nomes);
  const out = { retomadas: [], humano: [], claude: [], devolver: [] };
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
    await por(n, ['vez-do-claude']);
    await comentar(n, `🪜 Degrau 3: o Cortex e as IAs grátis (Jules) tentaram 2 vezes cada e não entregaram. Vez do Claude, que faz só esta tarefa e devolve a fila ao Cortex (docs/ESCADA-IA.md). (Jules hoje: ${d.enviadosHoje}/15)`);
    out.humano.push(n);
  }
  for (const n of d.claude) {
    const i = issues.find(x => x.number === n);
    await por(n, ['vez-do-claude']);
    await comentar(n, `🪜 Degrau 3: cota do Jules do dia esgotada (${d.enviadosHoje}/15) ou tarefa já voltou do Jules 2 vezes. Vez do Claude Code, que faz só esta tarefa e se retira (docs/ESCADA-IA.md).`);
    out.claude.push(n);
  }
  for (const n of d.devolver) {
    const i = issues.find(x => x.number === n);
    for (const l of ['vez-do-claude', 'cortex-travado', 'jules-enviado', 'cortex-retomada']) {
      if (nomes(i).includes(l)) await tirar(n, l);
    }
    await por(n, ['cortex-travado']);
    await comentar(n, `🪜 Degrau 2: o Claude se retirou e a cota grátis voltou (${d.enviadosHoje}/15). A tarefa volta ao Cortex do zero para o Jules pegar na próxima batida.`);
    out.devolver.push(n);
  }
  if (d.enviar) {
    const r = await mandarParaJules(p, d.enviar, 'o robô (automático, tarefa travada)', { env, fetchFn });
    Object.assign(out, { issue: d.enviar, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) });
  } else out.enviados = 0;
  return out;
}

module.exports = { rodar, decidir, ESPERA_JULES_H };
