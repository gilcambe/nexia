'use strict';
// Central NEXIA: lista dos produtos e clientes que aparecem na página /central.
// "site" é o que o público vê, "painel" é a área do dono. "suporte" = cliente com agenda (entrar sem senha).
// Produto novo: acrescente uma linha aqui. Links grátis do dia a dia ficam em LINKS.

const BASE = 'https://nexia.gcbezerra.workers.dev';

const PRODUTOS = [
  { id: 'body-coach', nome: 'Body Coach', icone: '💪', frase: 'App de treino e dieta (vende assinatura)', site: 'https://nexiabodycoach.pages.dev/', painel: 'https://nexiabodycoach.pages.dev/body-coach/admin/acessos' },
  { id: 'cortex', nome: 'Cortex', icone: '🧠', frase: 'O robô que programa a NEXIA', site: BASE + '/health', painel: BASE + '/cortex-app' },
  { id: 'achados', nome: 'Achados (ofertas)', icone: '🛍️', frase: 'Vitrine de ofertas com link de afiliado', site: 'https://achados-nexia.pages.dev/', painel: 'https://github.com/gilcambe/nexia/actions/workflows/afiliados.yml' },
  { id: 'divulga', nome: 'Divulga', icone: '📣', frase: 'Posta os clientes no Facebook e Instagram', site: 'https://www.instagram.com/nexiabodycoach/', painel: 'https://github.com/gilcambe/nexia/actions/workflows/divulga.yml' },
  { id: 'bezsan', nome: 'Bezsan Leilões', icone: '🏛️', frase: 'Cliente: site e agenda de reuniões', site: 'https://bezsan.pages.dev/', painel: 'https://bezsan.pages.dev/agenda/', suporte: 'bezsan' },
  { id: 'studiolima', nome: 'Studio Lima', icone: '✨', frase: 'Cliente: estética, site e agenda', site: 'https://studiolima.pages.dev/', painel: 'https://studiolima.pages.dev/agenda/', suporte: 'studiolima' },
];

const LINKS = [
  { nome: 'Firebase (banco e logins)', url: 'https://console.firebase.google.com/' },
  { nome: 'Cloudflare (sites no ar)', url: 'https://dash.cloudflare.com/' },
  { nome: 'GitHub (código e robôs)', url: 'https://github.com/gilcambe/nexia' },
  { nome: 'Google Play (app Android)', url: 'https://play.google.com/console' },
  { nome: 'Facebook e Instagram (Meta)', url: 'https://business.facebook.com/' },
  { nome: 'Shopee Afiliados (comissões)', url: 'https://affiliate.shopee.com.br/' },
  { nome: 'Amazon Associados (comissões)', url: 'https://associados.amazon.com.br/' },
  { nome: 'Google Search Console', url: 'https://search.google.com/search-console' },
  { nome: 'Gmail da NEXIA', url: 'https://mail.google.com/' },
];

// Robôs que a Central pode mandar rodar (arquivo do GitHub Actions → nome simples e o que mandar).
const ROBOS = [
  { arquivo: 'divulga.yml', nome: 'Divulgação', inputs: { acao: 'rodar' } },
  { arquivo: 'afiliados.yml', nome: 'Ofertas (afiliados)', inputs: { acao: 'rodar' } },
  { arquivo: 'fila-cortex.yml', nome: 'Fila do Cortex', inputs: {} },
  { arquivo: 'smoke.yml', nome: 'Teste rápido do site', inputs: { url: BASE } },
  { arquivo: 'deploy-cloudflare.yml', nome: 'Publicação do site', inputs: null },
  { arquivo: 'ci.yml', nome: 'Conferência do código', inputs: null },
];

module.exports = { PRODUTOS, LINKS, ROBOS, BASE };
