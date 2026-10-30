// Cortex nunca fica parado numa tarefa travada. Escada automática (a cada 15 min, cron do Worker):
//   1) o Cortex tenta até 12 vezes, dividindo a tarefa em partes no caminho (scripts/cortex-fila.js);
//   2) travou → vai sozinha para o Jules (Google, grátis: 15 por dia, 3 ao mesmo tempo), que abre o PR;
//   3) ESPERA_JULES_H sem PR aberto → volta para o Cortex do zero (rótulo cortex-retomada, tentativas zeradas);
//   4) travou de novo → Jules de novo; mesmo tempo sem PR outra vez → as IAs conectadas na Central (vagas, cortex-reserva.yml);
//   5) a reserva também não entregou no mesmo tempo → rótulo vez-do-claude (degrau 3 da docs/ESCADA-IA.md).
// PR recusado pelo revisor grátis (scripts/revisor-gratis.js, rótulo revisor-recusou) conta como "sem PR": a tarefa sobe de degrau.
// No máximo 2 envios ao Jules e 1 retomada por tarefa: nunca fica em laço nem repete rascunhos.
// Usa o mesmo envio do botão "Mandar para o Jules" do /meu-cortex. Desliga com JULES_AUTO=0.
const REPO = '/repos/gilcambe/nexia';
// Pedido do dono (25 e 26/10/2026): nada de horas esperando. 1 h dá para o Jules codar e testar uma tarefa pequena;
// passou disso, volta ao Cortex (pode ir ao Jules de novo depois).
const ESPERA_JULES_H = 1;
const IGNORAR = ['cortex-dividido', 'cortex-alerta', 'so-humano', 'vez-do-claude'];
const MAX_JULES_PARALLEL = 3;       // máximo de tarefas do Jules rodando ao mesmo tempo
const JULES_PRIORITY_WAIT = 30 * 60 * 1000;  // tempo de espera para tarefas de prioridade (30 min)
const JULES_NOTIFICATION_EMAIL = 'MASTER_EMAIL'; // email do dono para notificações
const JULES_CI_PROOF_ENABLED = true;          // habilitar prova de CI na conclusão
const JULES_MAX_RETRIES = 2;                 // máximo de tentativas do Jules por tarefa

// Função para verificar se uma tarefa está na fila do Jules
function isJulesQueue(issue) {
  return (issue.labels || []).some(l => (l.name || l) === 'cortex-jules');
}

// Função para verificar se uma tarefa tem prioridade
function isPrioritaria(issue) {
  return isJulesQueue(issue) && (issue.labels || []).some(l => (l.name || l) === 'cortex-prioritaria');
}

// Função para verificar se uma tarefa já está com o máximo de tentativas
function maxTentativas(issue) {
  const tentativas = (issue.labels || []).filter(l => /^(tentativa)-\d+$/.test(l.name || l)).length;
  return tentativas >= JULES_MAX_RETRIES;
}

// Decide o que fazer com as issues travadas (função pura, testada).
function decidir(issues, prs, agora, nomes) {
  const recusado = (p) => (p.labels || []).some(l => (l.name || l) === 'revisor-recusou');
  const prDe = (n) => prs.some(p => !recusado(p) && new RegExp(`#${n}(?!\\d)`).test(`${p.title || ''}\n${p.body || ''}`));
  const travadas = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-travado') && !nomes(i).some(n => IGNORAR.includes(n)));
  // Prioridade: tarefas cortex-jules vão primeiro, mesmo que travadas.
  const planejadas = issues.filter(i => !i.pull_request && isJulesQueue(i) && !nomes(i).includes('jules-enviado') && !nomes(i).some(n => IGNORAR.includes(n)));
  const planejadaPrioritaria = planejadas.find(i => isPrioritaria(i));
  const planejadaNormal = planejadas.find(i => !isPrioritaria(i) && !planejadaPrioritaria);
  const planejada = planejadaPrioritaria || planejadaNormal;
  // Se já há MAX_JULES_PARALLEL tarefas rodando, só retomar as travadas.
  const rodando = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-rodando') && !nomes(i).some(n => IGNORAR.includes(n)));
  const limiteCheio = rodando.length >= MAX_JULES_PARALLEL;
  const enviar = limiteCheio ? null : (planejada || travadas.find(i => !nomes(i).includes('jules-enviado')));
  const voltar = travadas.filter(i => nomes(i).includes('jules-enviado') && !prDe(i.number)
    && (agora - Date.parse(i.updated_at || 0)) / 36e5 >= ESPERA_JULES_H);
  const segunda = voltar.filter(i => nomes(i).includes('cortex-retomada'));
  return {
    enviar: enviar ? enviar.number : null,
    retomar: voltar.filter(i => !nomes(i).includes('cortex-retomada')).map(i => i.number),
    // #1958: antes do Claude, as IAs conectadas na Central tentam uma vez (rótulo reserva-tentou).
    reserva: segunda.filter(i => !nomes(i).includes('reserva-tentou')).map(i => i.number),
    humano: segunda.filter(i => nomes(i).includes('reserva-tentou')).map(i => i.number),
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
  // Filtrar por prioridade e limite paralelo
  const planejadasPrioritarias = pl.filter(i => isPrioritaria(i));
  const planejadasNormais = pl.filter(i => !isPrioritaria(i) && !planejadasPrioritarias.includes(i));
  const planejadasOrdenadas = [...planejadasPrioritarias, ...planejadasNormais];
  const issuesComPrioridade = issues.filter(i => isJulesQueue(i) && !nomes(i).includes('jules-enviado'));
  const issuesPrioritarias = issuesComPrioridade.filter(i => isPrioritaria(i));
  const issuesNormais = issuesComPrioridade.filter(i => !isPrioritaria(i) && !issuesPrioritarias.includes(i));
  // Adicionar tarefas travadas
  const issuesComPrioridadeETravadas = [...issuesPrioritarias, ...issuesNormais, ...(Array.isArray(travadas) ? travadas : []).filter(t => !issuesComPrioridade.some(x => x.number === t.number))];
  const prs = await p.gh(`${REPO}/pulls?state=open&per_page=100`);
  const d = decidir(issues || [], prs || [], at, nomes);
  const out = { retomadas: [], reserva: [], humano: [] };
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
  for (const n of d.reserva) {
    await por(n, ['reserva-tentou']);
    const r = await p.gh(`${REPO}/actions/workflows/cortex-reserva.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'develop', inputs: { numero: String(n) } }) }).then(() => true).catch(() => false);
    await comentar(n, r
      ? '🔌 O Jules não entregou de novo. Agora tentam as IAs conectadas na Central (Conectar IAs, vagas 1 a 10) pelo robô Cortex Reserva. Se elas também não entregarem, é a vez do Claude.'
      : 'Não consegui ligar o robô Cortex Reserva agora; tento de novo no próximo ciclo.');
    if (r) out.reserva.push(n);
  }
  for (const n of d.humano) {
    await por(n, ['vez-do-claude']);
    await comentar(n, '🪜 Degrau 3: o Cortex e as IAs grátis (Jules) tentaram 2 vezes cada e não entregaram. Vez do Claude, que faz só esta tarefa e devolve a fila ao Cortex (docs/ESCADA-IA.md).');
    out.humano.push(n);
  }
  if (d.enviar) {
    const i = issues.find(x => x.number === d.enviar);
    if (isPrioritaria(i)) {
      // Tarefa prioritária: marcar como cortex-rodando
      await por(d.enviar, ['cortex-rodando']);
    }
    const r = await mandarParaJules(p, d.enviar, 'o robô (automático, tarefa travada)', { env, fetchFn });
    Object.assign(out, { issue: d.enviar, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) });
    // Marcar conclusão com prova de CI se habilitado
    if (r.status === 200 && JULES_CI_PROOF_ENABLED) {
      const checkRuns = await p.gh(`${REPO}/commits/${r.corpo.link.split('/')[5]}/check-runs`).catch(() => []);
      const passouCI = Array.isArray(checkRuns) && checkRuns.some(cr => cr.conclusion === 'success');
      if (passouCI) {
        await por(d.enviar, ['cortex-feito', 'cortex-ci-proof']);
        // Notificar o dono
        await comentar(d.enviar, `✅ Tarefa concluída com sucesso! Prova de CI: passou.\n${JULES_NOTIFICATION_EMAIL}`);
      } else {
        await por(d.enviar, ['cortex-feito']);
        await comentar(d.enviar, `⚠️ Tarefa concluída, mas a prova de CI falhou.\n${JULES_NOTIFICATION_EMAIL}`);
      }
    } else if (r.status === 200) {
      await por(d.enviar, ['cortex-feito']);
    }
  } else out.enviados = 0;
  return out;
}

module.exports = { rodar, decidir, ESPERA_JULES_H };
