'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { prefsLimpas, horariosDe } = require('../../netlify/functions/body-coach/push.js');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');

test('lembretes inteligentes: horários aprendidos pelo uso', async () => {
  const out = ts.transpileModule(fs.readFileSync(path.join(SRC, 'lib/horariosAprendidos.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const f = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'ha-')), 'h.mjs');
  fs.writeFileSync(f, out);
  const m = await import(f);
  const agora = new Date(2026, 9, 19, 22, 0);
  const dia = (d, h, min = 0) => new Date(2026, 9, d, h, min).toISOString();
  const refeicoes = [
    { time: '12:10', created_at: dia(15, 12) }, { time: '12:30', created_at: dia(16, 12) }, { time: '12:20', created_at: dia(17, 12) },
    { time: '20:00', created_at: dia(15, 20) }, { time: '19:40', created_at: dia(16, 19) }, { time: '20:10', created_at: dia(17, 20) },
    { time: '07:00', created_at: dia(1, 7) }, // grupo de 1 só: não vira lembrete, mas abre a janela da água
    { time: '03:00', created_at: new Date(2026, 7, 1).toISOString() }, // velho: ignorado
  ];
  const treinos = [dia(15, 19, 0), dia(16, 19, 10), dia(17, 18, 50)];
  const a = m.aprenderHorarios(refeicoes, treinos, agora);
  assert.deepEqual(a.refeicoes, ['12:20', '20:00']);
  assert.equal(a.treino, '17:30'); // 30 min antes de começar (treino acaba ~19:00)
  assert.deepEqual(a.agua, { de: '07:00', ate: '20:10' });
  const p = m.aplicarAprendido({ treino: { ativo: true, hora: '18:00' }, agua: { ativo: false, de: '08:00', ate: '20:00', cada: 2 } }, a);
  assert.equal(p.treino.hora, '17:30');
  assert.deepEqual(p.refeicao, { ativo: false, horas: ['12:20', '20:00'] });
  assert.deepEqual(m.aprenderHorarios([], [], agora), { treino: null, refeicoes: [], agua: null });
});

test('servidor: lembrete de refeição entra nos horários e "auto" é guardado', () => {
  const p = prefsLimpas({ refeicao: { ativo: true, horas: ['19:32', '12:00', 'xx'] }, auto: true });
  assert.deepEqual(p.refeicao.horas, ['12:00', '19:32']);
  assert.equal(p.auto, true);
  assert.deepEqual(horariosDe(p), ['12:00', '19:30']);
  assert.deepEqual(horariosDe(prefsLimpas({})), []);
  assert.match(fs.readFileSync(path.join(SRC, 'pages/avisos/page.tsx'), 'utf8'), /Usar meus horários agora/);
});
