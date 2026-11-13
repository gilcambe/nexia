'use strict';
// Agente DIRETOR (Fase 8, 13/11/2026). Puro e determinístico (não gasta IA): lê o mural e monta
//  1) o RESUMO para o dono (8h e 18h): feito, precisa de você, atrasado, por área — em linguagem simples;
//  2) as COBRANÇAS: pedido entre áreas aberto há mais de PRAZO_H vira 'alerta' para a área responsável.
const { AREAS, area: acharArea } = require('./areas');

const PRAZO_H = 24;
const horas = (a, b) => (Date.parse(b) - Date.parse(a)) / 3600e3;
const nomeArea = (id) => (acharArea(id) || { nome: id }).nome;

/** recados: do mural (qualquer ordem). agora: ISO. Devolve { titulo, precisaVoce, atrasados, feitos, porArea, texto }. */
function montarResumo(recados, agora = new Date().toISOString(), janelaH = 24) {
  const r = (recados || []).filter((x) => x && x.em);
  const recentes = r.filter((x) => horas(x.em, agora) <= janelaH);
  const precisaVoce = r.filter((x) => x.tipo === 'precisa-ok' && x.status === 'aberto')
    .sort((a, b) => (a.em < b.em ? -1 : 1));
  const atrasados = r.filter((x) => x.tipo === 'pedido' && x.status === 'aberto' && horas(x.em, agora) > PRAZO_H);
  const feitos = recentes.filter((x) => x.tipo === 'feito' || x.status === 'feito');
  const alertas = recentes.filter((x) => x.tipo === 'alerta' && x.status === 'aberto');
  const porArea = Object.fromEntries(AREAS.map((a) => [a.id, {
    nome: a.nome,
    feitos: feitos.filter((x) => x.area === a.id).length,
    abertos: r.filter((x) => (x.area === a.id || x.para === a.id) && x.status === 'aberto').length,
    ultimo: (recentes.filter((x) => x.area === a.id).sort((x, y) => (x.em < y.em ? 1 : -1))[0] || {}).texto || '',
  }]));
  const ativas = Object.values(porArea).filter((a) => a.feitos || a.ultimo).length;
  const titulo = precisaVoce.length
    ? `${precisaVoce.length} coisa(s) esperando o seu OK`
    : atrasados.length ? `${atrasados.length} tarefa(s) atrasada(s) entre as áreas` : 'Tudo andando, nada esperando você';
  const linhas = [
    `Resumo da KERNEX (últimas ${janelaH} h)`,
    `• Feito: ${feitos.length} · Áreas que trabalharam: ${ativas} de ${AREAS.length}`,
    ...(precisaVoce.length ? [`• Precisa de você (${precisaVoce.length}):`, ...precisaVoce.slice(0, 8).map((x) => `   – ${nomeArea(x.area)}: ${x.texto}`)] : ['• Nada esperando o seu OK.']),
    ...(atrasados.length ? [`• Atrasado (${atrasados.length}) — o Diretor já cobrou:`, ...atrasados.slice(0, 5).map((x) => `   – ${nomeArea(x.para || x.area)}: ${x.texto}`)] : []),
    ...(alertas.length ? [`• Alertas (${alertas.length}):`, ...alertas.slice(0, 5).map((x) => `   – ${nomeArea(x.area)}: ${x.texto}`)] : []),
    ...(feitos.length ? ['• Destaques:', ...feitos.slice(-5).map((x) => `   – ${nomeArea(x.area)}: ${x.texto}`)] : []),
  ];
  return { titulo, precisaVoce, atrasados, feitos: feitos.length, alertas: alertas.length, porArea, texto: linhas.join('\n'), em: agora };
}

/** Recados de cobrança que o Diretor deve postar (sem repetir cobrança já feita para o mesmo pedido). */
function cobrancas(recados, agora = new Date().toISOString()) {
  const r = recados || [];
  const jaCobrados = new Set(r.filter((x) => x.tipo === 'alerta' && x.ref && x.ref.tipo === 'cobranca').map((x) => x.ref.id));
  return r.filter((x) => x.tipo === 'pedido' && x.status === 'aberto' && horas(x.em, agora) > PRAZO_H && !jaCobrados.has(x.id))
    .map((x) => ({ area: 'diretoria', agente: 'Diretor', tipo: 'alerta', para: x.para || x.area,
      texto: `${nomeArea(x.para || x.area)}: o pedido "${String(x.texto).slice(0, 120)}" está aberto há ${Math.round(horas(x.em, agora))} h. Resolva ou diga o que falta.`,
      ref: { tipo: 'cobranca', id: x.id } }));
}

module.exports = { montarResumo, cobrancas, PRAZO_H };
