'use strict';
// 17/11, medido no celular do dono: inicio_resumo levava 3–7,6 s. O resumo e o fluxo liam as mesmas coleções de novo,
// em sequência, e o Worker só abre 6 conexões por vez. Regra: numa ação que só lê, cada coleção é lida UMA vez.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');

function banco() {
  const dados = new Map(); const leituras = {};
  const col = (caminho) => ({
    path: caminho,
    doc: (id) => ({ collection: (n) => col(`${caminho}/${id}/${n}`), set: async (v) => { dados.set(`${caminho}/${id}`, v); }, delete: async () => { dados.delete(`${caminho}/${id}`); }, get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => { leituras[caminho] = (leituras[caminho] || 0) + 1; await new Promise((r) => setTimeout(r, 5)); return { docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }; },
    where: () => col(caminho), orderBy: () => col(caminho), limit: () => col(caminho),
  });
  return { collection: col, leituras, dados };
}

test('inicio_resumo lê cada coleção uma vez só', async () => {
  const b = banco(); p.deps.db = () => b; p.deps.agora = () => new Date('2026-11-17T20:00:00Z');
  const r = await p.agir('u1', { acao: 'inicio_resumo' });
  assert.equal(r[0], 200);
  const repetidas = Object.entries(b.leituras).filter(([, n]) => n > 1);
  assert.deepEqual(repetidas, [], `coleções lidas mais de uma vez: ${JSON.stringify(repetidas)}`);
  assert.ok(r[1].fluxo_inicio !== undefined, 'o cartão do fluxo continua vindo');
});

test('ação que grava não usa memória (lê o dado atual depois de gravar)', async () => {
  const b = banco(); p.deps.db = () => b; p.deps.agora = () => new Date('2026-11-17T20:00:00Z');
  await p.agir('u1', { acao: 'pagamento_salvar', tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-13', bruto: 100, liquido: 100 });
  await p.agir('u1', { acao: 'pagamento_salvar', tipo: 'mensal', mes: '2026-11', data_pagamento: '2026-11-30', bruto: 200, liquido: 200 });
  const l = await p.agir('u1', { acao: 'pagamento_listar', mes: '2026-11' });
  assert.equal(l[1].pagamentos.length, 2);
});
