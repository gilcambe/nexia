'use strict';
const { motivoDe } = require('./motivos');

const nomes = (i) => (i.labels || []).map((l) => (l && typeof l === 'object' ? l.name || '' : l) || '');
const tentativas = (ls) => ls.reduce((m, l) => { const x = /^tentativa-(\d+)$/.exec(String(l || '')); return x ? Math.max(m, Number(x[1])) : m; }, 0);

function estadoTarefa(issue, agora = Date.now(), cfg = { minutosParada: 30, maxTentativas: 3 }) {
  const ls = nomes(issue);
  const t = tentativas(ls);
  const has = (l) => ls.includes(l);
  const ultimaAtividade = new Date(issue.updated_at).getTime();
  const paradoMinutos = (agora - ultimaAtividade) / (1000 * 60);
  
  let estado = 'fila';
  let cor = 'cinza';
  let icone = '⏳';
  let texto = 'Na fila';
  let ia = null;
  
  const fechada = issue.state === 'closed';
  const concluida = has('cortex-feito') || has('jules-feito');

  if (fechada) {
    estado = concluida ? 'concluida' : 'falhou';
    cor = concluida ? 'verde' : 'vermelho';
    icone = concluida ? '✅' : '❌';
    texto = concluida ? 'Concluída' : 'Falhou';
  } else if (has('cortex-rodando') || has('jules-enviado') || has('cortex-jules') || has('reserva-tentou') || has('reserva-volta') || has('vez-do-claude')) {
    const travadaPorTempo = (has('cortex-rodando') || has('jules-enviado') || has('cortex-jules') || has('reserva-tentou') || has('reserva-volta') || has('vez-do-claude')) && paradoMinutos > cfg.minutosParada;
    
    if (has('cortex-travado') || has('cortex-reserva-sem-cota') || travadaPorTempo) {
      estado = 'travada';
      cor = 'laranja';
      icone = '⚠️';
      texto = 'Travada';
    } else if (has('cortex-rodando')) {
      estado = 'andamento';
      cor = 'azul';
      icone = '⚙️';
      texto = 'Em andamento';
      ia = 'Cortex';
    } else {
      estado = 'aguardando-ia';
      cor = 'roxo';
      icone = '🤖';
      texto = 'Aguardando IA';
      if (has('cortex-jules') || has('jules-enviado')) ia = 'Jules';
      else if (has('reserva-tentou') || has('reserva-volta')) ia = 'IAs grátis';
      else if (has('vez-do-claude')) ia = 'Claude';
    }
  }

  const m = motivoDe(issue);
  let motivo = m.texto;
  if (estado === 'travada' && paradoMinutos > cfg.minutosParada && !has('cortex-travado')) {
    motivo = `Sem atividade há ${Math.floor(paradoMinutos)} min. A IA pode ter parado.`;
  }

  const precisaVoce = estado === 'travada' && (t >= cfg.maxTentativas || has('vez-do-dono') || has('esperando-dono') || has('so-humano'));

  return { estado, cor, icone, texto, ia, motivo, precisaVoce, ultimaAtividade: issue.updated_at };
}

function resumoDia(contagens, ias) {
  const totalIas = ias ? ias.length : 0;
  return `Hoje: ${contagens.andamento || 0} em andamento, ${contagens.travada || 0} travadas, ${contagens.concluida || 0} concluídas. IAs ativas: ${totalIas} de ${totalIas}.`;
}

module.exports = { estadoTarefa, resumoDia };
