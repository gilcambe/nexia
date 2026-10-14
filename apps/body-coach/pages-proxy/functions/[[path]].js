const ORIGEM = 'https://nexia.gcbezerra.workers.dev';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (url.pathname === '/') return Response.redirect(url.origin + '/body-coach/', 301);
  const headers = new Headers(request.headers);
  headers.set('X-Nexia-Proxy', '1');
  headers.delete('host');
  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  const r = await fetch(new URL(url.pathname + url.search, ORIGEM), init);
  const out = new Response(r.body, r);
  const loc = out.headers.get('Location');
  if (loc && loc.startsWith(ORIGEM)) out.headers.set('Location', url.origin + loc.slice(ORIGEM.length));
  return out;
}
