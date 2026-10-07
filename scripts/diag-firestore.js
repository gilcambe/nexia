// Diagnóstico do Firestore: mostra só status e a mensagem de erro (nunca dados nem segredos).
const { createTokenSource } = require('../lib/firebase-lite/google-auth');

async function main() {
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const token = await createTokenSource(sa).getToken();
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const rd = await fetch(`${base}/nexia_clients?pageSize=1`, { headers: h });
  console.log('Leitura:', rd.status, (await rd.text()).slice(0, 400).replace(/"(name|stringValue)":\s*"[^"]*"/g, '"$1":"…"'));
  const wr = await fetch(`${base}/diag_tmp/ping`, { method: 'PATCH', headers: h, body: JSON.stringify({ fields: { t: { stringValue: new Date().toISOString() } } }) });
  console.log('Escrita:', wr.status, (await wr.text()).slice(0, 400));
  if (wr.ok) await fetch(`${base}/diag_tmp/ping`, { method: 'DELETE', headers: h });
}
main().catch(e => { console.log('Erro:', e.message); process.exit(1); });
