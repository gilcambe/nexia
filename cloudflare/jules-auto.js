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
// Pedido do dono (07/11): repositórios PRIVADOS de outros produtos com issues cortex-fila próprias. O código deles
// não pode vir para este repo público, então o Jules trabalha direto lá (base main). 1 envio por repo a cada 15 min.
const reposExtras = (env) => String(env.JULES_REPOS_EXTRA == null ? 'gilcambe/avaya-gsd' : env.JULES_REPOS_EXTRA)
  .split(',').map(s => s.trim()).filter(s => /^[\w.-]+\/[\w.-]+$/.test(s));

// Próxima issue do repo extra: cortex-fila aberta, sem jules-enviado e sem PR aberto que cite #N (função pura, testada).
function proximaExtra(issues, prs, nomes) {
  const prDe = (n) => prs.some(p => new RegExp(`#${n}(?!\\d)`).test(`${p.title || ''}\n${p.body || ''}`));
  const i = (issues || []).filter(x => !x.pull_request && nomes(x).includes('cortex-fila') && !nomes(x).includes('jules-enviado') && !prDe(x.number))
    .sort((a, b) => a.number - b.number)[0];
  return i ? i.number : null;
}

async function rodarExtras(p, env, fetchFn, nomes, mandarParaJules) {
  const out = [];
  for (const repo of reposExtras(env)) {
    try {
      const issues = await p.gh(`/repos/${repo}/issues?state=open&labels=cortex-fila&per_page=20`);
      const prs = await p.gh(`/repos/${repo}/pulls?state=open&per_page=50`);
      const n = proximaExtra(Array.isArray(issues) ? issues : [], Array.isArray(prs) ? prs : [], nomes);
      if (!n) { out.push({ repo, enviados: 0 }); continue; }
      const r = await mandarParaJules(p, n, 'o robô (automático, repo privado)', { env, fetchFn, repo, base: 'main' });
      if (r.status !== 200) console.warn(`[jules-auto] ${repo}#${n}: ${r.corpo.error || r.status}` + (/40[34]/.test(String(r.corpo.error)) ? ' (o Jules ainda não tem acesso a esse repositório?)' : ''));
      out.push({ repo, issue: n, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) });
    } catch (e) {
      console.warn(`[jules-auto] ${repo}: a chave do GitHub não vê esse repositório ou ele falhou:`, e && e.message);
      out.push({ repo, erro: String(e && e.message || e).slice(0, 200) });
    }
  }
  return out;
}

// Vigia (regra do dono 08/11): nenhuma travada fica parada sem IA. Até MAX_ENVIOS ao Jules por batida (limite dele: 3 ao mesmo tempo).
// Lição 08/11: antes ia 1 por batida e a parte planejada (cortex-jules) passava na frente; com 31 planejadas, as travadas nunca chegavam ao Jules.
const MAX_ENVIOS = 3;
// Interruptor do degrau 3 (issue ABERTA = Claude ligado). Desligado: vez-do-claude não pode virar beco sem saída.
const INTERRUPTOR_CLAUDE = 2036;
const MAX_VOLTAS_VIGIA = 2;
const PARADA_MIN = 15;
const mexeEmWorkflow = (i) => /\.github\/workflows\//.test(`${i.title || ''}\n${i.body || ''}`);

// Decide o que fazer com as issues travadas (função pura, testada).
function decidir(issues, prs, agora, nomes, { claudeLigado = true, vezDoClaude = [] } = {}) {
  const recusado = (p) => (p.labels || []).some(l => (l.name || l) === 'revisor-recusou');
  const prDe = (n) => prs.some(p => !recusado(p) && new RegExp(`#${n}(?!\\d)`).test(`${p.title || ''}\n${p.body || ''}`));
  const travadas = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-travado') && !nomes(i).some(n => IGNORAR.includes(n)));
  const planejadas = issues.filter(i => !i.pull_request && nomes(i).includes('cortex-jules') && !nomes(i).includes('jules-enviado') && !nomes(i).some(n => IGNORAR.includes(n)));
  // Travada primeiro (já falhou no Cortex), depois a parte grande do plano; sem repetir número.
  const lista = [...travadas.filter(i => !nomes(i).includes('jules-enviado')), ...planejadas]
    .filter((i, k, a) => a.findIndex(x => x.number === i.number) === k).slice(0, MAX_ENVIOS).map(i => i.number);
  const voltar = travadas.filter(i => nomes(i).includes('jules-enviado') && !prDe(i.number)
    && (agora - Date.parse(i.updated_at || 0)) / 36e5 >= ESPERA_JULES_H);
  const segunda = voltar.filter(i => nomes(i).includes('cortex-retomada'));
  const humano = segunda.filter(i => nomes(i).includes('reserva-tentou'));
  // Claude desligado: em vez de esperar para sempre, volta ao Cortex do zero (dividida de novo) até MAX_VOLTAS_VIGIA vezes;
  // depois disso, ou se mexe em workflow (o Cortex não pode), vai para "Precisa de você" com o motivo.
  const revolta = [], precisa = [];
  if (!claudeLigado) {
    const parada = (i) => (agora - Date.parse(i.updated_at || 0)) / 6e4 >= PARADA_MIN;
    for (const i of [...humano, ...vezDoClaude.filter(x => !x.pull_request && parada(x) && !prDe(x.number))]) {
      if (revolta.includes(i.number) || precisa.includes(i.number)) continue;
      const voltas = nomes(i).filter(n => /^vigia-volta-\d+$/.test(n)).length;
      if (mexeEmWorkflow(i) || voltas >= MAX_VOLTAS_VIGIA) precisa.push(i.number); else revolta.push(i.number);
    }
  }
  return {
    enviar: lista[0] || null,
    enviarLista: lista,
    retomar: voltar.filter(i => !nomes(i).includes('cortex-retomada')).map(i => i.number),
    // #1958: antes do Claude, as IAs conectadas na Central tentam uma vez (rótulo reserva-tentou).
    reserva: segunda.filter(i => !nomes(i).includes('reserva-tentou')).map(i => i.number),
    humano: claudeLigado ? humano.map(i => i.number) : [],
    revolta,
    precisa,
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
  const chave = await p.gh(`${REPO}/issues/${INTERRUPTOR_CLAUDE}`).catch(() => null);
  const claudeLigado = !!(chave && chave.state === 'open');
  const vez = claudeLigado ? [] : await p.gh(`${REPO}/issues?state=open&labels=vez-do-claude&per_page=50&sort=updated&direction=asc`).catch(() => []);
  const d = decidir(issues || [], prs || [], at, nomes, { claudeLigado, vezDoClaude: Array.isArray(vez) ? vez : [] });
  const out = { retomadas: [], reserva: [], humano: [], revolta: [], precisa: [] };
  const todas = [...(issues || []), ...(Array.isArray(vez) ? vez : [])];
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
  for (const n of d.revolta) {
    const i = todas.find(x => x.number === n);
    const ls = nomes(i);
    for (const l of ls.filter(l => ['cortex-travado', 'jules-enviado', 'cortex-rodando', 'vez-do-claude', 'reserva-tentou', 'cortex-retomada', 'cortex-jules'].includes(l) || /^(tentativa|sem-entrega|pista)-\d+$/.test(l))) await tirar(n, l);
    const k = ls.filter(l => /^vigia-volta-\d+$/.test(l)).length + 1;
    await por(n, ['cortex-fila', 'cortex-retomada', `vigia-volta-${k}`]);
    await comentar(n, `🛟 Vigia: travada há mais de ${PARADA_MIN} min e o Claude está desligado. Voltou ao Cortex do zero (volta ${k}/${MAX_VOLTAS_VIGIA}), com outra IA e dividida em partes menores se precisar. Lição: Cortex, Jules e IAs da Central já tentaram; o motivo da última falha está no comentário anterior.`);
    out.revolta.push(n);
  }
  for (const n of d.precisa) {
    const i = todas.find(x => x.number === n);
    await por(n, ['precisa-de-voce']);
    await tirar(n, 'vez-do-claude');
    await comentar(n, mexeEmWorkflow(i)
      ? '🙋 Precisa de você: esta tarefa mexe em `.github/workflows/`, que o Cortex não pode alterar, e o Jules não entregou. Ligue a ajuda do Claude na Central ou feche se não for mais necessária.'
      : `🙋 Precisa de você: o Cortex, o Jules e as IAs da Central tentaram ${MAX_VOLTAS_VIGIA + 1} vezes sem entregar. Ligue a ajuda do Claude na Central ou feche se não for mais necessária.`);
    out.precisa.push(n);
  }
  out.enviados = [];
  out.semCotaJules = [];
  // Regra do dono (08/11): cota do Jules acabou → a tarefa vai NA HORA para as IAs conectadas na Central (Cortex Reserva),
  // nunca espera a cota voltar. Arquivo de workflow fica com o Jules (só ele e o Claude podem mexer).
  let julesSemCota = false;
  const paraReserva = async (n, motivo) => {
    const i = todas.find(x => x.number === n) || {};
    if (mexeEmWorkflow(i) || nomes(i).includes('reserva-tentou')) return false;
    const ok = await p.gh(`${REPO}/actions/workflows/cortex-reserva.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'develop', inputs: { numero: String(n) } }) }).then(() => true).catch(() => false);
    if (!ok) return false;
    await por(n, ['reserva-tentou']);
    await comentar(n, `🔁 ${motivo} Mandei na hora para as IAs conectadas na Central (Cortex Reserva), sem esperar a cota voltar.`);
    out.semCotaJules.push(n);
    return true;
  };
  for (const n of d.enviarLista) {
    if (julesSemCota) { await paraReserva(n, 'O Jules está sem cota hoje.'); continue; }
    const r = await mandarParaJules(p, n, 'o robô (automático, tarefa travada)', { env, fetchFn });
    out.enviados.push({ issue: n, status: r.status, ...(r.status === 200 ? { link: r.corpo.link } : { erro: r.corpo.error }) });
    if (r.status === 502) { julesSemCota = /\(429\)|Limite/.test(String(r.corpo.error)); await paraReserva(n, julesSemCota ? 'O Jules está sem cota hoje.' : 'O Jules recusou a tarefa.'); }
  }
  if (!out.enviados.length) out.enviados = 0;
  const extras = (await rodarExtras(p, env, fetchFn, nomes, mandarParaJules)).filter(x => x.enviados !== 0);
  if (extras.length) out.extras = extras;
  return out;
}

module.exports = { rodar, decidir, proximaExtra, reposExtras, ESPERA_JULES_H, MAX_ENVIOS };
