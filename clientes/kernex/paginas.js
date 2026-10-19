'use strict';
// Páginas extras do site da Kernex (o renderizar-site.js chama este arquivo quando ele existe na pasta do cliente):
//   - SEO (#1009): sitemap.xml, robots.txt, canonical, og:image e JSON-LD Organization no index.html;
//   - privacidade.html e termos.html únicos (LGPD) com links no rodapé (#1011);
//   - body-coach.html e sites.html: página de venda de cada produto (#1018). Depoimentos só se houver
//     depoimentos reais em depoimentos.json (começa vazio: nunca inventar);
//   - bloco "Indique um negócio" no index.html, que grava em /api/leads com origem 'indicacao' (#1019).
// Preços do Body Coach = os que estão no app (apps/body-coach/src/lib/acesso.ts e pages/conheca).
const fs = require('fs');
const path = require('path');

const SITE = 'https://kernex.com.br';
const EMAIL = 'contato@kernex.com.br';
const WHATS = '5511944037259';
const LEADS_API = 'https://nexia.gcbezerra.workers.dev/api/leads';
const FRASE = 'Inteligência que resolve.';
const OG_IMAGE = '../../brand/kernex/logo-fundo-claro.png';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const zap = texto => `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`;

const ESTILO = `<style>
.pg{padding:7rem 0 4rem}.pg h1{font-family:var(--font-head);font-size:clamp(1.9rem,4vw,2.8rem);margin:0 0 .6rem;color:var(--text)}
.pg h2{font-family:var(--font-head);margin:2.4rem 0 .8rem;color:var(--text)}.pg p,.pg li{color:var(--muted);line-height:1.65}
.pg .lead{font-size:1.15rem}.pg .grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.pg .box{background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow);padding:1.2rem 1.4rem}
.pg .box h3{margin:.2rem 0 .4rem;color:var(--text)}.pg .preco{font-size:1.6rem;font-weight:700;color:var(--primary)}
.pg details{background:var(--surface);border-radius:var(--radius);padding:.9rem 1.1rem;margin:.5rem 0}.pg summary{cursor:pointer;font-weight:600;color:var(--text)}
.pg .acoes{display:flex;flex-wrap:wrap;gap:.8rem;margin:1.4rem 0}.pg-top{position:fixed;inset:0 0 auto;background:var(--dark);z-index:5}
.pg-top .container{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem 0}.pg-top a{color:#fff;text-decoration:none;font-weight:600}
.pg-rodape{background:var(--dark);color:#cbd5e1;padding:2rem 0;font-size:.9rem}.pg-rodape a{color:#fff}
</style>`;

function pagina({ arquivo, titulo, descricao, corpo }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)} — Kernex</title>
  <meta name="description" content="${esc(descricao)}">
  <link rel="canonical" href="${SITE}/${arquivo}">
  <meta property="og:title" content="${esc(titulo)} — Kernex">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SITE}/assets/${path.basename(OG_IMAGE)}">
  <link rel="icon" href="assets/simbolo.svg">
  <link rel="stylesheet" href="styles.css">
  ${ESTILO}
</head>
<body>
  <header class="pg-top"><div class="container"><a href="./">Kernex</a><a href="./#contato">Contato</a></div></header>
  <main class="pg"><div class="container container--narrow">
${corpo}
  </div></main>
  <footer class="pg-rodape"><div class="container">© <span data-year>${new Date().getFullYear()}</span> Kernex · ${FRASE} · <a href="privacidade.html">Privacidade</a> · <a href="termos.html">Termos</a> · <a href="mailto:${EMAIL}">${EMAIL}</a></div></footer>
</body>
</html>
`;
}

const faq = itens => itens.map(([p, r]) => `<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('\n');
const lista = itens => `<div class="grid">${itens.map(([t, x]) => `<div class="box"><h3>${esc(t)}</h3><p>${esc(x)}</p></div>`).join('')}</div>`;

function depoimentosHtml(deps, produto) {
  const reais = (Array.isArray(deps) ? deps : []).filter(d => d && d.nome && d.texto && (!d.produto || d.produto === produto));
  if (!reais.length) return '';
  return `<section class="depoimentos"><h2>Depoimentos</h2>${lista(reais.map(d => [d.nome, `“${d.texto}”`]))}</section>`;
}

function bodyCoach(deps) {
  return pagina({
    arquivo: 'body-coach.html',
    titulo: 'Body Coach',
    descricao: 'App de treino e dieta para personal trainer e aluno. Plano Básico grátis, Premium com 14 dias grátis.',
    corpo: `<h1>Body Coach</h1>
<p class="lead">O Body Coach é um app de treino e dieta com inteligência artificial. O aluno registra treinos, refeições e medidas e vê a evolução. O personal acompanha todos os alunos num lugar só.</p>
<h2>Para quem é</h2>
<p>Para personal trainers e nutricionistas que acompanham alunos, e para quem treina sozinho e quer um plano simples.</p>
<h2>Benefícios</h2>
${lista([['Treino e dieta no celular', 'Tudo no app, sem planilha nem papel.'], ['Evolução visível', 'Medidas, fotos opcionais e gráficos de progresso.'], ['Coach com IA', 'Dúvidas respondidas na hora, com o personal no controle.'], ['Funciona no Android e na web', 'Instala como app e abre em qualquer navegador.']])}
<h2>Preço</h2>
<div class="grid">
  <div class="box"><h3>Básico</h3><p class="preco">Grátis</p><p>Para sempre.</p></div>
  <div class="box"><h3>Premium</h3><p class="preco">R$ 19,90/mês</p><p>ou R$ 179 por ano. <strong>14 dias grátis</strong> para testar.</p></div>
  <div class="box"><h3>Coach (personal)</h3><p class="preco">a partir de R$ 49/mês</p><p>Grátis até 3 alunos; R$ 49 até 15, R$ 89 até 40, R$ 149 ilimitado.</p></div>
</div>
<p>Pagamento por Pix. Cancele quando quiser.</p>
<div class="acoes"><a class="btn btn--primary" href="https://nexiabodycoach.pages.dev" target="_blank" rel="noopener">Testar grátis</a><a class="btn" href="${zap('Olá! Quero saber mais sobre o Body Coach.')}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>
${depoimentosHtml(deps, 'body-coach')}
<h2>Perguntas frequentes</h2>
${faq([
  ['É grátis mesmo?', 'Sim. O plano Básico é grátis para sempre. O Premium tem 14 dias grátis e você só continua se quiser.'],
  ['Como pago?', 'Por Pix, direto no app. Sem cartão.'],
  ['Posso cancelar?', 'Sim, a qualquer hora. E nos primeiros 7 dias você pode pedir o dinheiro de volta.'],
  ['Funciona no iPhone?', 'Sim, pelo navegador. No Android também dá para instalar como app.'],
  ['Meus dados ficam seguros?', 'Ficam no Google Firebase. Você pode apagar a sua conta e tudo some. Veja a página de Privacidade.'],
  ['Sou personal: meus alunos pagam?', 'Você escolhe: o plano Coach cobre seus alunos, ou cada aluno assina o Premium.'],
])}`,
  });
}

function sites(deps) {
  return pagina({
    arquivo: 'sites.html',
    titulo: 'Sites para negócios',
    descricao: 'Site profissional com agenda e assistente para pequenos negócios. Preço sob consulta.',
    corpo: `<h1>Sites para negócios</h1>
<p class="lead">A Kernex monta o site do seu negócio, rápido e bonito no celular. Pode vir com agenda online e um assistente que responde dúvidas. Você só conta o que precisa; a gente publica e cuida.</p>
<h2>Para quem é</h2>
<p>Para clínicas, estúdios, prestadores de serviço, lojas e qualquer pequeno negócio que quer ser achado no Google e receber contatos.</p>
<h2>Benefícios</h2>
${lista([['Pronto em poucos dias', 'Você manda as informações e as fotos; o resto é com a gente.'], ['Agenda online', 'Seus clientes marcam horário sem ligar.'], ['Contatos no WhatsApp', 'Formulário e botão que levam direto para você.'], ['Suporte de verdade', 'Ajustes e ajuda sempre que precisar.']])}
<h2>Preço</h2>
<div class="box"><p class="preco">Sob consulta</p><p>Depende do que o seu negócio precisa. Chame no WhatsApp e receba o orçamento.</p></div>
<div class="acoes"><a class="btn btn--primary" href="${zap('Olá! Quero um site para o meu negócio.')}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>
${depoimentosHtml(deps, 'sites')}
<h2>Perguntas frequentes</h2>
${faq([
  ['Quanto tempo leva?', 'Em geral, poucos dias depois de recebermos as informações.'],
  ['Preciso entender de tecnologia?', 'Não. Você conversa com a gente pelo WhatsApp e aprova o resultado.'],
  ['Posso usar o meu domínio?', 'Sim. Se ainda não tiver, ajudamos a escolher.'],
  ['Dá para mudar depois?', 'Sim. Textos, fotos e horários podem ser ajustados.'],
  ['Tem agenda online?', 'Tem, se você quiser: o cliente marca e você vê tudo num painel.'],
  ['Como pago?', 'Por Pix. O valor é combinado antes de começar.'],
])}`,
  });
}

function privacidade() {
  return pagina({
    arquivo: 'privacidade.html',
    titulo: 'Política de Privacidade',
    descricao: 'Como a Kernex trata os seus dados (LGPD): Body Coach, sites de clientes e Achados.',
    corpo: `<h1>Política de Privacidade</h1>
<p class="lead">Explicamos aqui, em linguagem simples, como a Kernex cuida dos seus dados, seguindo a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</p>
<h2>Quem cuida dos seus dados</h2>
<p>O controlador é <strong>Gildivan Camilo Bezerra</strong>, responsável pela marca Kernex. Contato: <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
<h2>O que coletamos em cada produto</h2>
<h3>Body Coach</h3>
<p>Conta Google (nome, e-mail e foto do perfil), treinos, refeições, medidas, check-ins e, se você quiser, fotos de evolução. Nos pagamentos por Pix, guardamos o plano, o valor e a data (não guardamos dados do seu banco).</p>
<h3>Sites de clientes</h3>
<p>Quando você preenche o formulário de contato de um site feito pela Kernex: nome, WhatsApp ou e-mail e a mensagem, para o negócio responder você.</p>
<h3>Achados</h3>
<p>Não tem conta. Os links levam para lojas parceiras (links de afiliado); a loja pode saber que você veio pelo nosso link.</p>
<h3>Indicações</h3>
<p>Quem indica um negócio informa o próprio nome e WhatsApp e os do negócio indicado, que só é contatado sobre a Kernex.</p>
<h2>Base legal</h2>
<p>Execução do contrato (para o app funcionar), consentimento (formulários e fotos opcionais), legítimo interesse (segurança e melhoria do serviço) e cumprimento de obrigação legal.</p>
<h2>Onde ficam os dados</h2>
<p>No Google Firebase (banco de dados e login) e na Cloudflare (sites e servidor). Esses serviços podem guardar dados fora do Brasil, com proteção adequada.</p>
<h2>Por quanto tempo</h2>
<p>Enquanto a sua conta existir ou enquanto o contato for útil. Depois que você pede para apagar, removemos em até 15 dias, salvo o que a lei obriga a guardar (por exemplo, registros de pagamento).</p>
<h2>Seus direitos (art. 18 da LGPD)</h2>
<ul><li>Confirmar se tratamos seus dados e ter acesso a eles;</li><li>Corrigir dados incompletos ou errados;</li><li>Pedir anonimização, bloqueio ou eliminação;</li><li>Levar seus dados para outro serviço (portabilidade);</li><li>Saber com quem compartilhamos;</li><li>Retirar o consentimento a qualquer momento.</li></ul>
<h2>Como apagar tudo</h2>
<p>No Body Coach: Perfil → Privacidade → Excluir minha conta. Ou mande um e-mail para <a href="mailto:${EMAIL}?subject=${encodeURIComponent('Apagar meus dados')}">${EMAIL}</a> com o assunto "Apagar meus dados". Respondemos em até 15 dias.</p>
<h2>Cookies</h2>
<p>Usamos só o armazenamento necessário para o login e para lembrar suas preferências. Não usamos cookies de publicidade.</p>
<p><small>Atualizada em outubro de 2026.</small></p>`,
  });
}

function termos() {
  return pagina({
    arquivo: 'termos.html',
    titulo: 'Termos de Uso',
    descricao: 'Termos de uso dos produtos Kernex: teste grátis, Pix, cancelamento e arrependimento (LGPD e CDC).',
    corpo: `<h1>Termos de Uso</h1>
<p class="lead">Regras simples para usar os produtos da Kernex. Os seus dados são tratados conforme a <a href="privacidade.html">Política de Privacidade</a> (LGPD).</p>
<h2>Teste grátis</h2>
<p>O Body Coach tem plano Básico grátis e o Premium tem 14 dias grátis. Ao fim do teste, você só paga se quiser continuar.</p>
<h2>Pagamento</h2>
<p>Os pagamentos são feitos por Pix. Sem cartão e sem cobrança automática escondida.</p>
<h2>Cancelamento</h2>
<p>Você pode cancelar a qualquer hora. O acesso continua até o fim do período já pago.</p>
<h2>Direito de arrependimento</h2>
<p>Nos primeiros 7 dias depois da compra, você pode desistir e receber o valor de volta (Código de Defesa do Consumidor, art. 49). Basta mandar um e-mail.</p>
<h2>Uso correto</h2>
<p>Não use os produtos para nada ilegal nem para prejudicar outras pessoas. As dicas de treino e dieta são educativas e não substituem médico ou nutricionista.</p>
<h2>Suporte</h2>
<p>Dúvidas, pedidos e reclamações: <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
<p><small>Atualizados em outubro de 2026.</small></p>`,
  });
}

// Bloco "Indique um negócio e ganhe 1 mês grátis" (vai no index.html, antes do contato).
function blocoIndique() {
  return `<section class="section" id="indique">
  <div class="container container--narrow">
    <header class="section__head"><h2>Indique um negócio e ganhe 1 mês grátis</h2><p>Conhece um negócio que precisa de site ou app? Indique. Quando ele fechar com a Kernex, você ganha 1 mês grátis.</p></header>
    <form class="indique" id="form-indique" style="display:grid;gap:.8rem" data-leads="${LEADS_API}" data-origem="indicacao" novalidate>
      <div class="field"><label for="ind-nome">Seu nome</label><input id="ind-nome" name="indicadoPorNome" required minlength="2" autocomplete="name"></div>
      <div class="field"><label for="ind-zap">Seu WhatsApp</label><input id="ind-zap" name="indicadoPorWhatsapp" required inputmode="tel" autocomplete="tel"></div>
      <div class="field"><label for="ind-negocio">Nome do negócio indicado</label><input id="ind-negocio" name="nome" required minlength="2"></div>
      <div class="field"><label for="ind-negocio-zap">WhatsApp do negócio</label><input id="ind-negocio-zap" name="whatsapp" required inputmode="tel"></div>
      <label style="display:flex;gap:.5rem;align-items:flex-start;font-size:.9rem"><input type="checkbox" name="consentimento" required> O negócio sabe que a Kernex vai entrar em contato (LGPD).</label>
      <button class="btn btn--primary" type="submit">Enviar indicação</button>
      <p class="form__ok" id="indique-ok" role="status" hidden>Obrigado! Recebemos a sua indicação.</p>
      <p class="form__erro" id="indique-erro" role="alert" hidden></p>
    </form>
  </div>
</section>
<script>
(function () {
  var f = document.getElementById('form-indique');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = Object.fromEntries(new FormData(f));
    var erro = document.getElementById('indique-erro');
    if (!d.indicadoPorNome || !d.indicadoPorWhatsapp || !d.nome || !d.whatsapp || !d.consentimento) { erro.textContent = 'Preencha todos os campos e marque a caixa.'; erro.hidden = false; return; }
    erro.hidden = true;
    var corpo = { nome: d.nome, whatsapp: d.whatsapp, consentimento: true, produto: 'site', origem: 'indicacao',
      indicadoPor: d.indicadoPorNome + ' (' + String(d.indicadoPorWhatsapp).replace(/\\D/g, '') + ')',
      mensagem: 'Indicação de ' + d.indicadoPorNome, site: location.hostname, pagina: location.pathname };
    fetch(f.dataset.leads, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(corpo) })
      .then(function (r) { if (!r.ok) throw new Error(); document.getElementById('indique-ok').hidden = false; f.reset(); })
      .catch(function () { erro.textContent = 'Não deu para enviar agora. Tente de novo ou chame no WhatsApp.'; erro.hidden = false; });
  });
})();
</script>
`;
}

// Bloco com os links das páginas de cada produto.
const blocoProdutos = `<section class="section" id="conheca">
  <div class="container container--narrow">
    <header class="section__head"><h2>Conheça cada produto</h2><p>Preços, perguntas frequentes e como começar.</p></header>
    <p class="acoes" style="display:flex;flex-wrap:wrap;gap:.8rem;justify-content:center"><a class="btn btn--primary" href="body-coach.html">Body Coach</a><a class="btn btn--primary" href="sites.html">Sites para negócios</a></p>
  </div>
</section>
`;

function seoHead() {
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'Kernex', url: SITE,
    logo: `${SITE}/assets/${path.basename(OG_IMAGE)}`, email: EMAIL, slogan: FRASE,
  };
  return `  <link rel="canonical" href="${SITE}/">
  <meta property="og:url" content="${SITE}/">
  <meta property="og:image" content="${SITE}/assets/${path.basename(OG_IMAGE)}">
  <script type="application/ld+json">${JSON.stringify(org)}</script>
</head>`;
}

function sitemap(paginas) {
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = ['', ...paginas].map(p => `  <url><loc>${SITE}/${p}</loc><lastmod>${hoje}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Recebe o index.html já gerado pelo Site Kit e devolve os arquivos a escrever (caminhos relativos à saída)
 * e as imagens locais a copiar para assets/.
 */
function paginasExtras({ indexHtml, base = __dirname }) {
  let deps = [];
  try { deps = JSON.parse(fs.readFileSync(path.join(base, 'depoimentos.json'), 'utf8')); } catch { deps = []; }
  const extras = {
    'body-coach.html': bodyCoach(deps),
    'sites.html': sites(deps),
    'privacidade.html': privacidade(),
    'termos.html': termos(),
  };
  let idx = indexHtml;
  if (!idx.includes('application/ld+json')) idx = idx.replace(/<meta property="og:image"[^>]*>\s*/, '').replace('</head>', seoHead());
  const posContato = idx.search(/<section[^>]*id="contato"/);
  if (posContato > 0 && !idx.includes('id="indique"')) idx = idx.slice(0, posContato) + blocoProdutos + blocoIndique() + idx.slice(posContato);
  idx = idx.replace('<a class="selo-nexia"', '<p class="footer__links"><a href="privacidade.html">Privacidade</a> · <a href="termos.html">Termos</a></p>\n      <a class="selo-nexia"');
  return {
    arquivos: {
      'index.html': idx,
      ...extras,
      'sitemap.xml': sitemap(Object.keys(extras)),
      'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
    },
    imagens: [path.resolve(base, OG_IMAGE)],
  };
}

module.exports = { paginasExtras, depoimentosHtml, SITE, EMAIL };
