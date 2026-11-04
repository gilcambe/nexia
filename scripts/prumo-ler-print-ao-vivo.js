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
  const avisos = []; const warn = console.warn; console.warn = (...a) => { avisos.push(a.join(' ')); warn(...a); };
  const t = Date.now();
  const r = await p.lerPrint([{ mime: 'image/jpeg', data }], p.deps);
  console.log('tempo', Date.now() - t, 'ms');
  console.log('resultado', JSON.stringify(r, null, 2));
  if (!r || !r.itens.length) { console.error('FALHOU', avisos.join('\n')); process.exit(1); }
})();
