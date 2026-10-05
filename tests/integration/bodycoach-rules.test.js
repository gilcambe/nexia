'use strict';
// Regras do NEXIA Body Coach (ADR-CLONE-02) no Emulator. Rodar com: npm run test:rules
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

let env;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-nexia';

test.before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'), host, port: Number(port) },
  });
});
test.after(async () => { if (env) await env.cleanup(); });
test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc('bodycoach_users/bob/meals/m1').set({ name: 'Almoço do Bob', calories: 600, protein: 40, carbs: 60, fat: 20 });
  });
});

const as = uid => env.authenticatedContext(uid).firestore();
const meal = { name: 'Café da manhã', meal_time: '07:30', calories: 450, protein: 30, carbs: 50, fat: 12, fiber: 6, created_at: '2026-10-05T10:00:00.000Z' };

test('BC1. atleta grava e lê as próprias refeições, check-in, progresso, exames e perfil', async () => {
  const db = as('alice');
  await assertSucceeds(db.doc('bodycoach_users/alice/meals/m1').set(meal));
  await assertSucceeds(db.doc('bodycoach_users/alice/meals/m1').get());
  await assertSucceeds(db.doc('bodycoach_users/alice/daily_readiness/2026-10-05').set({ check_in_date: '2026-10-05', sleep_hours: 7, readiness_score: 72, notes: null }));
  await assertSucceeds(db.doc('bodycoach_users/alice/progress_entries/1').set({ id: 1, weight_kg: 80, body_fat_pct: 15, measurements: { cintura: 84 }, image_url: 'data:image/jpeg;base64,AAAA', notes: null, taken_at: '2026-10-05T10:00:00.000Z' }));
  await assertSucceeds(db.doc('bodycoach_users/alice/medical_exams/1').set({ id: 1, exam_type: 'Hemograma', title: 'Hemograma', file_url: null, notes: null, taken_at: '2026-10-05T10:00:00.000Z' }));
  await assertSucceeds(db.doc('bodycoach_users/alice/profile/main').set({ full_name: 'Alice', email: 'alice@a.com', height_cm: 170 }));
  await assertSucceeds(db.collection('bodycoach_users/alice/meals').get());
  await assertSucceeds(db.doc('bodycoach_users/alice/meals/m1').delete());
});

test('BC2. ninguém lê nem grava dados de outro atleta', async () => {
  await assertFails(as('alice').doc('bodycoach_users/bob/meals/m1').get());
  await assertFails(as('alice').collection('bodycoach_users/bob/meals').get());
  await assertFails(as('alice').doc('bodycoach_users/bob/meals/m2').set(meal));
  await assertFails(as('alice').doc('bodycoach_users/bob/meals/m1').delete());
  await assertFails(env.unauthenticatedContext().firestore().doc('bodycoach_users/bob/meals/m1').get());
});

test('BC3. formatos inválidos, coleções fora da lista e arquivos grandes são negados', async () => {
  const db = as('alice');
  await assertFails(db.doc('bodycoach_users/alice/meals/m2').set({ name: '', calories: 1, protein: 1, carbs: 1, fat: 1 }));
  await assertFails(db.doc('bodycoach_users/alice/meals/m2').set({ ...meal, calories: 'muito' }));
  await assertFails(db.doc('bodycoach_users/alice/meals/m2').set({ ...meal, user_id: 'bob' }));
  await assertFails(db.doc('bodycoach_users/alice/daily_readiness/x').set({ check_in_date: 'ontem' }));
  await assertFails(db.doc('bodycoach_users/alice/segredos/x').set({ a: 1 }));
  await assertFails(db.doc('bodycoach_users/alice/medical_exams/2').set({ title: 'PDF enorme', taken_at: '2026-10-05', file_url: 'x'.repeat(900001) }));
});
