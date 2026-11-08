const test = require('node:test');
const assert = require('node:assert');
const { estadoTarefa, resumoDia } = require('../../netlify/functions/central/estado-tarefas');

test('estadoTarefa: fila', () => {
  const issue = { state: 'open', labels: ['cortex-fila'], updated_at: new Date().toISOString() };
  const res = estadoTarefa(issue, Date.now(), { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'fila');
  assert.strictEqual(res.cor, 'cinza');
  assert.strictEqual(res.icone, '⏳');
  assert.strictEqual(res.texto, 'Na fila');
  assert.strictEqual(res.ia, null);
  assert.strictEqual(res.precisaVoce, false);
});

test('estadoTarefa: andamento', () => {
  const agora = Date.now();
  const issue = { state: 'open', labels: ['cortex-fila', 'cortex-rodando'], updated_at: new Date(agora - 5 * 60 * 1000).toISOString() };
  const res = estadoTarefa(issue, agora, { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'andamento');
  assert.strictEqual(res.cor, 'azul');
  assert.strictEqual(res.icone, '⚙️');
  assert.strictEqual(res.ia, 'Cortex');
});

test('estadoTarefa: aguardando-ia', () => {
  const agora = Date.now();
  const issue = { state: 'open', labels: ['cortex-fila', 'cortex-jules'], updated_at: new Date(agora - 5 * 60 * 1000).toISOString() };
  const res = estadoTarefa(issue, agora, { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'aguardando-ia');
  assert.strictEqual(res.cor, 'roxo');
  assert.strictEqual(res.icone, '🤖');
  assert.strictEqual(res.ia, 'Jules');
});

test('estadoTarefa: travada por tempo', () => {
  const agora = Date.now();
  const issue = { state: 'open', labels: ['cortex-fila', 'cortex-rodando'], updated_at: new Date(agora - 40 * 60 * 1000).toISOString() };
  const res = estadoTarefa(issue, agora, { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'travada');
  assert.strictEqual(res.cor, 'laranja');
  assert.strictEqual(res.icone, '⚠️');
  assert.ok(res.motivo.includes('Sem atividade há'));
});

test('estadoTarefa: precisaVoce com tentativa-3 e cortex-travado', () => {
  const agora = Date.now();
  const issue = { state: 'open', labels: ['cortex-fila', 'cortex-travado', 'tentativa-3'], updated_at: new Date(agora - 5 * 60 * 1000).toISOString() };
  const res = estadoTarefa(issue, agora, { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'travada');
  assert.strictEqual(res.precisaVoce, true);
});

test('estadoTarefa: concluida', () => {
  const issue = { state: 'closed', labels: ['cortex-fila', 'cortex-feito'], updated_at: new Date().toISOString() };
  const res = estadoTarefa(issue, Date.now(), { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'concluida');
  assert.strictEqual(res.cor, 'verde');
  assert.strictEqual(res.icone, '✅');
});

test('estadoTarefa: falhou', () => {
  const issue = { state: 'closed', labels: ['cortex-fila'], updated_at: new Date().toISOString() };
  const res = estadoTarefa(issue, Date.now(), { minutosParada: 30, maxTentativas: 3 });
  assert.strictEqual(res.estado, 'falhou');
  assert.strictEqual(res.cor, 'vermelho');
  assert.strictEqual(res.icone, '❌');
});

test('resumoDia', () => {
  const contagens = { andamento: 3, travada: 2, concluida: 8 };
  const ias = [{ id: 1 }, { id: 2 }];
  const frase = resumoDia(contagens, ias);
  assert.strictEqual(frase, 'Hoje: 3 em andamento, 2 travadas, 8 concluídas. IAs ativas: 2 de 2.');
});
