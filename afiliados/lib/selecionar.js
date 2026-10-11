'use strict';
// Escolhe o que entra no site e o que vai para cada rede, com as regras anti-spam.
const DIA = 24 * 3600 * 1000;

/** Nota de 0 a ~100: ganho esperado por venda x popularidade x avaliação x desconto. */
function pontuar(o) {
  const ganho = Math.max(0.5, (o.comissao || 0) * (o.preco || 0));
  const popular = Math.log10((o.vendas || 0) + 10);
  const aval = Math.pow((o.nota || 4.5) / 5, 2);
  const desc = 1 + Math.min(70, o.desconto || 0) / 100;
  return Math.round(ganho * popular * aval * desc * 10) / 10;
}

function passaFiltro(o, f) {
  if (!o || !o.link || !o.titulo || !o.imagem) return false;
  if (o.manual) return true; // escolhido à mão: entra sempre
  if (o.nota && o.nota < f.nota_minima) return false;
  if ((o.vendas || 0) < f.vendas_minimas) return false;
  if ((o.comissao || 0) < f.comissao_minima) return false;
  if (!o.preco || o.preco > f.preco_maximo) return false;
  return true;
}

/**
 * Junta as ofertas novas com as que já estavam no site. Ofertas da busca automática ficam `dias_no_site` dias
 * depois da última vez que apareceram; as coladas à mão ficam 14 dias. Mantém no máximo `maximo_no_site`.
 */
function montarVitrine(novas, antigas, filtros, agora = Date.now()) {
  const porId = new Map();
  for (const o of antigas || []) porId.set(o.id, o);
  for (const o of novas || []) {
    if (!passaFiltro(o, filtros)) continue;
    const velho = porId.get(o.id);
    porId.set(o.id, { ...velho, ...o, desde: (velho && velho.desde) || o.desde || agora, visto: o.manual ? (o.visto || agora) : agora });
  }
  const validade = o => (o.manual ? 14 : filtros.dias_no_site) * DIA;
  const vivas = [...porId.values()].filter(o => agora - (o.visto || 0) <= validade(o));
  for (const o of vivas) o.pontos = pontuar(o);
  vivas.sort((a, b) => (b.manual === true) - (a.manual === true) || b.pontos - a.pontos);
  return vivas.slice(0, filtros.maximo_no_site);
}

/** Hora em Brasília (UTC-3, sem horário de verão desde 2019). */
const horaBrasilia = t => new Date(t - 3 * 3600 * 1000).getUTCHours();

/**
 * Quais ofertas postar agora num canal. `historico` é a lista de { canal, id, quando }.
 * Regras: só entre hora_inicio e hora_fim (Brasília), no máximo posts_por_dia por canal nas últimas 24 h,
 * pelo menos horas_entre_posts desde o último post do canal e nunca o mesmo produto em dias_sem_repetir dias
 * (em nenhum canal, para não parecer robô repetindo).
 */
function escolherPosts(vitrine, historico, canal, regras, agora = Date.now()) {
  const h = horaBrasilia(agora);
  if (h < regras.hora_inicio || h >= regras.hora_fim) return [];
  const doCanal = (historico || []).filter(x => x.canal === canal);
  const hoje = doCanal.filter(x => agora - x.quando < DIA).length;
  const ultimo = doCanal.reduce((m, x) => Math.max(m, x.quando), 0);
  if (hoje >= regras.posts_por_dia) return [];
  if (ultimo && agora - ultimo < regras.horas_entre_posts * 3600 * 1000 - 5 * 60 * 1000) return [];
  const recentes = new Set((historico || []).filter(x => x.canal === canal && agora - x.quando < regras.dias_sem_repetir * DIA).map(x => x.id));
  const quantos = Math.min(regras.posts_por_rodada, regras.posts_por_dia - hoje);
  return vitrine.filter(o => !recentes.has(o.id)).slice(0, quantos);
}

/** Guarda só os últimos 30 dias de histórico. */
function podarHistorico(historico, agora = Date.now()) {
  return (historico || []).filter(x => agora - x.quando < 30 * DIA);
}

module.exports = { pontuar, passaFiltro, montarVitrine, escolherPosts, podarHistorico, horaBrasilia };
