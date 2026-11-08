'use strict';
// #3133 (#3125 parte 3/6): painel "IAs trabalhando agora". Uma linha por IA, só com dado real.
const LABEL_DA_IA = { Cortex: ['cortex-rodando'], Jules: ['jules-enviado', 'cortex-jules'], 'IAs grátis': ['reserva-tentou'] };
const nomes = (i) => (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name || ''));
const min = (iso, agora) => Math.max(0, Math.round((agora - Date.parse(iso)) / 60000));

function linha(nome, situacao, issues, agora, textoBase) {
  const ordem = [...issues].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const atual = situacao === 'ativa' ? ordem[0] : null;
  const texto = atual ? `Trabalhando no #${atual.number} há ${min(atual.updated_at, agora)} min` : textoBase;
  return { nome, situacao, ativa: situacao === 'ativa', texto, tarefa: atual ? { numero: atual.number, titulo: String(atual.title || '').slice(0, 120) } : null, desde: atual ? atual.updated_at : null };
}

/** Pura. vagas = ia-vagas.estado().vagas; julesEstado = estadoJules(); abertas = issues abertas com labels de trabalho. */
function iasAgora({ vagas = [], julesEstado = null, abertas = [], agora = Date.now() } = {}) {
  const com = (labels) => abertas.filter((i) => !i.pull_request && nomes(i).some((l) => labels.includes(l)));
  const out = [];
  const cortex = com(LABEL_DA_IA.Cortex);
  out.push(linha('Cortex', cortex.length ? 'ativa' : 'ociosa', cortex, agora, 'Parado, sem tarefa'));
  const jules = com(LABEL_DA_IA.Jules);
  const julesLigado = !julesEstado || julesEstado.ligado !== false;
  out.push(linha('Jules', !julesLigado ? 'erro' : jules.length ? 'ativa' : 'ociosa', jules, agora, julesLigado ? 'Parado, sem tarefa' : 'Sem chave do Jules no servidor'));
  const reserva = com(LABEL_DA_IA['IAs grátis']);
  const semCota = abertas.some((i) => nomes(i).includes('cortex-reserva-sem-cota'));
  for (const v of vagas) {
    if (!v || !v.ligada) continue;
    const nome = `Vaga ${v.vaga}${v.provedor ? ' · ' + v.provedor : ''}`;
    const sit = (v.teste && v.teste.situacao) || null;
    if (v.pausada) { out.push(linha(nome, 'ociosa', [], agora, 'Pausada por você')); continue; }
    if (sit === 'sem-cota') { out.push(linha(nome, 'sem-cota', [], agora, 'Sem cota até amanhã')); continue; }
    if (sit === 'recusada' || sit === 'erro') { out.push(linha(nome, 'erro', [], agora, 'Chave com erro')); continue; }
    const minhas = reserva.filter((i) => (v.usos || []).some((u) => u.tarefa === i.number));
    out.push(linha(nome, minhas.length ? 'ativa' : 'ociosa', minhas, agora, 'Parada, sem tarefa'));
  }
  if (reserva.length && !out.some((x) => x.nome.startsWith('Vaga') && x.ativa)) {
    out.push(linha('IAs grátis', semCota ? 'sem-cota' : 'ativa', semCota ? [] : reserva, agora, 'Sem cota até amanhã'));
  }
  return out;
}

async function carregar(gh, repo, env) {
  // Suporta tanto carregar(gh, repo, env) quanto carregar(gh, env)
  if (repo && typeof repo === 'object') {
    env = repo;
    repo = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';
  } else {
    env = env || process.env;
    if (!repo || typeof repo !== 'string') {
      repo = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';
    }
  }
  const ghRepo = (c, init) => gh('/repos/' + repo + c, init);
  const busca = (labels) => gh('/repos/' + repo + '/issues?state=open&per_page=100&labels=' + encodeURIComponent(labels)).catch(() => []);
  const [est, ...listas] = await Promise.all([
    require('./ia-vagas').estado(ghRepo, env).catch(() => ({ vagas: [], jules: null })),
    busca('cortex-rodando'), busca('jules-enviado'), busca('cortex-jules'), busca('reserva-tentou'), busca('cortex-reserva-sem-cota'),
  ]);
  const vistos = new Map();
  for (const l of listas) for (const i of l || []) vistos.set(i.number, i);
  return iasAgora({ vagas: est.vagas || [], julesEstado: est.jules, abertas: [...vistos.values()] });
}

module.exports = { iasAgora, carregar };
