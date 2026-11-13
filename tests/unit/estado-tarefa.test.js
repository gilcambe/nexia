'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  ESTADOS,
  estadoTarefa,
  resumoDia,
  estadoTarefas,
} = require('../../netlify/functions/central/estado-tarefas');

test('EST1. 6 estados: fila, andamento, aguardando-ia, travada, concluida, falhou', () => {
  const agora = Date.now();

  // 1. Fila (aberta, sem labels especiais)
  const f = estadoTarefa({ state: 'open', labels: [{ name: 'cortex-fila' }], updated_at: new Date(agora).toISOString() }, agora);
  assert.strictEqual(f.estado, 'fila');
  assert.strictEqual(f.texto, 'Na fila');
  assert.strictEqual(f.cor, 'cinza');
  assert.strictEqual(f.icone, '⏳');
  assert.strictEqual(f.ia, null);
  assert.strictEqual(f.precisaVoce, false);

  // 2. Em andamento (cortex-rodando e recente)
  const a = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-rodando' }],
    updated_at: new Date(agora - 5 * 60000).toISOString(),
  }, agora);
  assert.strictEqual(a.estado, 'andamento');
  assert.strictEqual(a.texto, 'Em andamento');
  assert.strictEqual(a.cor, 'azul');
  assert.strictEqual(a.icone, '⚙️');
  assert.strictEqual(a.ia, 'Cortex');
  assert.strictEqual(a.precisaVoce, false);

  // 3. Aguardando IA (jules-enviado, recente)
  const ag = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'jules-enviado' }],
    updated_at: new Date(agora - 10 * 60000).toISOString(),
  }, agora);
  assert.strictEqual(ag.estado, 'aguardando-ia');
  assert.strictEqual(ag.texto, 'Aguardando IA');
  assert.strictEqual(ag.cor, 'roxo');
  assert.strictEqual(ag.icone, '🤖');
  assert.strictEqual(ag.ia, 'Jules');
  assert.strictEqual(ag.precisaVoce, false);

  // 4. Travada (cortex-travado)
  const tr = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-travado' }],
    updated_at: new Date(agora - 5 * 60000).toISOString(),
  }, agora);
  assert.strictEqual(tr.estado, 'travada');
  assert.strictEqual(tr.texto, 'Travada');
  assert.strictEqual(tr.cor, 'laranja');
  assert.strictEqual(tr.icone, '⚠️');

  // 5. Concluída (fechada com cortex-feito)
  const c = estadoTarefa({
    state: 'closed',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-feito' }],
    updated_at: new Date(agora - 60 * 60000).toISOString(),
  }, agora);
  assert.strictEqual(c.estado, 'concluida');
  assert.strictEqual(c.texto, 'Concluída');
  assert.strictEqual(c.cor, 'verde');
  assert.strictEqual(c.icone, '✅');
  assert.strictEqual(c.precisaVoce, false);

  // 6. Falhou (fechada sem cortex-feito nem jules-feito)
  const fa = estadoTarefa({
    state: 'closed',
    labels: [{ name: 'cortex-fila' }],
    updated_at: new Date(agora - 60 * 60000).toISOString(),
  }, agora);
  assert.strictEqual(fa.estado, 'falhou');
  assert.strictEqual(fa.texto, 'Falhou');
  assert.strictEqual(fa.cor, 'vermelho');
  assert.strictEqual(fa.icone, '❌');
  assert.strictEqual(fa.precisaVoce, false);
});

test('EST2. travada por tempo (updated_at 40 min atrás + cortex-rodando)', () => {
  const agora = Date.now();
  const t40 = new Date(agora - 40 * 60000).toISOString();

  const res = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-rodando' }],
    updated_at: t40,
  }, agora, { minutosParada: 30 });

  assert.strictEqual(res.estado, 'travada');
  assert.strictEqual(res.ia, 'Cortex');
  assert.strictEqual(res.motivo, 'Sem atividade há 40 min. A IA pode ter parado.');
});

test('EST2b. fronteira: exatamente 30 min parada continua em andamento (só "mais de" 30 min trava)', () => {
  const agora = Date.now();
  const t30 = new Date(agora - 30 * 60000).toISOString();

  const res = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-rodando' }],
    updated_at: t30,
  }, agora, { minutosParada: 30 });

  assert.strictEqual(res.estado, 'andamento');
  assert.strictEqual(res.ia, 'Cortex');
});

test('EST3. precisaVoce (tentativa-3 + cortex-travado e labels de humano)', () => {
  const agora = Date.now();

  const r1 = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-travado' }, { name: 'tentativa-3' }],
    updated_at: new Date(agora).toISOString(),
  }, agora, { maxTentativas: 3 });

  assert.strictEqual(r1.estado, 'travada');
  // #3128: travada com tentativa-3 (>= maxTentativas 3) precisa de você.
  assert.strictEqual(r1.precisaVoce, true);

  // Com label vez-do-dono (o dono é acionado independente do número de tentativas)
  const r2 = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-travado' }, { name: 'tentativa-1' }, { name: 'vez-do-dono' }],
    updated_at: new Date(agora).toISOString(),
  }, agora, { maxTentativas: 3 });

  assert.strictEqual(r2.estado, 'travada');
  assert.strictEqual(r2.precisaVoce, true);

  // Travada com tentativa-2 sem label de dono: precisaVoce false
  const r3 = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'cortex-travado' }, { name: 'tentativa-2' }],
    updated_at: new Date(agora).toISOString(),
  }, agora, { maxTentativas: 3 });

  assert.strictEqual(r3.estado, 'travada');
  assert.strictEqual(r3.precisaVoce, false);
});

test('EST4. resumoDia frase e agregação', () => {
  const contagens = { andamento: 3, travada: 2, concluida: 8 };
  const ias = [
    { nome: 'Gemini', ativa: true },
    { nome: 'Groq', ligada: true },
    { nome: 'Mistral', ativa: false },
    { nome: 'Cohere', online: false },
    { nome: 'Claude', ativa: false },
  ];

  const frase = resumoDia(contagens, ias);
  assert.strictEqual(frase, 'Hoje: 3 em andamento, 2 travadas, 8 concluídas. IAs ativas: 2 de 5.');

  // Vazio
  const fraseVazia = resumoDia();
  assert.strictEqual(fraseVazia, 'Hoje: 0 em andamento, 0 travadas, 0 concluídas. IAs ativas: 0 de 0.');
});

test('EST5. estadoTarefas agrega contagens de lista de issues', () => {
  const agora = Date.now();
  const issues = [
    { state: 'open', labels: [{ name: 'cortex-fila' }] },
    { state: 'open', labels: [{ name: 'cortex-rodando' }], updated_at: new Date(agora).toISOString() },
    { state: 'open', labels: [{ name: 'cortex-travado' }, { name: 'tentativa-2' }] },
    { state: 'closed', labels: [{ name: 'cortex-feito' }] },
  ];

  const res = estadoTarefas(issues, agora);
  assert.strictEqual(res.total, 4);
  assert.strictEqual(res.fila, 1);
  assert.strictEqual(res.andamento, 1);
  // Ajuste EST5: tentativa-2 com cortex-travado (maxTentativas 3) fica em travadas, não precisaVoce
  assert.strictEqual(res.travada, 1);
  assert.strictEqual(res.precisaVoce, 0);
});

test('EST6. travada que precisa de você não conta duas vezes; resumo cita as duas', () => {
  const agora = Date.now();
  const issues = [
    { state: 'open', labels: [{ name: 'cortex-travado' }, { name: 'tentativa-1' }] },
    { state: 'open', labels: [{ name: 'cortex-travado' }, { name: 'tentativa-5' }] },
    { state: 'open', labels: [{ name: 'cortex-travado' }, { name: 'vez-do-dono' }] },
  ];
  const res = estadoTarefas(issues, agora);
  assert.strictEqual(res.travada, 2);
  assert.strictEqual(res.precisaVoce, 1);
  assert.strictEqual(resumoDia(res, []), 'Hoje: 0 em andamento, 2 travadas, 0 concluídas, 1 precisa de você. IAs ativas: 0 de 0.');
});

test('EST7. aguardando-ia cobre reserva-* e vez-do-claude com as IAs corretas', () => {
  const agora = Date.now();
  const recente = new Date(agora - 5 * 60000).toISOString();

  // reserva-tentou → aguardando-ia, IA "IAs grátis"
  const r = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'reserva-tentou' }],
    updated_at: recente,
  }, agora);
  assert.strictEqual(r.estado, 'aguardando-ia');
  assert.strictEqual(r.ia, 'IAs grátis');

  // vez-do-claude → aguardando-ia, IA "Claude"
  const c = estadoTarefa({
    state: 'open',
    labels: [{ name: 'cortex-fila' }, { name: 'vez-do-claude' }],
    updated_at: recente,
  }, agora);
  assert.strictEqual(c.estado, 'aguardando-ia');
  assert.strictEqual(c.ia, 'Claude');
});

test('EST-N1. issue fechada pelo PR (state_reason completed) conta como concluída; not_planned continua falhou', () => {
  assert.strictEqual(estadoTarefa({ state: 'closed', state_reason: 'completed', labels: [] }).estado, 'concluida');
  assert.strictEqual(estadoTarefa({ state: 'closed', state_reason: 'not_planned', labels: [] }).estado, 'falhou');
});