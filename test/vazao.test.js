'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { VazaoController, calcularPrioridade } = require('../src/durable/VazaoController.js');

test('VazaoController - Ordem correta da fila por prioridade de plano e chegada', () => {
  const controller = new VazaoController();

  // Enfileirar itens com diferentes planos e ordem de chegada
  controller.enfileirar({ id: 'item1', usuario_id: 'user_free', plano: 'gratis' }, 1000);
  controller.enfileirar({ id: 'item2', usuario_id: 'user_enterprise', plano: 'enterprise' }, 2000);
  controller.enfileirar({ id: 'item3', usuario_id: 'user_pro', plano: 'pro' }, 1500);
  controller.enfileirar({ id: 'item4', usuario_id: 'user_free_2', plano: 'free' }, 500); // Chegou antes, mas é free

  const fila = controller.obterFila('aguardando');
  assert.strictEqual(fila.length, 4);

  // Ordem esperada: 
  // 1. enterprise (prioridade 100) - user_enterprise
  // 2. pro (prioridade 50) - user_pro
  // 3. gratis (prioridade 10) - user_free_2 (chegada 500 < 1000)
  // 4. gratis (prioridade 10) - user_free (chegada 1000)
  assert.strictEqual(fila[0].id, 'item2');
  assert.strictEqual(fila[1].id, 'item3');
  assert.strictEqual(fila[2].id, 'item4');
  assert.strictEqual(fila[3].id, 'item1');

  // Testar proximoDaFila retira na ordem correta
  const prox1 = controller.proximoDaFila();
  assert.strictEqual(prox1.id, 'item2');

  const prox2 = controller.proximoDaFila();
  assert.strictEqual(prox2.id, 'item3');
});

test('VazaoController - Limite de 1 resposta por pessoa', () => {
  const controller = new VazaoController();
  const usuarioId = 'user_123';

  // Primeira chamada deve iniciar com sucesso
  const res1 = controller.iniciarResposta(usuarioId, 'req_001');
  assert.strictEqual(res1.ok, true);
  assert.strictEqual(res1.usuario_id, usuarioId);
  assert.strictEqual(res1.request_id, 'req_001');

  // Segunda chamada simultânea para o mesmo usuário deve ser bloqueada
  const res2 = controller.iniciarResposta(usuarioId, 'req_002');
  assert.strictEqual(res2.ok, false);
  assert.strictEqual(res2.motivo, 'resposta_em_andamento');

  // Verificar andamento atual
  const andamento = controller.obterRespostaAndamento(usuarioId);
  assert.notStrictEqual(andamento, null);
  assert.strictEqual(andamento.request_id, 'req_001');

  // Finalizar resposta
  const fin = controller.finalizarResposta(usuarioId);
  assert.strictEqual(fin.ok, true);

  // Após finalizar, deve permitir nova resposta
  const res3 = controller.iniciarResposta(usuarioId, 'req_003');
  assert.strictEqual(res3.ok, true);
  assert.strictEqual(res3.request_id, 'req_003');
});

test('VazaoController - Teste de carga simulando 200 usuários no modo falso sem perda de respostas ou erros', async () => {
  const controller = new VazaoController();
  const totalUsuarios = 200;

  // Simular 200 requisições simultâneas de início de resposta
  const promessasIniciar = [];
  for (let i = 1; i <= totalUsuarios; i++) {
    const userId = `user_carga_${i}`;
    promessasIniciar.push(
      Promise.resolve().then(() => controller.iniciarResposta(userId, `req_${i}`))
    );
  }

  const resultadosIniciar = await Promise.all(promessasIniciar);
  assert.strictEqual(resultadosIniciar.length, totalUsuarios);

  // Todos devem ter iniciado com sucesso (cada usuário é único)
  const sucessos = resultadosIniciar.filter(r => r.ok);
  assert.strictEqual(sucessos.length, totalUsuarios);

  // Tentar iniciar novamente para os mesmos 200 usuários (deve barrar todos com resposta_em_andamento)
  const promessasDuplicadas = [];
  for (let i = 1; i <= totalUsuarios; i++) {
    const userId = `user_carga_${i}`;
    promessasDuplicadas.push(
      Promise.resolve().then(() => controller.iniciarResposta(userId, `req_dup_${i}`))
    );
  }

  const resultadosDuplicadas = await Promise.all(promessasDuplicadas);
  const bloqueados = resultadosDuplicadas.filter(r => !r.ok && r.motivo === 'resposta_em_andamento');
  assert.strictEqual(bloqueados.length, totalUsuarios);

  // Finalizar todas as respostas e conferir se foram removidas sem erros
  const promessasFinalizar = [];
  for (let i = 1; i <= totalUsuarios; i++) {
    const userId = `user_carga_${i}`;
    promessasFinalizar.push(
      Promise.resolve().then(() => controller.finalizarResposta(userId))
    );
  }

  const resultadosFinalizar = await Promise.all(promessasFinalizar);
  const finalizadosOk = resultadosFinalizar.filter(r => r.ok);
  assert.strictEqual(finalizadosOk.length, totalUsuarios);

  // Garantir que não restou nenhuma resposta em andamento
  for (let i = 1; i <= totalUsuarios; i++) {
    const userId = `user_carga_${i}`;
    assert.strictEqual(controller.obterRespostaAndamento(userId), null);
  }
});
