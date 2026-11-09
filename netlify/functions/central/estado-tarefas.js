'use strict';
// #3128 (#3125 parte 1/6): Estado único da tarefa (servidor)
// Central e /cortex leem só este módulo.
// Limite padrão de inatividade: 30 min.

const { motivoDe } = require('./motivos');

const ESTADOS = Object.freeze({
  fila: { texto: 'Na fila', cor: 'cinza', icone: '⏳' },
  andamento: { texto: 'Em andamento', cor: 'azul', icone: '⚙️' },
  'aguardando-ia': { texto: 'Aguardando IA', cor: 'roxo', icone: '🤖' },
  travada: { texto: 'Travada', cor: 'laranja', icone: '⚠️' },
  concluida: { texto: 'Concluída', cor: 'verde', icone: '✅' },
  falhou: { texto: 'Falhou', cor: 'vermelho', icone: '❌' },
});

const nomes = (i) => (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name || ''));
const tentativas = (ls) => ls.reduce((m, l) => {
  const x = /^tentativa-(\d+)$/.exec(l);
  return x ? Math.max(m, Number(x[1])) : m;
}, 0);

/**
 * Calcula o estado unificado de uma tarefa / issue.
 * @param {object} issue - objeto retornado pela API do GitHub
 * @param {number} agora - timestamp em milissegundos
 * @param {object} cfg - opções de configuração: minutosParada (default 30), maxTentativas (default 3)
 */
function estadoTarefa(issue, agora = Date.now(), cfg = {}) {
  const minutosParada = typeof cfg.minutosParada === 'number' ? cfg.minutosParada : 30;
  const maxTentativas = typeof cfg.maxTentativas === 'number' ? cfg.maxTentativas : 3;

  const ls = nomes(issue);
  const has = (l) => ls.includes(l);
  const t = tentativas(ls);

  const fechada = issue.state === 'closed';
  const ultimaAtividade = issue.updated_at || null;
  const msAtualizacao = ultimaAtividade ? Date.parse(ultimaAtividade) : NaN;
  const msInativo = Number.isFinite(msAtualizacao) ? Math.max(0, agora - msAtualizacao) : 0;
  const minInativo = Math.floor(msInativo / 60000);
  const paradoPorTempo = minInativo >= minutosParada;

  // Determinar IA responsável
  let ia = null;
  if (has('cortex-rodando')) {
    ia = 'Cortex';
  } else if (has('vez-do-claude')) {
    ia = 'Claude';
  } else if (
    has('jules-enviado') ||
    has('cortex-jules') ||
    ls.some((l) => l.startsWith('jules-'))
  ) {
    ia = 'Jules';
  } else if (
    has('reserva-tentou') ||
    has('reserva-volta') ||
    ls.some((l) => l.startsWith('reserva-'))
  ) {
    ia = 'IAs grátis';
  }

  // Determinar se tem label de aguardando-ia
  const ehAguardandoIa =
    has('jules-enviado') ||
    has('cortex-jules') ||
    has('reserva-tentou') ||
    has('reserva-volta') ||
    has('vez-do-claude');

  // Determinar o estado (um dos 6: fila, andamento, aguardando-ia, travada, concluida, falhou)
  let estado = 'fila';
  let travouPorTempo = false;

  if (fechada) {
    if (has('cortex-feito') || has('jules-feito')) {
      estado = 'concluida';
    } else {
      estado = 'falhou';
    }
  } else {
    // Tarefa aberta
    const ehTravadaExplicita = has('cortex-travado') || has('cortex-reserva-sem-cota');
    const ehCortexRodando = has('cortex-rodando');

    if (ehTravadaExplicita) {
      estado = 'travada';
    } else if (ehCortexRodando && paradoPorTempo) {
      estado = 'travada';
      travouPorTempo = true;
    } else if (ehAguardandoIa && paradoPorTempo) {
      estado = 'travada';
      travouPorTempo = true;
    } else if (ehCortexRodando) {
      estado = 'andamento';
    } else if (ehAguardandoIa) {
      estado = 'aguardando-ia';
    } else {
      estado = 'fila';
    }
  }

  const { texto, cor, icone } = ESTADOS[estado];

  // Motivo
  let motivo = motivoDe(issue).texto;
  if (travouPorTempo) {
    motivo = `Sem atividade há ${minInativo} min. A IA pode ter parado.`;
  }

  // Precisa do dono / você
  const precisaVoce =
    estado === 'travada' &&
    (t >= maxTentativas ||
      has('vez-do-dono') ||
      has('esperando-dono') ||
      has('so-humano'));

  return {
    estado,
    cor,
    icone,
    texto,
    ia,
    motivo,
    precisaVoce,
    ultimaAtividade,
  };
}

/**
 * Resumo do dia em texto simples para exibição rápida.
 * @param {object} contagens - objeto com as contagens de estados (ex: { andamento, travada, concluida, ... })
 * @param {Array} ias - lista de IAs (ex: lista de vagas/provedores)
 */
function resumoDia(contagens = {}, ias = []) {
  const andamento = Number(contagens.andamento || 0);
  const travadas = Number(contagens.travada || contagens.travadas || 0);
  const concluidas = Number(contagens.concluida || contagens.concluidas || 0);

  const listaIas = Array.isArray(ias) ? ias : [];
  const ativas = listaIas.filter((i) => i && (i.ativa || i.ligada || i.online)).length;
  const totalIas = listaIas.length;

  return `Hoje: ${andamento} em andamento, ${travadas} travada${travadas === 1 ? '' : 's'}, ${concluidas} concluída${concluidas === 1 ? '' : 's'}. IAs ativas: ${ativas} de ${totalIas}.`;
}

/**
 * Agrega e conta tarefas por estado para painéis e resumos.
 */
/**
 * Busca e agrega o estado das tarefas usando a API do GitHub.
 * @param {object} [opts] - Opções (ex: token, agora)
 */
async function estadoTarefas(opts = {}) {
  const token = opts.token || process.env.GITHUB_TOKEN || process.env.NEXIA_JOBS_TOKEN || process.env.NEXIA_GITHUB_TOKEN || '';
  const agora = opts.agora || Date.now();
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Nexia-Cortex',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  let fila = 0;
  let rodandoList = [];
  let travadasList = [];
  let feitas7 = 0;

  try {
    // 1. Fila: repo:gilcambe/nexia is:issue is:open label:cortex-fila
    const resFila = await fetch('https://api.github.com/search/issues?q=' + encodeURIComponent('repo:gilcambe/nexia is:issue is:open label:cortex-fila'), { headers });
    if (resFila.ok) {
      const dataFila = await resFila.json();
      fila = typeof dataFila.total_count === 'number' ? dataFila.total_count : 0;
    }
  } catch (e) {
    // Ignora erro de fetch na fila
  }

  try {
    // 2. Rodando e travadas: repo:gilcambe/nexia is:issue is:open label:cortex-rodando
    const resRodando = await fetch('https://api.github.com/search/issues?q=' + encodeURIComponent('repo:gilcambe/nexia is:issue is:open label:cortex-rodando'), { headers });
    if (resRodando.ok) {
      const dataRodando = await resRodando.json();
      const items = Array.isArray(dataRodando.items) ? dataRodando.items : [];
      const limiteMs = 30 * 60 * 1000;

      for (const issue of items) {
        const updatedAt = issue.updated_at || issue.created_at || new Date().toISOString();
        const msAtualizacao = Date.parse(updatedAt);
        const msInativo = Number.isFinite(msAtualizacao) ? Math.max(0, agora - msAtualizacao) : 0;
        const minInativo = Math.floor(msInativo / 60000);

        const obj = {
          id: issue.id || issue.number,
          title: issue.title || '',
          updated_at: updatedAt,
          motivo: `sem atividade há ${minInativo} min`,
        };

        if (msInativo <= limiteMs) {
          rodandoList.push(obj);
        } else {
          travadasList.push(obj);
        }
      }
    }
  } catch (e) {
    // Ignora erro de fetch em rodando
  }

  try {
    // 3. Feitas nos últimos 7 dias: closed nos últimos 7 dias (label cortex-feito ou state:closed)
    const seteDiasAtras = new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const queryFeitas = `repo:gilcambe/nexia is:issue is:closed closed:>=${seteDiasAtras} label:cortex-feito`;
    const resFeitas = await fetch('https://api.github.com/search/issues?q=' + encodeURIComponent(queryFeitas), { headers });
    if (resFeitas.ok) {
      const dataFeitas = await resFeitas.json();
      feitas7 = typeof dataFeitas.total_count === 'number' ? dataFeitas.total_count : 0;
    } else {
      // Fallback sem label cortex-feito
      const queryFeitasAlt = `repo:gilcambe/nexia is:issue is:closed closed:>=${seteDiasAtras}`;
      const resFeitasAlt = await fetch('https://api.github.com/search/issues?q=' + encodeURIComponent(queryFeitasAlt), { headers });
      if (resFeitasAlt.ok) {
        const dataFeitasAlt = await resFeitasAlt.json();
        feitas7 = typeof dataFeitasAlt.total_count === 'number' ? dataFeitasAlt.total_count : 0;
      }
    }
  } catch (e) {
    // Ignora erro de fetch em feitas
  }

  return {
    fila,
    rodando: rodandoList,
    travadas: travadasList,
    feitas7,
    conferidoEm: new Date(agora).toISOString(),
    origem: 'GitHub search issues – contagem de rótulos cortex‑fila/rodando/feito',
  };
}

module.exports = {
  ESTADOS,
  estadoTarefa,
  resumoDia,
  estadoTarefas,
};
