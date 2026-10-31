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
const ESPERA_GEMINI_H = 2;
const MAX_GEMINI_DIA = 5;
const IGNORAR = ['cortex-dividido', 'cortex-alerta', 'so-humano', 'vez-do-claude'];

// Decide o que fazer com as issues travadas (função pura, testada).
function decidir(issues, prs, agora, nomes, opts = {}) {
  const recusado = (p) => (p.labels || []).some(l => (l.name || l) === 'revisor-recusou');
  const prDe = (n) => prs.some(p => !recusado(p) && new RegExp(`#${n}(?!\\d)`).test(`${p.title || ''}\n${p.body || ''}`));
  const travadas = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-travado') && !nomes(i).some(n => IGNORAR.includes(n)));

  // Gemini CLI em andamento: se em 2 h não houver PR citando #N, sobe para vez-do-claude
  const geminiExpiradas = issues.filter(i => !i.pull_request && nomes(i).includes('gemini-cli') && !nomes(i).some(n => IGNORAR.includes(n))
    && !prDe(i.number) && (agora - Date.parse(i.updated_at || 0)) / 36e5 >= ESPERA_GEMINI_H);

  // Parte grande do plano do Cortex (rótulo cortex-jules, scripts/cortex-plano.js) vai antes das travadas: ela nem tentou na IA grátis.
  const planejada = issues.find(i => !i.pull_request && nomes(i).includes('cortex-jules') && !nomes(i).includes('jules-enviado') && !nomes(i).includes('gemini-cli') && !nomes(i).some(n => IGNORAR.includes(n)));
  const enviar = planejada || travadas.find(i => !nomes(i).includes('jules-enviado') && !nomes(i).includes('gemini-cli'));
  const voltar = travadas.filter(i => nomes(i).includes('jules-enviado') && !prDe(i.number)
    && (agora - Date.parse(i.updated_at || 0)) / 36e5 >= ESPERA_JULES_H);
  const segunda = voltar.filter(i => nomes(i).includes('cortex-retomada'));

  // #2387: quando a tarefa falhou (segunda volta sem entrega da reserva), ANTES de mandar para vez-do-claude,
  // tenta o Gemini CLI (rótulo gemini-cli) se ainda houver cota do dia (máx 5).
  // Se a tarefa já tentou no Gemini CLI e em 2 h não houver PR, aí sim vai para vez-do-claude (humano).
  const geminiHoje = opts.geminiHoje !== undefined ? opts.geminiHoje : issues.filter(i => nomes(i).includes('gemini-cli')).length;
  const candidatosClaude = segunda.filter(i => nomes(i).includes('reserva-tentou') && !nomes(i).includes('gemini-cli'));

  const geminiParaPromover = [];
  const humano = [...geminiExpiradas.map(i => i.number)];

  for (const c of candidatosClaude) {
    if (geminiHoje + geminiParaPromover.length < MAX_GEMINI_DIA) {
      geminiParaPromover.push(c.number);
    } else {
      humano.push(c.number);
    }
  }

  // Se Jules estiver sem cota (flag explícita ou retorno de API) e há candidata inicial sem envio
  let geminiEnviar = null;
  if (opts.julesSemCota && (geminiHoje + geminiParaPromover.length) < MAX_GEMINI_DIA) {
    const candidata = issues.find(i => !i.pull_request && (nomes(i).includes('cortex-travado') || nomes(i).includes('cortex-jules')) && !nomes(i).includes('gemini-cli') && !nomes(i).includes('jules-enviado') && !nomes(i).some(n => IGNORAR.includes(n)));
    if (candidata) geminiEnviar = candidata.number;
  }

  const geminiLista = [...geminiParaPromover, ...(geminiEnviar && !geminiParaPromover.includes(geminiEnviar) ? [geminiEnviar] : [])];

  const res = {
    enviar: opts.julesSemCota ? null : (enviar ? enviar.number : null),
    retomar: voltar.filter(i => !nomes(i).includes('cortex-retomada')).map(i => i.number),
    // #1958: antes do Claude, as IAs conectadas na Central tentam uma vez (rótulo reserva-tentou).
    reserva: segunda.filter(i => !nomes(i).includes('reserva-tentou')).map(i => i.number),
    humano: [...new Set(humano)],
  };
  if (geminiLista.length > 0 || opts.incluirGemini) res.gemini = geminiLista;
  return res;
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

  // Conta quantas issues foram despachadas para gemini-cli nas últimas 24h
  const inicioDoDia = at - 24 * 36e5;
  const geminiHoje = issues.filter(i => nomes(i).includes('gemini-cli') && Date.parse(i.updated_at || 0) >= inicioDoDia).length;

  const d = decidir(issues || [], prs || [], at, nomes, { geminiHoje });
  const out = { retomadas: [], reserva: [], humano: [] };
  if (d.gemini && d.gemini.length) out.gemini = [];
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
    await comentar(n, '🪜 Degrau 3: o Cortex e as IAs grátis tentaram e não entregaram. Vez do Claude, que faz só esta tarefa e devolve a fila ao Cortex (docs/ESCADA-IA.md).');
    out.humano.push(n);
  }

  const dispararGemini = async (n) => {
    await por(n, ['gemini-cli']);
    const r = await p.gh(`${REPO}/actions/workflows/gemini-ajudante.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'develop', inputs: { issue: String(n) } }) }).then(() => true).catch(() => false);
    await comentar(n, r
      ? '🪜 Degrau 2: Jules sem cota ou com limite excedido. Disparado Gemini CLI (workflow gemini-ajudante.yml). Se em 2 h não houver PR, vai para vez-do-claude.'
      : 'Não consegui disparar o Gemini CLI agora; tento de novo no próximo ciclo.');
    if (r) out.gemini.push(n);
  };

  for (const n of (d.gemini || [])) {
    await dispararGemini(n);
  }

  if (d.enviar) {
    const r = await mandarParaJules(p, d.enviar, 'o robô (automático, tarefa travada)', { env, fetchFn });
    Object.assign(out, { issue: d.enviar, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) });
    // Se o Jules recusou por cota/limite (ex: 429 ou 502 por limite diário), tenta Gemini CLI para a tarefa
    const gLen = (out.gemini || []).length;
    if ((r.status === 429 || r.status === 502) && (geminiHoje + gLen) < MAX_GEMINI_DIA) {
      if (!out.gemini || !out.gemini.includes(d.enviar)) {
        if (!out.gemini) out.gemini = [];
        await dispararGemini(d.enviar);
      }
    }
  } else if (!d.gemini || !d.gemini.length) out.enviados = 0;
  return out;
}

module.exports = { rodar, decidir, ESPERA_JULES_H, ESPERA_GEMINI_H, MAX_GEMINI_DIA };
