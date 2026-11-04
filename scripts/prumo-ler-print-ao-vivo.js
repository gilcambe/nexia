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
  for (const d of p.VISAO) {
    const t0 = Date.now();
    try {
      if (!router.capabilities(d).vision) { console.log('com imagem PULA (sem visão ou sem chave)', d.provider, d.model); continue; }
      const o = await router.chat(d, { messages: [{ role: 'user', content: 'Leia' }], images: [{ mime: 'image/jpeg', data }], maxTokens: 300 });
      console.log('com imagem OK', Date.now() - t0, 'ms', d.provider, d.model, (o.text || '').slice(0, 80).replace(/\n/g, ' '));
    } catch (e) { const x = e.details || {}; console.log('com imagem ERRO', d.provider, d.model, x.status || e.code, String(x.upstream || e.message).slice(0, 220).replace(/\n/g, ' ')); }
  }
  // Mede o modelo principal com o pedido real e limites diferentes de resposta.
  for (const mt of [1500, 4000]) {
    const t0 = Date.now();
    try {
      const o = await router.chat(p.VISAO[0], { system: p.LER_PRINT, messages: [{ role: 'user', content: 'Leia este print e devolva o JSON.' }], images: [{ mime: 'image/jpeg', data }], maxTokens: mt, temperature: 0, timeoutMs: 110000 });
      console.log('pedido real', mt, 'OK', Date.now() - t0, 'ms', (o.text || '').length, 'letras', (o.text || '').slice(-120).replace(/\n/g, ' '));
    } catch (e) { console.log('pedido real', mt, 'ERRO', Date.now() - t0, 'ms', e.code || e.message); }
  }
  const avisos = []; const warn = console.warn; console.warn = (...a) => { avisos.push(a.join(' ')); warn(...a); };
  const t = Date.now();
  const r = await p.lerPrint([{ mime: 'image/jpeg', data }], p.deps);
  console.log('tempo', Date.now() - t, 'ms');
  console.log('resultado', JSON.stringify(r, null, 2));
  if (!r || !r.itens.length) { console.error('FALHOU', avisos.join('\n')); process.exit(1); }
})();
