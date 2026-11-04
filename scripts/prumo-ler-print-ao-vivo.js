// Teste ao vivo da leitura de print do Prumo com as chaves reais (roda no GitHub Actions).
// Uso: node scripts/prumo-ler-print-ao-vivo.js [imagem.jpg]
const fs = require('fs');
const p = require('../netlify/functions/prumo.js');

(async () => {
  const arq = process.argv[2] || 'tests/fixtures/prumo-print-exemplo.jpg';
  const data = fs.readFileSync(arq).toString('base64');
  const router = p.deps.getRouter();
  for (const d of [{ provider: 'google', model: 'gemini-2.5-flash-lite' }, { provider: 'gemini', model: 'gemini-2.5-flash-lite' }]) {
    try { console.log(d.provider, d.model, JSON.stringify(router.capabilities(d))); } catch (e) { console.log(d.provider, 'sem provedor:', e.message); }
  }
  for (const d of [{ provider: 'google', model: 'gemini-2.5-flash-lite' }, { provider: 'gemini', model: 'gemini-2.5-flash-lite' }]) {
    try {
      const o = await router.chat(d, { messages: [{ role: 'user', content: 'Diga só: ok' }], maxTokens: 50 });
      console.log('texto sem imagem', d.provider, 'OK:', (o.text || '').slice(0, 40));
    } catch (e) { console.log('texto sem imagem', d.provider, 'ERRO', e.code, e.status, String(e.upstream || '').slice(0, 300), String(e.message).slice(0, 300)); }
  }
  try {
    await router.chat({ provider: 'google', model: 'gemini-2.5-flash-lite' }, { messages: [{ role: 'user', content: 'Leia' }], images: [{ mime: 'image/jpeg', data }], maxTokens: 500 });
    console.log('com imagem OK');
  } catch (e) { console.log('com imagem ERRO', e.code, e.status, String(e.upstream || '').slice(0, 300), JSON.stringify(e).slice(0, 400), String(e.message).slice(0, 300)); }
  const avisos = []; const warn = console.warn; console.warn = (...a) => { avisos.push(a.join(' ')); warn(...a); };
  const t = Date.now();
  const r = await p.lerPrint([{ mime: 'image/jpeg', data }], p.deps);
  console.log('tempo', Date.now() - t, 'ms');
  console.log('resultado', JSON.stringify(r, null, 2));
  if (!r || !r.itens.length) { console.error('FALHOU', avisos.join('\n')); process.exit(1); }
})();
