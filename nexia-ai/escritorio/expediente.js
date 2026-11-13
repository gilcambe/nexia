'use strict';
// EXPEDIENTE das áreas (13/11/2026, dono: "os funcionários da KERNEX ainda não foram criados"). Cada área faz um trabalho
// REAL com dados reais e escreve no mural (nexia-ai/escritorio/mural.js). Regra: nada inventado — sem fonte de dado, a área
// não posta. Nada aqui manda mensagem para fora, cobra ou publica.
//   Suporte    → confere cada site no ar (lista oficial central/produtos.js)
//   T.I.       → confere o CI da develop e robôs que falharam nas últimas 24 h
//   Produção   → fila do Cortex: entregues em 24 h, na fila, travadas
//   RH e qualidade → mede a qualidade das entregas (PRs juntados x fechados sem juntar em 24 h)
//   Marketing  → 3 ideias de post para a semana (IA grátis; só ideias, ninguém publica sem o dono)

const HORAS = 24;

/** Função pura: recados do Suporte a partir da conferência dos sites. */
function suporte(resultados) {
  const fora = resultados.filter((r) => !r.ok);
  if (!resultados.length) return [];
  if (!fora.length) return [{ area: 'suporte', agente: 'Atendente', tipo: 'feito', texto: `Conferi os ${resultados.length} sites e sistemas: todos no ar.` }];
  return [
    { area: 'suporte', agente: 'Atendente', tipo: 'alerta', texto: `${fora.length} de ${resultados.length} fora do ar: ${fora.map((f) => f.nome).join(', ')}.` },
    { area: 'suporte', agente: 'Atendente', tipo: 'pedido', para: 'ti', texto: `T.I., verifiquem: ${fora.map((f) => `${f.nome} (${f.motivo})`).join('; ')}.` },
  ];
}

/** Função pura: recados da T.I. (runs = execuções do Actions nas últimas 24 h, da mais nova para a mais velha). */
function ti(runs, agora) {
  const recentes = (runs || []).filter((r) => (Date.parse(agora) - Date.parse(r.created_at)) / 36e5 <= HORAS && r.status === 'completed');
  if (!recentes.length) return [];
  const ci = recentes.find((r) => r.name === 'CI' && r.head_branch === 'develop');
  const falhas = recentes.filter((r) => r.conclusion === 'failure');
  const nomes = [...new Set(falhas.map((r) => r.name))];
  const out = [];
  if (ci) out.push({ area: 'ti', agente: 'Técnico', tipo: ci.conclusion === 'success' ? 'feito' : 'alerta', texto: ci.conclusion === 'success' ? 'CI da develop verde.' : `CI da develop falhou: ${ci.html_url}` });
  out.push(nomes.length
    ? { area: 'ti', agente: 'Técnico', tipo: 'alerta', texto: `${falhas.length} execução(ões) com falha em 24 h (${recentes.length} no total): ${nomes.slice(0, 6).join(', ')}.` }
    : { area: 'ti', agente: 'Técnico', tipo: 'feito', texto: `${recentes.length} execuções de robôs em 24 h, nenhuma falhou.` });
  return out;
}

/** Função pura: recado da Produção (contagens da fila do Cortex). */
function producao({ fechadas24h, naFila, travadas, prsJuntados24h }) {
  return [{ area: 'producao', agente: 'Cortex', tipo: travadas ? 'alerta' : 'feito',
    texto: `Em 24 h: ${prsJuntados24h} PR(s) juntados e ${fechadas24h} tarefa(s) concluída(s). Agora: ${naFila} na fila, ${travadas} travada(s).` }];
}

/** Função pura: recado de RH e qualidade (PRs fechados nas últimas 24 h). */
function rh(prs, agora) {
  const r = (prs || []).filter((p) => p.closed_at && (Date.parse(agora) - Date.parse(p.closed_at)) / 36e5 <= HORAS);
  if (!r.length) return [];
  const juntados = r.filter((p) => p.merged_at).length;
  const pct = Math.round((100 * juntados) / r.length);
  return [{ area: 'rh', agente: 'Avaliador', tipo: pct < 50 ? 'alerta' : 'info', texto: `Qualidade das entregas em 24 h: ${juntados} de ${r.length} PRs aproveitados (${pct}%).` }];
}

/** Função pura: recado do Marketing a partir do texto da IA (ou nada, se a IA não respondeu). */
function marketing(ideias) {
  const l = String(ideias || '').split('\n').map((x) => x.replace(/^[\s\-*\d.)]+/, '').trim()).filter((x) => x.length > 10).slice(0, 3);
  if (!l.length) return [];
  return [{ area: 'marketing', agente: 'Redator', tipo: 'precisa-ok', texto: `3 ideias de post para a semana (aprove antes de publicar): 1) ${l[0]}${l[1] ? ` 2) ${l[1]}` : ''}${l[2] ? ` 3) ${l[2]}` : ''}` }];
}

module.exports = { suporte, ti, producao, rh, marketing, HORAS };
