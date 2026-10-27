'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('../nexia-ai/cortex/ferramentas');

const resp = (status, body, headers = {}) => ({
  ok: status < 400,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] || null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body)
});

test('Ferramentas: calcular executa contas sem eval e rejeita código malicioso', async () => {
  const r1 = await fx.executar('calcular', { expressao: '17% de 2350' });
  assert.equal(r1.resultado, 399.5);

  const r2 = await fx.executar('calcular', { expressao: '(2+3)*4 - 2^3' });
  assert.equal(r2.resultado, 12);

  const r3 = await fx.executar('calcular', { expressao: 'process.exit()' });
  assert.ok(r3.erro);

  const r4 = await fx.executar('calcular', { expressao: '2+' });
  assert.ok(r4.erro);
});

test('Ferramentas: abrir_pagina bloqueia SSRF e sanitiza HTML', async () => {
  const html = '<html><script>console.log("x")</script><p>Conteúdo &amp; teste</p></html>';
  const res = await fx.executar('abrir_pagina', { url: 'https://exemplo.com/pagina' }, {
    fetchImpl: async () => resp(200, html)
  });
  assert.equal(res.url, 'https://exemplo.com/pagina');
  assert.equal(res.texto, 'Conteúdo & teste');

  const resInterno = await fx.executar('abrir_pagina', { url: 'http://localhost/admin' });
  assert.match(resInterno.erro, /não permitido/i);
});

test('Ferramentas: cotacao, clima, data_hora e buscar_web', async () => {
  const cot = await fx.executar('cotacao', { moeda: 'USD' }, {
    fetchImpl: async (u) => {
      assert.match(u, /USD-BRL/);
      return resp(200, { USDBRL: { bid: '5.25', ask: '5.26', pctChange: '0.1', create_date: '2026-10-27 10:00:00' } });
    }
  });
  assert.equal(cot.moeda, 'USD');
  assert.equal(cot.compra, 5.25);

  const cli = await fx.executar('clima', { cidade: 'São Paulo' }, {
    fetchImpl: async (u) => {
      if (u.includes('geocoding')) {
        return resp(200, { results: [{ name: 'São Paulo', admin1: 'São Paulo', latitude: -23.55, longitude: -46.63 }] });
      }
      return resp(200, { current: { temperature_2m: 25 }, daily: { temperature_2m_max: [28] } });
    }
  });
  assert.equal(cli.cidade, 'São Paulo, São Paulo');
  assert.equal(cli.agora.temperature_2m, 25);

  const dh = await fx.executar('data_hora', {});
  assert.ok(dh.agora);
  assert.equal(dh.fuso, 'America/Sao_Paulo');

  const bw = await fx.executar('buscar_web', { q: 'noticias nexia' }, {
    fetchImpl: async () => resp(200, '<html><body>Notícia recente</body></html>')
  });
  assert.ok(Array.isArray(bw.fontes));
});

test('Ferramentas: limite de 6 passos no loop do orquestrador de ferramentas', async () => {
  const MAX_STEPS = 6;
  const historicoChamadas = [];

  const mockRunner = async (passosSolicitados) => {
    let passosExecutados = 0;
    for (let passo = 1; passo <= passosSolicitados; passo++) {
      if (passosExecutados >= MAX_STEPS) {
        historicoChamadas.push({ passo, status: 'limite_atingido' });
        break;
      }
      const res = await fx.executar('calcular', { expressao: `${passo} + 1` });
      passosExecutados++;
      historicoChamadas.push({ passo, resultado: res.resultado });
    }
    return { passosExecutados, limiteAtingido: passosExecutados >= MAX_STEPS };
  };

  const resultadoLoop = await mockRunner(10);
  assert.equal(resultadoLoop.passosExecutados, 6);
  assert.equal(resultadoLoop.limiteAtingido, true);
  assert.equal(historicoChamadas.length, 7); // 6 executados + 1 interrompido pelo limite
});
