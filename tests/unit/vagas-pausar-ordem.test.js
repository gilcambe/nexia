'use strict';
// #2808: pausar uma vaga sem apagar a chave e mudar a ordem das vagas (variável IA_VAGAS_CONFIG, sem chave).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { lerVagas, lerConfig, vagasCustom, aplicarVagas, valorCustom } = require('../../nexia-ai/model-router/vagas');
const { organizar, estado } = require('../../netlify/functions/central/ia-vagas');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

function ghFalso(inicial) {
  const v = { value: inicial === undefined ? undefined : JSON.stringify(inicial) };
  const chamadas = [];
  const gh = async (caminho, init = {}) => {
    chamadas.push([init.method || 'GET', caminho]);
    if (caminho === '/actions/variables/IA_VAGAS_CONFIG') {
      if ((init.method || 'GET') === 'GET') { if (v.value === undefined) throw Object.assign(new Error('Not Found'), { status: 404 }); return { name: 'IA_VAGAS_CONFIG', value: v.value }; }
      if (init.method === 'PATCH') { if (v.value === undefined) throw Object.assign(new Error('Not Found'), { status: 404 }); v.value = JSON.parse(init.body).value; return {}; }
    }
    if (caminho === '/actions/variables' && init.method === 'POST') { v.value = JSON.parse(init.body).value; return {}; }
    if (caminho.startsWith('/actions/secrets')) return { secrets: [{ name: 'IA_VAGA_1', updated_at: 'x' }, { name: 'IA_VAGA_2', updated_at: 'x' }, { name: 'IA_VAGA_3', updated_at: 'x' }] };
    if (caminho.startsWith('/issues')) return [];
    if (caminho.startsWith('/pulls')) return [];
    return {};
  };
  return { gh, v, chamadas };
}

test('VPO1. vaga pausada não entra no roteador; ordem da Central decide quem vem primeiro', () => {
  const c1 = valorCustom({ url: 'https://a.exemplo.com/v1', modelo: 'm1', chave: 'k1' });
  const c3 = valorCustom({ url: 'https://c.exemplo.com/v1', modelo: 'm3', chave: 'k3' });
  const env = { IA_VAGA_1: c1, IA_VAGA_2: 'groq:g2', IA_VAGA_3: c3, IA_VAGA_4: 'groq:g4', IA_VAGAS_CONFIG: JSON.stringify({ pausadas: [2], ordem: [3, 1] }) };
  assert.deepEqual(lerVagas(env).map(v => v.n), [3, 1, 4]);
  assert.deepEqual(vagasCustom(env).map(v => v.provider), ['vaga-3', 'vaga-1']);
  assert.equal(aplicarVagas(env).GROQ_API_KEY, 'g4', 'a groq pausada (vaga 2) não é usada');
  assert.deepEqual(lerConfig({ IA_VAGAS_CONFIG: 'lixo' }), { pausadas: [], ordem: [] });
  assert.deepEqual(lerVagas({ IA_VAGA_2: 'groq:a', IA_VAGA_1: 'groq:b' }).map(v => v.n), [1, 2], 'sem config: por número');
});

test('VPO2. Central pausa, liga e muda a ordem gravando a variável (cria se não existe)', async () => {
  const { gh, v } = ghFalso(undefined);
  let r = await organizar(gh, { acao: 'vaga-pausar', vaga: 2 });
  assert.equal(r.status, 200); assert.deepEqual(JSON.parse(v.value).pausadas, [2]);
  r = await organizar(gh, { acao: 'vaga-subir', vaga: 3, ligadas: [1, 2, 3] });
  assert.deepEqual(JSON.parse(v.value).ordem, [1, 3, 2]);
  r = await organizar(gh, { acao: 'vaga-descer', vaga: 1, ligadas: [1, 3, 2] });
  assert.deepEqual(JSON.parse(v.value).ordem, [3, 1, 2]);
  r = await organizar(gh, { acao: 'vaga-ligar', vaga: 2 });
  assert.deepEqual(JSON.parse(v.value).pausadas, []);
  assert.equal((await organizar(gh, { acao: 'vaga-pausar', vaga: 51 })).status, 400);
  assert.equal((await organizar(gh, { acao: 'outra', vaga: 1 })).status, 400);
});

test('VPO3. tela recebe pausada e posição de cada vaga', async () => {
  const { gh } = ghFalso({ pausadas: [2], ordem: [3, 1] });
  const e = await estado(gh, {});
  const por = n => e.vagas.find(x => x.vaga === n);
  assert.equal(por(2).pausada, true); assert.equal(por(1).pausada, false);
  assert.equal(por(3).posicao, 0); assert.equal(por(1).posicao, 1); assert.equal(por(2).posicao, null);
});

test('VPO4. workflows passam IA_VAGAS_CONFIG; Reserva segue a ordem e pula pausadas; tela tem os botões', () => {
  for (const w of ['cortex-reserva', 'fila-cortex', 'ia-vagas', 'nexia-jobs']) assert.match(R(`.github/workflows/${w}.yml`), /IA_VAGAS_CONFIG: \$\{\{ vars\.IA_VAGAS_CONFIG \}\}/, w);
  assert.match(R('.github/workflows/cortex-reserva.yml'), /for N in \$ORDEM; do/);
  const t = R('src/pages/central/ConectarIAs.tsx');
  for (const id of ['pausar', 'subir', 'descer']) assert.match(t, new RegExp(`vaga-\\$\\{v\\.vaga\\}-${id}`));
  assert.match(R('netlify/functions/central.js'), /'vaga-pausar', 'vaga-ligar', 'vaga-subir', 'vaga-descer'/);
});
