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

function estadoTarefa(issue, agora = Date.now(), cfg = { minutosParada: 30, maxTentativas: 3 }) {
  const ls = (issue.labels || []).map((l) => l.name || l);
  const updated = new Date(issue.updated_at).getTime();
  const diffMin = (agora - updated) / 60000;
  const t = Math.max(0, ...ls.map((n) => Number((/^tentativa-(\\d+)$/.exec(n) || [])[1] || 0)));

  let estado = 'fila';
  let ia = null;

  const cortexRodando = ls.includes('cortex-rodando');
  const isTravada = ls.includes('cortex-travado') || ls.includes('cortex-reserva-sem-cota');
  const aguardandoIa = ls.includes('jules-enviado') || ls.includes('cortex-jules') || ls.includes('reserva-tentou') || ls.includes('reserva-volta') || ls.includes('vez-do-claude');

  if (issue.state === 'closed') {
    estado = ls.includes('cortex-feito') || ls.includes('jules-feito') || issue.state_reason === 'completed' ? 'concluida' : 'falhou';
  } else if (isTravada || (cortexRodando && diffMin > cfg.minutosParada) || (aguardandoIa && diffMin > cfg.minutosParada)) {
    estado = 'travada';
  } else if (cortexRodando) {
    estado = 'andamento';
    ia = 'Cortex';
  } else if (aguardandoIa) {
    estado = 'aguardando-ia';
    if (ls.includes('jules-enviado') || ls.includes('cortex-jules')) ia = 'Jules';
    else if (ls.includes('reserva-tentou') || ls.includes('reserva-volta')) ia = 'IAs grátis';
    else if (ls.includes('vez-do-claude')) ia = 'Claude';
  }

  const m = motivoDe(issue);
  let motivo = m.texto;
  if (estado === 'travada' && !ls.includes('cortex-travado') && !ls.includes('cortex-reserva-sem-cota') && (cortexRodando || aguardandoIa)) {
    motivo = `Sem atividade há ${Math.round(diffMin)} min. A IA pode ter parado.`;
  }

  const precisaVoce = estado === 'travada' && (t >= cfg.maxTentativas || ls.includes('vez-do-dono') || ls.includes('esperando-dono') || ls.includes('so-humano'));

  return {
    estado,
    ...ESTADOS[estado],
    ia,
    motivo,
    precisaVoce,
    ultimaAtividade: issue.updated_at,
  };
}

function resumoDia(contagens = {}, ias = []) {
  const andamento = contagens.andamento || 0;
  const travada = contagens.travada || 0;
  const concluida = contagens.concluida || 0;
  const precisa = contagens.precisaVoce || 0;
  const ativas = ias.filter((i) => i.ativa || i.ligada || i.online).length;
  
  let frase = \`Hoje: \${andamento} em andamento, \${travada} travadas, \${concluida} concluídas.\`;
  if (precisa > 0) frase = \`Hoje: \${andamento} em andamento, \${travada} travadas, \${concluida} concluídas, \${precisa} precisa de você.\`;
  frase += \` IAs ativas: \${ativas} de \${ias.length}.\`;
  return frase;
}

function estadoTarefas(issues, agora = Date.now(), cfg) {
  const c = { total: issues.length, fila: 0, andamento: 0, travada: 0, concluida: 0, falhou: 0, precisaVoce: 0 };
  for (const i of issues) {
    const e = estadoTarefa(i, agora, cfg);
    c[e.estado]++;
    if (e.precisaVoce) c.precisaVoce++;
  }
  return c;
}

module.exports = { ESTADOS, estadoTarefa, resumoDia, estadoTarefas };
