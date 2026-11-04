// Mede o tempo real da API do Fortune no ar com um usuário de TESTE (nunca o do dono).
// Precisa de FIREBASE_SERVICE_ACCOUNT_BASE64 e FIREBASE_API_KEY. Uso: node scripts/fortune-api-ao-vivo.js
const crypto = require('crypto');
const BASE = process.env.FORTUNE_URL || 'https://nexia.gcbezerra.workers.dev';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
(async () => {
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, sub: sa.client_email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: agora, exp: agora + 3600, uid: 'teste-fortune-robo' })}`;
  const tokenCustom = `${corpo}.${crypto.createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url')}`;
  const chave = process.env.FIREBASE_API_KEY || (await (await fetch(`${BASE}/api/firebase-config`)).json()).apiKey;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${chave}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenCustom, returnSecureToken: true }) });
  const { idToken, error } = await r.json();
  if (!idToken) { console.error('sem token de teste:', error && error.message); process.exit(1); }
  for (const acao of ['carteira_listar', 'objetivo_listar', 'avisos', 'gasto_listar', 'lista_listar', 'historico_listar']) {
    const t = Date.now();
    try {
      const x = await fetch(`${BASE}/api/prumo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken }, body: JSON.stringify({ acao }), signal: AbortSignal.timeout(60000) });
      const txt = await x.text();
      console.log(acao, x.status, (Date.now() - t) + 'ms', txt.slice(0, 120));
    } catch (e) { console.log(acao, 'ERRO', (Date.now() - t) + 'ms', e.message); }
  }
  // Leitura de print no ar, só com o print FALSO de exemplo (nunca prints reais de usuário).
  const t = Date.now();
  try {
    const data = require('fs').readFileSync(require('path').join(__dirname, '../tests/fixtures/prumo-print-exemplo.jpg')).toString('base64');
    const x = await fetch(`${BASE}/api/prumo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken }, body: JSON.stringify({ acao: 'ler_print', imagens: [{ mime: 'image/jpeg', data }] }), signal: AbortSignal.timeout(190000) });
    const txt = await x.text();
    console.log('ler_print no ar', x.status, (Date.now() - t) + 'ms', txt.slice(0, 600));
  } catch (e) { console.log('ler_print no ar ERRO', (Date.now() - t) + 'ms', e.message); }
})();
