'use strict';
// Central Kernex: lista dos produtos e clientes que aparecem na página /central.
// logo = arquivo real em public/central/logos (sem logo, a tela mostra ícone provisório). segmento = ramo do cliente.
// "site" é o que o público vê, "painel" é a área do dono. "suporte" = cliente com agenda (entrar sem senha).
// Produto novo: acrescente uma linha aqui. "pendente: true" = ainda sem site no ar (a tela mostra "em breve"). Links grátis do dia a dia ficam em LINKS.

const BASE = 'https://cortex.kernex.com.br';

const PRODUTOS = [
  { id: 'body-coach', logo: '/central/logos/body-coach.svg', segmento: 'Fitness', nome: 'Body Coach', icone: '💪', frase: 'App de treino e dieta (vende assinatura)', site: 'https://bodycoach.kernex.com.br/', painel: 'https://bodycoach.kernex.com.br/body-coach/admin/acessos', tipo: 'produto' },
  { id: 'cortex', logo: '/central/logos/cortex.svg', segmento: 'IA', nome: 'Cortex', icone: '🧠', frase: 'O robô que programa a Kernex', site: BASE + '/health', painel: BASE + '/cortex-app', tipo: 'produto' },
  { id: 'achados', segmento: 'Ofertas', nome: 'Achados (ofertas)', icone: '🛍️', frase: 'Vitrine de ofertas com link de afiliado', site: 'https://achados-nexia.pages.dev/', painel: 'https://github.com/gilcambe/nexia/actions/workflows/afiliados.yml', tipo: 'produto' },
  { id: 'divulga', segmento: 'Marketing', nome: 'Divulga', icone: '📣', frase: 'Posta os clientes no Facebook e Instagram', site: 'https://www.instagram.com/nexiabodycoach/', painel: 'https://github.com/gilcambe/nexia/actions/workflows/divulga.yml', tipo: 'produto' },
  { id: 'bezsan', logo: '/central/logos/bezsan.svg', segmento: 'Leilões', nome: 'Bezsan Leilões', icone: '🏛️', frase: 'Cliente: site e agenda de reuniões', site: 'https://bezsan.pages.dev/', painel: 'https://bezsan.pages.dev/agenda/', suporte: 'bezsan', tipo: 'cliente' },
  { id: 'studiolima', segmento: 'Estética', nome: 'Studio Lima', icone: '✨', frase: 'Cliente: estética, site e agenda', site: 'https://studiolima.pages.dev/', painel: 'https://studiolima.pages.dev/agenda/', suporte: 'studiolima', tipo: 'cliente' },
  // Clientes antigos (#1003). EV Supplements não é mais cliente e MyCoach virou o Body Coach: não entram.
  { id: 'ces', logo: '/central/logos/ces.svg', segmento: 'Eventos', nome: 'CES Brasil 2027', icone: '🌐', frase: 'Cliente: missão empresarial (evento)', site: BASE + '/ces', painel: BASE + '/ces', tipo: 'cliente' },
  { id: 'vp', logo: '/central/logos/vp.svg', segmento: 'Viagens', nome: 'Viajante Pro', icone: '✈️', frase: 'Cliente: agência de viagens', site: BASE + '/vp', painel: BASE + '/vp', tipo: 'cliente' },
  { id: 'splash', logo: '/central/logos/splash.png', segmento: 'Eventos', nome: 'Splash Eventos', icone: '💧', frase: 'Cliente: locação de espaços para eventos', site: BASE + '/splash', painel: BASE + '/splash', tipo: 'cliente' },
  // O site do Adriano entra quando a landing nova for publicada em https://adrianoblumer.pages.dev.
  { id: 'adriano', logo: '/central/logos/adriano.png', segmento: 'Nutrição', nome: 'Adriano Blumer', icone: '🥗', frase: 'Cliente: nutricionista (landing com WhatsApp e redes)', pendente: true, tipo: 'cliente' },
  // Copiloto e treino para atendentes de call center (nome neutro; nada de material de empresa anterior entra no produto).
  { id: 'atende', segmento: 'Atendimento', nome: 'Atende', icone: '🎧', frase: 'Em preparação: copiloto e treino de ligação para atendentes', pendente: true, tipo: 'produto' },
  { id: 'arqia', segmento: 'Arquitetura', nome: 'Arqia', icone: '📐', frase: 'Produto futuro: sistema para arquitetos', pendente: true, tipo: 'produto' },
  { id: 'kernex', segmento: 'Sites', nome: 'Site da Kernex', icone: '🌐', frase: 'Site institucional da Kernex', site: 'https://kernex.com.br/', tipo: 'produto' },
  { id: 'vault', segmento: 'Dados', nome: 'Vault', icone: '🔐', frase: 'Cofre de segredos e configurações', tipo: 'produto' },
  { id: 'sitekit', segmento: 'Sites', nome: 'Site Kit', icone: '🧰', frase: 'Kit de sites para clientes', tipo: 'produto' },
];

// Só os que têm site no ar entram nas medições de saúde.
const NO_AR = PRODUTOS.filter((p) => p.site && !p.pendente);

const LINKS = [
  { nome: 'Firebase (banco e logins)', url: 'https://console.firebase.google.com/' },
  { nome: 'Cloudflare (sites no ar)', url: 'https://dash.cloudflare.com/' },
  { nome: 'GitHub (código e robôs)', url: 'https://github.com/gilcambe/nexia' },
  { nome: 'Google Play (app Android)', url: 'https://play.google.com/console' },
  { nome: 'Facebook e Instagram (Meta)', url: 'https://business.facebook.com/' },
  { nome: 'Shopee Afiliados (comissões)', url: 'https://affiliate.shopee.com.br/' },
  { nome: 'Amazon Associados (comissões)', url: 'https://associados.amazon.com.br/' },
  { nome: 'Google Search Console', url: 'https://search.google.com/search-console' },
  { nome: 'Gmail da Kernex', url: 'https://mail.google.com/' },
];

// Robôs que a Central pode mandar rodar (arquivo do GitHub Actions → nome simples e o que mandar).
const ROBOS = [
  { arquivo: 'divulga.yml', nome: 'Divulgação', inputs: { acao: 'rodar' } },
  { arquivo: 'afiliados.yml', nome: 'Ofertas (afiliados)', inputs: { acao: 'rodar' } },
  { arquivo: 'fila-cortex.yml', nome: 'Fila do Cortex', inputs: {} },
  { arquivo: 'smoke.yml', nome: 'Teste rápido do site', inputs: { url: BASE } },
  { arquivo: 'vigia-cortex.yml', nome: 'Vigia do Cortex', inputs: {} },
  { arquivo: 'teste-coach.yml', nome: 'Teste do coach com IA', inputs: { url: BASE } },
  { arquivo: 'teste-humano.yml', nome: 'Teste de pessoa no Body Coach', inputs: {} },
  { arquivo: 'body-coach-pages.yml', nome: 'Publicação do Body Coach', inputs: {} },
  { arquivo: 'android-play.yml', nome: 'App Android (Google Play)', inputs: {} },
  { arquivo: 'nexia-jobs.yml', nome: 'Trabalhos do Cortex', inputs: null },
  { arquivo: 'smoke-logado.yml', nome: 'Teste completo com login', inputs: null },
  { arquivo: 'deploy-cloudflare.yml', nome: 'Publicação do site', inputs: null },
  { arquivo: 'ci.yml', nome: 'Conferência do código', inputs: null },
];

module.exports = { PRODUTOS, NO_AR, LINKS, ROBOS, BASE };
