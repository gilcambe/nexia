'use strict';
// #802: Conexões mostra as contas de reserva ligadas (só o nome do segredo) e o passo a passo para ligar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { criarGithub, montarReservas, RESERVAS } = require('../../netlify/functions/central/github');

test('R3a. ligada/não ligada pelo nome do segredo; passos de 3 linhas; pagas marcadas', () => {
  const r = montarReservas(['GROQ_API_KEY'], ['RESERVA_GEMINI_KEY']);
  const c = Object.fromEntries(r.contas.map(x => [x.id, x]));
  assert.equal(c.gemini.ligada, true);
  assert.equal(c.groq.ligada, true);
  assert.equal(c.gpt.ligada, false);
  assert.equal(c.claude.gratis, false);
  for (const x of RESERVAS) assert.equal(x.passos.length, 3, x.id);
  assert.equal(montarReservas(null, null).semAcesso, true);
  assert.ok(!JSON.stringify(r).includes('value'), 'nunca devolve valor');
});

test('R3b. servidor lê só os nomes (repo e ambiente production) e as tarefas sem cota', async () => {
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    const corpo = /environments\/production/.test(url) ? { secrets: [{ name: 'RESERVA_OPENROUTER_KEY' }] }
      : /actions\/secrets/.test(url) ? { secrets: [{ name: 'GEMINI_API_KEY' }] }
      : [{ number: 5, title: 'x', html_url: 'u', updated_at: 'h', labels: [] }];
    return { ok: true, status: 200, json: async () => corpo };
  };
  const r = await criarGithub({ NEXIA_JOBS_TOKEN: 't' }, fetchFn).reservas();
  assert.equal(r.contas.find(x => x.id === 'openrouter').ligada, true);
  assert.equal(r.semCota[0].numero, 5);
  assert.ok(urls.some(u => u.includes('cortex-reserva-sem-cota')));
});

test('R3c. aparece em Conexões do Cortex e na aba Cortex da Central', () => {
  const R = f => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
  assert.match(R('src/pages/cortex/Paineis.tsx'), /<ContasReserva \/>/);
  assert.match(R('src/pages/central/CortexAba.tsx'), /<ContasReserva \/>/);
  assert.match(R('netlify/functions/central.js'), /parte === 'reservas'/);
});
