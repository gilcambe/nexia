'use strict';
// Conta de teste para o "teste de pessoa": cria uma conta real e temporária no Firebase Auth (e-mail e senha),
// e depois apaga a conta e os dados dela. Imprime só o e-mail de teste; a senha vai para o ambiente do job.
// Uso: node scripts/teste-humano-conta.js criar | apagar   (FIREBASE_SERVICE_ACCOUNT_BASE64 no ambiente)
const fs = require('fs');
const crypto = require('crypto');
const { createTokenSource } = require('../lib/firebase-lite/google-auth');

const COLECOES = ['profile', 'meals', 'workouts', 'daily_readiness', 'progress_entries', 'medical_exams'];

async function main() {
  const modo = process.argv[2];
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString('utf8'));
  const token = await createTokenSource(sa).getToken();
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const auth = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}`;
  const fsb = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const env = process.env.GITHUB_ENV;

  if (modo === 'criar') {
    const id = crypto.randomBytes(4).toString('hex');
    const email = `teste.humano.${id}@example.com`;
    const senha = `Th#${crypto.randomBytes(9).toString('base64url')}`;
    const r = await fetch(`${auth}/accounts`, { method: 'POST', headers: h, body: JSON.stringify({ email, password: senha, emailVerified: true, displayName: 'Teste Humano' }) });
    const j = await r.json();
    if (!r.ok) throw new Error(`não criou a conta de teste: ${r.status} ${j.error && j.error.message}`);
    // Perfil já respondido: a pessoa de teste cai direto no treino (como um aluno que já fez o questionário).
    const campos = { daysPerWeek: '4', level: 'intermediario', goal: 'hipertrofia', injuries: '' };
    const onboarding = { mapValue: { fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) } };
    await fetch(`${fsb}/bodycoach_users/${j.localId}/profile/main`, { method: 'PATCH', headers: h, body: JSON.stringify({ fields: { onboarding } }) });
    console.log(`::add-mask::${senha}`);
    if (env) fs.appendFileSync(env, `LOGIN_USER=${email}\nLOGIN_PASS=${senha}\nTESTE_UID=${j.localId}\n`);
    console.log(`Conta de teste criada: ${email}`);
  } else if (modo === 'apagar') {
    const uid = process.env.TESTE_UID;
    if (!uid) { console.log('Sem conta para apagar.'); return; }
    for (const c of COLECOES) {
      const l = await fetch(`${fsb}/bodycoach_users/${uid}/${c}?pageSize=100`, { headers: h });
      const docs = l.ok ? (await l.json()).documents || [] : [];
      for (const d of docs) await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: h });
    }
    const d = await fetch(`${auth}/accounts:delete`, { method: 'POST', headers: h, body: JSON.stringify({ localId: uid }) });
    console.log(d.ok ? 'Conta de teste apagada.' : `Não apagou a conta (${d.status}).`);
  } else throw new Error('Use: criar | apagar');
}
main().catch(e => { console.error(e.message); process.exit(1); });
