'use strict';
// Central NEXIA (aba Sistema): fornecedores e integradores. "chave" = nome no Worker (só diz se existe);
// "robo" = robô do GitHub que usa o serviço. Serviço novo: uma linha aqui.

const FORNECEDORES = [
  { id: 'cloudflare', nome: 'Cloudflare', grupo: 'Infraestrutura', paraQue: 'Site, API e sites dos clientes no ar', gratis: '100 mil pedidos por dia', link: 'https://dash.cloudflare.com/' },
  { id: 'firebase', nome: 'Firebase (Google)', grupo: 'Infraestrutura', paraQue: 'Banco de dados e login', gratis: '50 mil leituras e 20 mil gravações por dia', link: 'https://console.firebase.google.com/', chave: 'FIREBASE_SERVICE_ACCOUNT_BASE64' },
  { id: 'd1', nome: 'Banco reserva (Cloudflare D1)', grupo: 'Infraestrutura', paraQue: 'Entra quando o Firebase chega no limite', gratis: '5 milhões de leituras por dia', link: 'https://dash.cloudflare.com/', chave: 'NEXIA_D1_TOKEN' },
  { id: 'github', nome: 'GitHub', grupo: 'Infraestrutura', paraQue: 'Guarda o código e roda os robôs', gratis: 'Ilimitado (código aberto)', link: 'https://github.com/gilcambe/nexia', chave: 'NEXIA_JOBS_TOKEN' },
  { id: 'groq', nome: 'Groq', grupo: 'Inteligência artificial', paraQue: 'IA principal do Cortex (rápida)', gratis: 'Cota grátis diária', link: 'https://console.groq.com/', chave: 'GROQ_API_KEY' },
  { id: 'gemini', nome: 'Google Gemini', grupo: 'Inteligência artificial', paraQue: 'IA reserva, lê imagens', gratis: 'Cota grátis diária', link: 'https://aistudio.google.com/', chave: 'GEMINI_API_KEY' },
  { id: 'github-models', nome: 'GitHub Models', grupo: 'Inteligência artificial', paraQue: 'IA reserva', gratis: 'Cota grátis diária', link: 'https://github.com/marketplace/models', chave: 'GITHUB_MODELS_TOKEN' },
  { id: 'codestral', nome: 'Codestral (Mistral)', grupo: 'Inteligência artificial', paraQue: 'IA reserva para código', gratis: 'Cota grátis', link: 'https://console.mistral.ai/codestral', chave: 'CODESTRAL_API_KEY' },
  { id: 'nvidia', nome: 'NVIDIA', grupo: 'Inteligência artificial', paraQue: 'IA reserva', gratis: 'Créditos grátis', link: 'https://build.nvidia.com/', chave: 'NVIDIA_API_KEY' },
  { id: 'kilo', nome: 'Kilo', grupo: 'Inteligência artificial', paraQue: 'IA reserva (só modelos grátis)', gratis: 'Grátis, funciona sem chave', link: 'https://kilo.ai/' },
  { id: 'mistral', nome: 'Mistral', grupo: 'Inteligência artificial', paraQue: 'IA reserva', gratis: 'Cota grátis', link: 'https://console.mistral.ai/', chave: 'MISTRAL_API_KEY' },
  { id: 'openrouter', nome: 'OpenRouter', grupo: 'Inteligência artificial', paraQue: 'IA reserva (modelos grátis)', gratis: 'Modelos :free', link: 'https://openrouter.ai/', chave: 'OPENROUTER_API_KEY' },
  { id: 'workers-ai', nome: 'Cloudflare Workers AI', grupo: 'Inteligência artificial', paraQue: 'IA reserva', gratis: '10 mil unidades por dia', link: 'https://dash.cloudflare.com/', chave: 'CLOUDFLARE_AI_TOKEN' },
  { id: 'meta', nome: 'Meta (Facebook e Instagram)', grupo: 'Divulgação e vendas', paraQue: 'O robô Divulga posta nas páginas', gratis: 'Grátis', link: 'https://business.facebook.com/', robo: 'divulga.yml' },
  { id: 'shopee', nome: 'Shopee Afiliados', grupo: 'Divulgação e vendas', paraQue: 'Ofertas com comissão', gratis: 'Grátis', link: 'https://affiliate.shopee.com.br/', robo: 'afiliados.yml' },
  { id: 'amazon', nome: 'Amazon Associados', grupo: 'Divulgação e vendas', paraQue: 'Ofertas com comissão', gratis: 'Grátis', link: 'https://associados.amazon.com.br/', robo: 'afiliados.yml' },
  { id: 'brevo', nome: 'Brevo (e-mail)', grupo: 'Divulgação e vendas', paraQue: 'Avisa por e-mail de contato novo', gratis: '300 e-mails por dia', link: 'https://app.brevo.com/', chave: 'BREVO_API_KEY' },
  { id: 'pexels', nome: 'Pexels', grupo: 'Divulgação e vendas', paraQue: 'Fotos grátis para os sites', gratis: 'Grátis', link: 'https://www.pexels.com/api/', chave: 'PEXELS_API_KEY' },
  { id: 'play', nome: 'Google Play', grupo: 'Lojas de app', paraQue: 'App Android do Body Coach', gratis: 'Taxa única já paga', link: 'https://play.google.com/console', robo: 'android-play.yml' },
];

module.exports = { FORNECEDORES };
