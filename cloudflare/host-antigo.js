'use strict';
// #1967: o dono não quer "nexia" no endereço. Páginas abertas no endereço antigo do Worker vão para o domínio KERNEX
// (302 na 1ª semana, mesmo caminho e query). A API, os arquivos, /.well-known, /body-coach e o proxy do Body Coach continuam no
// endereço antigo: sites de clientes, a Central, robôs, workflows e apps instalados chamam a API por ele.
const HOST_ANTIGO = 'nexia.gcbezerra.workers.dev';
const DESTINO = 'https://cortex.kernex.com.br';
const DESTINO_FINANCE = 'https://finance.kernex.com.br';
const PREFIXOS_FORA = ['/api', '/nexia/', '/.well-known/', '/functions', '/body-coach'];
const ARQUIVO = /\.(js|mjs|json|webmanifest|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map|txt|xml)$/i;

/** Devolve o redirecionamento quando a página deve ir para o domínio KERNEX; null quando segue como hoje. */
function redirecionarHostAntigo(request) {
  const url = new URL(request.url);
  if (url.hostname !== HOST_ANTIGO) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (!String(request.headers.get('Accept') || '').includes('text/html')) return null;
  if (request.headers.get('X-Nexia-Proxy')) return null;
  // Na dúvida, não redireciona: qualquer caminho que comece com um prefixo protegido segue como hoje.
  if (PREFIXOS_FORA.some(p => url.pathname.startsWith(p) || url.pathname === p.replace(/\/$/, ''))) return null;
  if (ARQUIVO.test(url.pathname)) return null;
  // Kernex Finance tem domínio próprio (login autorizado lá); o resto vai para o Cortex/Central.
  const destino = url.pathname === '/prumo' || url.pathname.startsWith('/prumo/') ? DESTINO_FINANCE : DESTINO;
  // 302 e sem cache na 1ª semana (revisão do PC 2): dá para voltar atrás; depois de conferido, trocar para 301.
  return new Response(null, { status: 302, headers: { Location: `${destino}${url.pathname}${url.search}`, 'Cache-Control': 'no-store' } });
}

module.exports = { redirecionarHostAntigo, HOST_ANTIGO, DESTINO };
