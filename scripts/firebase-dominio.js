// Libera domínios no login do Firebase (Authentication > Authorized domains). Só ADICIONA, nunca remove.
// Uso: FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/firebase-dominio.js dominio1 dominio2
const crypto = require('crypto');

async function token(sa) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 })}`;
  const assinatura = crypto.createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assinatura}` });
  const j = await r.json();
  if (!j.access_token) throw new Error('sem token: ' + r.status);
  return j.access_token;
}

async function main() {
  const novos = process.argv.slice(2).filter(Boolean);
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString('utf8'));
  const t = await token(sa);
  const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config`;
  const h = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': sa.project_id };
  const atual = await (await fetch(base, { headers: h })).json();
  const lista = atual.authorizedDomains || [];
  const faltam = novos.filter((d) => !lista.includes(d));
  if (!faltam.length) { console.log('Domínios já liberados:', novos.join(', ')); return; }
  const r = await fetch(`${base}?updateMask=authorizedDomains`, { method: 'PATCH', headers: h, body: JSON.stringify({ authorizedDomains: [...lista, ...faltam] }) });
  if (!r.ok) throw new Error('Firebase recusou: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  console.log('Liberados no login do Firebase:', faltam.join(', '));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
