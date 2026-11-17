'use strict';
// 17/11: "o holerite não está sendo reconhecido". O leitor antigo tentava só a lista 'fast', uma por vez, 15 s cada,
// sem NVIDIA e sem Cloudflare. O leitor único (prumo-lib/visao.js) faz corrida escalonada e usa a Cloudflare.
const test = require('node:test');
const assert = require('node:assert/strict');
const { perguntarVisao } = require('../../netlify/functions/prumo-lib/visao');

const IMG = { mime: 'image/png', data: 'aGVsbG8=' };
function deps({ respostas, ai, semVisao = [] }) {
  const pedidos = [];
  return {
    pedidos,
    esperaCorridaMs: 30,
    listFor: () => [{ provider: 'mistral', model: 'mistral-small-latest' }],
    getRouter: () => ({
      capabilities: (d) => ({ available: true, vision: !semVisao.includes(d.provider + '/' + d.model) }),
      chat: (d) => { const k = `${d.provider}/${d.model}`; pedidos.push(k); const r = respostas[k]; return typeof r === 'function' ? r() : (r instanceof Error ? Promise.reject(r) : Promise.resolve({ text: r })); },
    }),
    ai,
  };
}
const nunca = () => new Promise(() => {});

test('a 1ª IA trava: a próxima entra pela corrida e a resposta com JSON vence rápido', async () => {
  const d = deps({ respostas: { 'google/gemini-3.5-flash': nunca, 'nvidia/meta/llama-3.2-90b-vision-instruct': '{"liquido": 4434.35}' }, ai: null });
  const t0 = Date.now();
  const r = await perguntarVisao(d, IMG, 'sistema', { porIaMs: 5000, totalMs: 8000 });
  assert.match(r, /4434\.35/);
  assert.ok(Date.now() - t0 < 1500, 'não espera a 1ª IA travada');
});

test('todas as IAs externas falham (sem cota): a Cloudflare lê', async () => {
  const falha = new Error('429 sem cota');
  const respostas = {};
  for (const k of ['google/gemini-3.5-flash', 'nvidia/meta/llama-3.2-90b-vision-instruct', 'google/gemini-3.1-flash-lite', 'groq/meta-llama/llama-4-scout-17b-16e-instruct', 'mistral/mistral-small-latest', 'google/gemini-flash-latest', 'google/gemma-4-31b-it', 'openrouter/google/gemma-3-27b-it:free', 'openrouter/qwen/qwen2.5-vl-72b-instruct:free']) respostas[k] = falha;
  const ai = { run: async () => ({ response: { tipo: 'adiantamento', liquido: 4434.35 } }) };
  const r = await perguntarVisao(deps({ respostas, ai }), IMG, 'sistema', { porIaMs: 2000, totalMs: 5000 });
  assert.match(r, /adiantamento/);
});

test('resposta sem JSON não vence; ninguém responde = null sem travar', async () => {
  const respostas = { 'google/gemini-3.5-flash': 'não sei ler isso' };
  const d = deps({ respostas, ai: null });
  const r = await perguntarVisao(d, IMG, 'sistema', { porIaMs: 300, totalMs: 3000 });
  assert.equal(r, null);
});

test('salário, contas/cartões/dívidas, milhas e aposentadoria usam o leitor único', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const lib = (f) => fs.readFileSync(path.join(__dirname, '../../netlify/functions/prumo-lib', f), 'utf8');
  assert.match(lib('salario.js'), /require\('\.\/visao'\)\.perguntarVisao/);
  assert.match(lib('aposentadoria.js'), /require\('\.\/visao'\)\.perguntarVisao/);
  assert.match(lib('leitor.js'), /perguntarVisaoGratis/);
  assert.doesNotMatch(lib('salario.js'), /listFor\('fast'\)\.filter/, 'o leitor fraco saiu');
});
