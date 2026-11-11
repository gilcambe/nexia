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

  // 1) Rotatividade de reserva usando rótulos reserva‑volta‑N (até 3 voltas, alternando provedores)
  // 5) Atualizar campo ia para refletir a última IA que tentou (reserva ou IAs grátis)
  let ia = null;
  const reservaVoltaLabel = ls.find((l) => /^reserva-volta-[1-3]$/.test(l));
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
  } else if (reservaVoltaLabel) {
    // reserva-volta-1, reserva-volta-2, reserva-volta-3
    const numVolta = reservaVoltaLabel.replace('reserva-volta-', '');
    ia = `Reserva Volta ${numVolta}`;
  } else if (
    has('reserva-tentou') ||
    has('reserva-volta') ||
    ls.some((l) => l.startsWith('reserva-'))
  ) {
    ia = 'IAs grátis';
  }

  // 2) Reconhecer verdadeiros mexidos em workflow apenas quando arquivos .github/workflows/*.yml são alterados e exibir estado “Aguardando permissão de workflow”
  // 3) Quando houver PR aberto citado, mostrar estado “aguardando-ia” com texto “Aguardando revisão do PR #N”
  const arquivosAlterados = issue.pull_request_files || issue.files || [];
  const workflowAlterado = arquivosAlterados.some((f) => {
    const caminho = typeof f === 'string' ? f : f.filename || f.path || '';
    return caminho.startsWith('.github/workflows/') && caminho.endsWith('.yml');
  }) || has('workflow-alterado') || has('workflow-pendente');

  const prAbertoCitado = issue.pull_request_number || issue.pr_number || (issue.pull_request && issue.pull_request.number) || null;

  // Determinar se tem label de aguardando-ia
  const ehAguardandoIa =
    workflowAlterado ||
    Boolean(prAbertoCitado) ||
    has('jules-enviado') ||
    has('cortex-jules') ||
    has('reserva-tentou') ||
    has('reserva-volta') ||
    Boolean(reservaVoltaLabel) ||
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

  const { texto: textoBase, cor, icone } = ESTADOS[estado];
  let texto = textoBase;
  if (workflowAlterado) {
    texto = 'Aguardando permissão de workflow';
  } else if (prAbertoCitado) {
    texto = `Aguardando revisão do PR #${prAbertoCitado}`;
  }

  // Motivo
  let motivo = motivoDe(issue).texto;
  if (travouPorTempo) {
    motivo = `Sem atividade há ${minInativo} min. A IA pode ter parado.`;
  }

  // 4) Se tarefa tem rótulo precisa‑de‑voce, definir precisaVoce=true e excluir das contagens de travadas
  const precisaVoceLabel = has('precisa-de-voce') || has('precisa_de_voce') || has('precisa‑de‑voce');
  const precisaVoce =
    precisaVoceLabel ||
    (estado === 'travada' &&
      (t >= maxTentativas ||
        has('vez-do-dono') ||
        has('esperando-dono') ||
        has('so-humano')));

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
  const precisa = Number(contagens.precisaVoce || 0);

  const listaIas = Array.isArray(ias) ? ias : [];
  const ativas = listaIas.filter((i) => i && (i.ativa || i.ligada || i.online)).length;
  const totalIas = listaIas.length;

  return `Hoje: ${andamento} em andamento, ${travadas} travada${travadas === 1 ? '' : 's'}, ${concluidas} concluída${concluidas === 1 ? '' : 's'}${precisa ? `, ${precisa} precisa${precisa === 1 ? '' : 'm'} de você` : ''}. IAs ativas: ${ativas} de ${totalIas}.`;
}

/**
 * Agrega e conta tarefas por estado para painéis e resumos.
 */
function estadoTarefas(issues = [], agora = Date.now(), cfg = {}) {
  const contagens = {
    fila: 0,
    andamento: 0,
    'aguardando-ia': 0,
    travada: 0,
    concluida: 0,
    falhou: 0,
    total: 0,
    precisaVoce: 0,
  };

  for (const issue of issues) {
    if (issue.pull_request) continue;
    contagens.total++;
    const info = estadoTarefa(issue, agora, cfg);
    // 08/11 (dono): tarefa que já precisa de você conta só em "precisa de você", não em "travadas".
    // Assim os dois números não se somam duas vezes na Central e no /cortex.
    if (info.precisaVoce) {
      contagens.precisaVoce++;
    } else if (contagens[info.estado] !== undefined) {
      contagens[info.estado]++;
    }
  }

  return contagens;
}

module.exports = {
  ESTADOS,
  estadoTarefa,
  resumoDia,
  estadoTarefas,
};
