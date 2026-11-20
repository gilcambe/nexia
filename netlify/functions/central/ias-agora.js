'use strict';

// Retorna o status atual de cada IA configurada e do Jules/Cortex.
// Usado pela API /api/pedidos?ias=1.

const { VAGAS, estadoJules, classificar } = require('./ia-vagas');

function iasAgora({ vagas, julesEstado, abertas, agora }) {
  const agoraDate = new Date(agora);
  const out = [];

  // 1. Cortex (agregado)
  const tarefaCortex = abertas.find(i => i.labels.some(l => l.name === 'cortex-rodando'));
  out.push({
    nome: 'Cortex',
    situacao: tarefaCortex ? 'ativa' : 'ociosa',
    texto: tarefaCortex ? `Trabalhando no #${tarefaCortex.number}` : 'Parado, sem tarefa',
    tarefa: tarefaCortex ? { numero: tarefaCortex.number, titulo: tarefaCortex.title } : null,
    desde: tarefaCortex ? tarefaCortex.updated_at : null
  });

  // 2. Jules
  const tarefaJules = abertas.find(i => i.labels.some(l => l.name === 'jules-enviado'));
  out.push({
    nome: 'Jules',
    situacao: tarefaJules ? 'ativa' : (julesEstado.ligado ? 'ociosa' : 'sem-cota'),
    texto: tarefaJules ? `Trabalhando no #${tarefaJules.number}` : (julesEstado.ligado ? 'Parado, sem tarefa' : 'Desligado'),
    tarefa: tarefaJules ? { numero: tarefaJules.number, titulo: tarefaJules.title } : null,
    desde: tarefaJules ? tarefaJules.updated_at : null
  });

  // 3. Vagas configuradas
  for (const v of vagas.vagas) {
    if (!v.ligada) continue;
    const labels = [
      { nome: 'cortex-jules', status: 'ativa' },
      { nome: 'cortex-reserva-sem-cota', status: 'sem-cota' }
    ];

    let situacao = 'ociosa';
    let tarefa = null;
    let desde = null;

    const tarefaVaga = abertas.find(i => i.labels.some(l => l.name === `cortex-vaga-${v.vaga}`));
    if (tarefaVaga) {
      situacao = 'ativa';
      tarefa = { numero: tarefaVaga.number, titulo: tarefaVaga.title };
      desde = tarefaVaga.updated_at;
    } else if (v.teste && v.teste.situacao === 'sem-cota') {
      situacao = 'sem-cota';
    } else if (v.teste && v.teste.situacao === 'recusada') {
      situacao = 'erro';
    }

    let texto = 'Parada, sem tarefa';
    if (situacao === 'ativa') texto = `Trabalhando no #${tarefa.numero}`;
    else if (situacao === 'sem-cota') texto = 'Sem cota';
    else if (situacao === 'erro') texto = 'Chave com erro';

    out.push({ nome: `${v.provedor} #${v.vaga}`, situacao, texto, tarefa, desde });
  }

  return out;
}

async function carregar(gh, env) {
  const iaVagas = require('./ia-vagas');
  const [vagas, abertas] = await Promise.all([
    iaVagas.estado(gh, env),
    gh('/issues?state=open&labels=cortex-rodando,jules-enviado,cortex-jules,reserva-tentou&per_page=100').catch(() => [])
  ]);
  return {
    vagas,
    julesEstado: iaVagas.estadoJules(env, [], []), // Simplificado
    abertas,
    agora: Date.now()
  };
}

module.exports = { iasAgora, carregar };
