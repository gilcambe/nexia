'use strict';
// BUSCADOR de módulos (Fase 8, regra do dono 13/11/2026): "o Cortex, sempre que não tiver um módulo, avisa um agente,
// que busca na internet e traz". Fluxo (sem IA, sem rede aqui dentro):
//   1) pedidoDeBusca(falta)  → recado no mural (Viabilidade/Produção → Buscador) "falta X";
//   2) consultaGithub(falta) → a busca do GitHub com filtro de licença (MIT/Apache/BSD/ISC) que o workflow roda;
//   3) avaliar(repos)        → só entra quem tem licença aceita, não é arquivado, tem estrelas e foi atualizado;
//   4) o Catalogador põe em C:/NEXIA-TROCA/relatorios/biblioteca-repos.txt → scripts/gerar-prontos.js → prontos.json.
const LICENCAS = ['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', '0bsd', 'isc'];
const ANOS_MAX = 3;
const MIN_ESTRELAS = 50;

// português → inglês (o GitHub é em inglês)
const TRADUZ = { agenda: 'booking calendar', agendamento: 'appointment booking', cardapio: 'restaurant menu', carrinho: 'shopping cart',
  galeria: 'photo gallery', pagamento: 'payment', pix: 'pix brazil', formulario: 'form builder', anamnese: 'medical form', orcamento: 'quote invoice',
  avaliacao: 'reviews rating', depoimentos: 'testimonials', mapa: 'map', chat: 'chat widget', blog: 'blog', estoque: 'inventory',
  cupom: 'coupon', fidelidade: 'loyalty card', contrato: 'contract signature', assinatura: 'signature pad', reserva: 'reservation',
  calendario: 'calendar', relatorio: 'report charts', login: 'authentication', area: 'member area', cliente: 'customer portal' };
const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function termos(falta) {
  const t = sem(falta);
  const en = Object.entries(TRADUZ).filter(([pt]) => t.includes(pt)).map(([, en]) => en);
  return (en.length ? en.join(' ') : t).slice(0, 80);
}

/** Recado para o mural: a área que achou a falta pede ao Buscador. */
const pedidoDeBusca = (falta, deArea = 'viabilidade') => ({ area: deArea, agente: 'Analista técnico', tipo: 'pedido', para: 'buscador',
  texto: `Falta o módulo "${String(falta).slice(0, 80)}". Procure código pronto (MIT/Apache/BSD/ISC) que rode no site.` });

/** Caminho da API de busca do GitHub (um por licença; o workflow junta). */
function consultaGithub(falta, licenca = 'mit') {
  if (!LICENCAS.includes(licenca)) throw new Error('licença não aceita: ' + licenca);
  const q = `${termos(falta)} javascript license:${licenca} archived:false stars:>=${MIN_ESTRELAS}`;
  return `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`;
}

/** Itens da busca do GitHub → aprovados (licença aceita, ativo, popular), melhores primeiro. */
function avaliar(itens, agora = new Date()) {
  const limite = new Date(agora); limite.setFullYear(limite.getFullYear() - ANOS_MAX);
  return (itens || []).filter((r) => r && !r.archived && r.license && LICENCAS.includes(String(r.license.spdx_id || '').toLowerCase())
    && (r.stargazers_count || 0) >= MIN_ESTRELAS && new Date(r.pushed_at || 0) >= limite)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .map((r) => ({ repo: r.full_name, licenca: r.license.spdx_id, estrelas: r.stargazers_count, atualizado: String(r.pushed_at).slice(0, 10), uso: String(r.description || '').slice(0, 120) }));
}

/** Linha para biblioteca-repos.txt (repo|categoria|uso). */
const linhaCatalogo = (x, categoria) => `${x.repo}|${categoria}|${x.uso.replace(/\|/g, '/')} (lib)`;

module.exports = { pedidoDeBusca, consultaGithub, avaliar, termos, linhaCatalogo, LICENCAS, MIN_ESTRELAS };
