'use strict';
// 09/11 (dono): "Qual status de tudo?" ficou um dia na fila. Pergunta de status é respondida na hora pela Central.
const test = require('node:test');
const assert = require('node:assert/strict');
const { textoStatus } = require('../../netlify/functions/central/status-agora');
const { ehPerguntaDeStatus, agir } = require('../../netlify/functions/central/pedidos-acoes');

test('ST1. reconhece pergunta de status e não confunde com pedido de trabalho', () => {
  for (const s of ['Qual status de tudo?', 'qual o status?', 'Como está o andamento?', 'me passe o status de tudo', 'Quais os status dos projetos?']) assert.equal(ehPerguntaDeStatus(s), true, s);
  for (const s of ['Criar tela de status do Body Coach', 'corrigir o status do pedido no app', 'Fazer o botão Entrar funcionar']) assert.equal(ehPerguntaDeStatus(s), false, s);
});

test('ST2. texto do status traz números reais e paradas há mais de 1 dia', () => {
  const agora = Date.parse('2026-11-09T20:00:00Z');
  const t = textoStatus({ agora, ias: { ias: [{ ativa: true }, { ativa: false }] }, oqf: { resumo: { rodando: 3, pedidos: 40, travadas: 5, prontos72h: 12, esperandoVoce: 2 }, comCortex: [{ quando: '2026-11-07T00:00:00Z', rodando: false }, { quando: '2026-11-09T19:00:00Z', rodando: false }] } });
  assert.match(t, /3 tarefa\(s\) sendo feitas, 40 pedido\(s\) na fila e 5 travada/);
  assert.match(t, /Prontas nas últimas 72 h: 12/);
  assert.match(t, /IAs trabalhando: 1 de 2/);
  assert.match(t, /Paradas há mais de 1 dia: 1\./);
});

test('ST3. "pedir" com pergunta de status responde na hora e NÃO cria tarefa', async () => {
  const chamadas = [];
  const p = { gh: async (u, i) => { chamadas.push(u); return { number: 1 }; }, statusAgora: async () => 'Status agora: tudo certo.' };
  const x = await agir(p, { acao: 'pedir', texto: 'Qual status de tudo?' }, 'dono');
  assert.equal(x.status, 200);
  assert.equal(x.corpo.resposta, true);
  assert.equal(x.corpo.mensagem, 'Status agora: tudo certo.');
  assert.equal(chamadas.length, 0);
});
