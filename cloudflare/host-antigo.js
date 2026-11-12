'use strict';
// #1967: o dono não quer "nexia" no endereço. Páginas abertas no endereço antigo do Worker vão para o domínio KERNEX
// (301, mesmo caminho e query). A API, os arquivos, /.well-known, /body-coach e o proxy do Body Coach continuam no
// endereço antigo: sites de clientes, a Central, robôs, workflows e apps instalados chamam a API por ele.
const HOST_ANTIGO = 'nexia.gcbezerra.workers.dev';
const DESTINO = 'https://cortex.kernex.com.br';
const PREFIXOS_FORA = ['/api', '/nexia/', '/.well-known/', '/functions', '/body-coach'];
const ARQUIVO = /\.(js|mjs|json|webmanifest|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map|txt|xml)$/i;

/** Devolve a resposta 301 quando a página deve ir para o domínio KERNEX; null quando segue como hoje. */
function redirecionarHostAntigo(request) {
  const url = new URL(request.url);
  if (url.hostname !== HOST_ANTIGO) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (!String(request.headers.get('Accept') || '').includes('text/html')) return null;
  if (request.headers.get('X-Nexia-Proxy')) return null;
  // Na dúvida, não redireciona: qualquer caminho que comece com um prefixo protegido segue como hoje.
  if (PREFIXOS_FORA.some(p => url.pathname.startsWith(p) || url.pathname === p.replace(/\/$/, ''))) return null;
  if (ARQUIVO.test(url.pathname)) return null;
  return new Response(null, { status: 301, headers: { Location: `${DESTINO}${url.pathname}${url.search}`, 'Cache-Control': 'public, max-age=3600' } });
}

module.exports = { redirecionarHostAntigo, HOST_ANTIGO, DESTINO };
