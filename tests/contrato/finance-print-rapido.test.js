'use strict';
// Contrato: Kernex Finance — LER PRINT RÁPIDO (dono 17/11: "o aplicativo tá muito lento... pra ler prints").
// Hoje lerPrint (netlify/functions/prumo.js) tenta as IAs de visão UMA POR VEZ: a 1ª tem até 100 s e cada outra 30 s.
// Se as primeiras estão sem cota ou demoram, um print leva minutos.
// Pedido — CORRIDA ESCALONADA em viaLista(img), dentro de lerPrint:
//  - começa só com a 1ª IA disponível com visão (economiza cota grátis quando ela acerta rápido);
//  - a PRÓXIMA da lista entra quando: a anterior FALHOU (erro, sem JSON ou soma que não bate) OU passaram
//    deps.esperaCorridaMs (padrão 8000) sem resposta boa; no máximo 3 IAs rodando ao mesmo tempo;
//  - a PRIMEIRA leitura cuja soma bate com o total (função bate) vence na hora; as outras são ignoradas;
//  - se nenhuma bater, devolve a melhor leitura que não bateu (como hoje);
//  - cada IA tem até 45 s; tudo dentro dos 160 s que já existem;
//  - LIMPE os temporizadores (clearTimeout) quando a IA responder ou a corrida acabar (timer pendurado deixa o
//    servidor e os testes esperando à toa).
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');

const BOM = JSON.stringify({ total_print: 100, data_print: null, itens: [{ nome: 'CDB Banco X', tipo: 'renda_fixa', valor: 100 }] });
const RUIM = JSON.stringify({ total_print: 100, data_print: null, itens: [{ nome: 'CDB Banco X', tipo: 'renda_fixa', valor: 70 }] });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function deps(comportamento, esperaCorridaMs = 50) {
  const chamadas = []; const inicio = {};
  const router = {
    capabilities: () => ({ available: true, vision: true }),
    chat: async (d) => { chamadas.push(d.model); inicio[d.model] = Date.now(); const c = comportamento[d.model] || { ms: 5, texto: '' }; await espera(c.ms); if (c.erro) throw new Error(c.erro); return { text: c.texto }; },
  };
  return { chamadas, inicio, d: { getRouter: () => router, listFor: () => [], ai: null, esperaCorridaMs } };
}
const IMG = [{ data: 'x', mime: 'image/png' }];
const [A, B, C, D] = p.VISAO.map((v) => v.model);

test('a 1ª acerta rápido: só ela é chamada (economiza cota)', async () => {
  const { d, chamadas } = deps({ [A]: { ms: 10, texto: BOM } }, 200);
  const r = await p.lerPrint(IMG, d);
  assert.equal(r.itens[0].valor, 100);
  assert.deepEqual(chamadas, [A]);
});

test('a 1ª demora: depois de esperaCorridaMs entra a próxima, e a que acerta primeiro vence', async () => {
  const { d, chamadas } = deps({ [A]: { ms: 1500, texto: BOM }, [B]: { ms: 30, texto: BOM } }, 50);
  const t0 = Date.now();
  const r = await p.lerPrint(IMG, d);
  const ms = Date.now() - t0;
  assert.equal(r.itens[0].valor, 100);
  assert.ok(chamadas.includes(B), 'B entrou na corrida');
  assert.ok(ms < 700, `respondeu em ${ms} ms (não esperou os 1,5 s da 1ª)`);
});

test('a 1ª falha: a próxima entra NA HORA (sem esperar esperaCorridaMs)', async () => {
  const { d, inicio } = deps({ [A]: { ms: 5, erro: '429' }, [B]: { ms: 10, texto: BOM } }, 5000);
  const t0 = Date.now();
  const r = await p.lerPrint(IMG, d);
  assert.equal(r.itens[0].valor, 100);
  assert.ok(inicio[B] - t0 < 300, 'B começou logo depois da falha de A');
});

test('leitura que não bate não vence: espera a que bate', async () => {
  const { d } = deps({ [A]: { ms: 10, texto: RUIM }, [B]: { ms: 60, texto: BOM } }, 5000);
  const r = await p.lerPrint(IMG, d);
  assert.equal(r.itens[0].valor, 100);
});

test('no máximo 3 ao mesmo tempo; a 4ª entra quando uma das 3 falha', async () => {
  const { d, chamadas } = deps({ [A]: { ms: 400, erro: '500' }, [B]: { ms: 2000, texto: BOM }, [C]: { ms: 2000, texto: BOM }, [D]: { ms: 10, texto: BOM } }, 20);
  await espera(0);
  const r = await p.lerPrint(IMG, d);
  assert.equal(r.itens[0].valor, 100);
  const antesDeD = chamadas.slice(0, chamadas.indexOf(D));
  assert.deepEqual(antesDeD, [A, B, C], 'A, B e C antes; D só quando A falhou');
});
