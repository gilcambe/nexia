#!/usr/bin/env node
'use strict';
// NEXIA — conversa de teste com o coach do Body Coach no site no ar (só pela API).
// Entra com um usuário temporário, manda "Olá" e algumas frases comuns, imprime as respostas reais.
// Uso (no GitHub Actions): BASE=https://... FIREBASE_SERVICE_ACCOUNT_BASE64=... node scripts/teste-coach-ao-vivo.js
const { createTokenSource, signRS256, b64url } = require('../lib/firebase-lite/google-auth');

const BASE = String(process.env.BASE || '').replace(/\/+$/, '');
const UID = 'nexia-coach-teste';
const FRASES = (process.env.FRASES ? process.env.FRASES.split('|') : [
  'Olá', 'Tudo bem e vc?', 'hoje tô meio cansado', 'vou treinar perna daqui a pouco', 'Quanta proteína eu preciso comer?',
]);

async function main() {
  if (!/^https:\/\//.test(BASE)) throw new Error('BASE precisa começar com https://');
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const cfg = await fetch(`${BASE}/api/firebase-config`).then(r => r.json());
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, sub: sa.client_email, iat, exp: iat + 3600, uid: UID,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit' }));
  const custom = `${header}.${claims}.${b64url(await signRS256(sa.private_key, `${header}.${claims}`))}`;
  const lr = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(cfg.apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const lj = await lr.json().catch(() => ({}));
  if (!lj.idToken) throw new Error(`login de teste falhou: ${lr.status}`);
  const contexto = { apelido: 'Rafa', name: 'Rafa', objetivo: 'hipertrofia', nivel: 'intermediario', limitacoes: [], readinessScore: 72, calories: 1400, caloriesTarget: 2400, protein: 80, proteinTarget: 150 };
  const historico = [];
  const linhas = [];
  try {
    for (const frase of FRASES) {
      const r = await fetch(`${BASE}/api/body-coach-ai`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lj.idToken}` },
        body: JSON.stringify({ message: frase, role: 'coach', context: contexto, history: historico.slice(-10) }) });
      const j = await r.json().catch(() => ({}));
      const resposta = j.reply || `(sem resposta: ${r.status} ${j.error || ''})`;
      linhas.push(`ALUNO: ${frase}\nCOACH: ${resposta}\n`);
      historico.push({ role: 'user', content: frase }, { role: 'assistant', content: j.reply || '' });
    }
  } finally {
    const t = await createTokenSource(sa).getToken();
    await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:delete`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ localId: UID }) }).catch(() => {});
  }
  const texto = linhas.join('\n');
  console.log(texto);
  const esc = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::notice title=Conversa com o coach::${esc(texto)}`);
}
main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
