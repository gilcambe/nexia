// Contrato: Kernex Finance lê o print da carteira tão bem quanto o Gemini do celular do dono.
// Prova do dono 16/11: "coloco o print no Gemini e ele lê corretamente, o Finance não lê".
// Causa: (1) a lista VISAO chama gemini-2.5-*, que dá 404 para chave nova desde 16/11 (ver nexia-ai/orchestrator/models.js);
// (2) lerPrint corre duas pistas e fica com a PRIMEIRA resposta (Promise.any), então um modelo pequeno e rápido do
// Workers AI ganha do modelo bom; (3) não confere se a soma dos itens bate com o total do print antes de aceitar.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo');

const img = [{ mime: 'image/png', data: 'AAAA' }];
const json = (o) => ({ text: JSON.stringify(o) });
const certo = { total_print: 500, itens: [{ nome: 'CDB Inter', banco: 'Inter', tipo: 'renda_fixa', valor: 300, data_valor: '2026-11-16' }, { nome: 'MXRF11', banco: 'Inter', tipo: 'fiis', ticker: 'MXRF11', valor: 200, data_valor: '2026-11-16' }] };
const errado = { total_print: 500, itens: [{ nome: 'CDB Inter', banco: 'Inter', tipo: 'renda_fixa', valor: 30, data_valor: '2026-11-16' }] };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test('a lista de visão começa pelo Gemini atual (3.5-flash, depois 3.1-flash-lite) e não tem mais gemini-2.5', () => {
  assert.deepEqual(p.VISAO[0], { provider: 'google', model: 'gemini-3.5-flash' });
  assert.deepEqual(p.VISAO[1], { provider: 'google', model: 'gemini-3.1-flash-lite' });
  assert.ok(!p.VISAO.some((d) => /gemini-2\.5/.test(d.model)), 'gemini-2.5-* dá 404 para chave nova: tire da lista');
});

test('qualidade antes de velocidade: o Workers AI rápido e errado NÃO ganha do Gemini certo', async () => {
  const deps = {
    listFor: () => [],
    ai: { run: async () => ({ response: errado }) }, // responde na hora, mas lê errado
    getRouter: () => ({
      capabilities: () => ({ available: true, vision: true }),
      chat: async (d) => { if (d.model === 'gemini-3.5-flash') { await esperar(80); return json(certo); } throw new Error('fora do ar'); },
    }),
  };
  const r = await p.lerPrint(img, deps);
  assert.equal(r.itens.length, 2, 'use a leitura do Gemini (2 itens), não a primeira que chegou');
  assert.equal(r.conferencia[0].confere, true);
});

test('a soma dos itens precisa bater com o total do print: se não bate, tenta o próximo modelo', async () => {
  const usados = [];
  const deps = {
    listFor: () => [],
    getRouter: () => ({
      capabilities: () => ({ available: true, vision: true }),
      chat: async (d) => { usados.push(d.model); return d.model === 'gemini-3.5-flash' ? json(errado) : json(certo); },
    }),
  };
  const r = await p.lerPrint(img, deps);
  assert.ok(usados.length >= 2, 'a 1ª leitura não bateu com o total (30 de 500): tente o próximo modelo da lista');
  assert.equal(r.itens.length, 2);
  assert.equal(r.conferencia[0].confere, true);
});

test('se nenhuma leitura bate com o total, devolve a melhor que achou (não fica sem nada)', async () => {
  const deps = {
    listFor: () => [],
    getRouter: () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => json(errado) }),
  };
  const r = await p.lerPrint(img, deps);
  assert.equal(r.itens.length, 1);
  assert.equal(r.conferencia[0].confere, false, 'mostre que não bateu, para a pessoa conferir');
});

test('se todas as IAs com chave falham, o Workers AI continua lendo sozinho', async () => {
  const deps = {
    listFor: () => [],
    ai: { run: async () => ({ response: certo }) },
    getRouter: () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => { throw new Error('fora do ar'); } }),
  };
  const r = await p.lerPrint(img, deps);
  assert.equal(r.itens.length, 2);
});
