'use strict';
// 09/11 (dono): "Qual status de tudo?" virou tarefa e ficou um dia na fila. A Central responde na hora, com dados
// reais (o-que-falta + IAs agora), sem passar pelo Cortex. Função pura textoStatus testada em tests/unit/status-agora.test.js.

function textoStatus({ oqf, ias, agora = Date.now() }) {
  const r = (oqf && oqf.resumo) || {};
  const dia = 864e5;
  const paradas = ((oqf && oqf.comCortex) || []).filter((x) => !x.rodando && x.quando && agora - Date.parse(x.quando) > dia);
  const ativas = ias && Array.isArray(ias.ias) ? ias.ias.filter((x) => x.ativa).length : null;
  const total = ias && Array.isArray(ias.ias) ? ias.ias.length : null;
  const linhas = [
    `Status agora: ${r.rodando || 0} tarefa(s) sendo feitas, ${r.pedidos || 0} pedido(s) na fila e ${r.travadas || 0} travada(s) (as IAs tentam de novo).`,
    `Prontas nas últimas 72 h: ${r.prontos72h || 0}.`,
    `Esperando você: ${r.esperandoVoce || 0}${r.esperandoVoce ? ' (veja "Precisa de você" no Início, com o passo a passo)' : ''}.`,
  ];
  if (ativas !== null) linhas.push(`IAs trabalhando: ${ativas} de ${total}.`);
  if (paradas.length) linhas.push(`Paradas há mais de 1 dia: ${paradas.length}. No Início, em "Status de tudo", cada uma tem o motivo e o botão Destravar.`);
  if (r.pausada) linhas.push('Atenção: a fila está PAUSADA. Toque em "Voltar a rodar" no Início.');
  return linhas.join(' ');
}

async function statusAgora(gh, env = process.env) {
  const oq = require('./o-que-falta');
  const [oqf, ias] = await Promise.all([
    oq.buscar(oq.criarGql(env)).catch(() => null),
    require('./ias-agora').carregar(gh, require('./pedidos-gh').REPO).catch(() => null),
  ]);
  return textoStatus({ oqf, ias: ias ? { ias } : null });
}

module.exports = { textoStatus, statusAgora };
