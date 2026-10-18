'use strict';
// NEXIA Divulga: fila primeiro, rodízio depois, utm em todo link, IA nunca trava, um canal com erro não para os outros.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rodar, semBio } = require('../../divulga/robo');

const ENV_META = { DIVULGA_META_PAGE_ID: '1', DIVULGA_META_PAGE_TOKEN: 't', DIVULGA_META_IG_USER_ID: '2', DIVULGA_PAUSA_MS: '0' };
const ok = body => ({ ok: true, status: 200, json: async () => ({ status_code: 'FINISHED', ...body }) });
const falha = () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'ruim' } }) });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-'));
const silencio = () => {};

test('ensaio mostra o 1º post da fila e não chama nenhuma rede', async () => {
  const chamadas = [];
  const r = await rodar({ acao: 'ensaio', env: ENV_META, fetchImpl: async u => { chamadas.push(u); return ok({}); }, log: silencio });
  assert.equal(r.postou, false);
  assert.equal(r.post.id, 'body-coach-01');
  assert.equal(chamadas.length, 0);
});

test('sem chaves: não publica e não marca a fila', async () => {
  const dados = tmp();
  const r = await rodar({ acao: 'rodar', dados, env: {}, fetchImpl: async () => ok({}), log: silencio });
  assert.equal(r.postou, false);
  assert.equal(fs.existsSync(path.join(dados, 'divulga-estado.json')), false);
});

test('fila sai em ordem, 1 por rodada, e o link do Facebook leva utm', async () => {
  const dados = tmp();
  const urls = [];
  const fetchImpl = async (u, o) => { urls.push({ u: String(u), b: String(o && o.body) }); return ok({ id: 'x', post_id: 'p' }); };
  const a = await rodar({ acao: 'rodar', dados, env: ENV_META, fetchImpl, log: silencio });
  const b = await rodar({ acao: 'rodar', dados, env: ENV_META, fetchImpl, log: silencio });
  assert.equal(a.post.id, 'body-coach-01');
  assert.equal(b.post.id, 'body-coach-02');
  const fb = urls.find(x => x.u.includes('/photos'));
  assert.match(decodeURIComponent(fb.b.replace(/\+/g, ' ')), /utm_source=facebook&utm_medium=social&utm_campaign=divulga/);
  const ig = urls.find(x => x.u.endsWith('/media'));
  const corpo = new URLSearchParams(ig.b);
  assert.equal(corpo.get('media_type'), 'REELS');
  assert.match(corpo.get('video_url'), /divulga\/videos\/body-coach-1\.mp4$/);
  assert.ok((corpo.get('caption').match(/#/g) || []).length >= 8, 'Instagram leva 8 hashtags');
  assert.ok(urls.some(x => x.u.includes('fields=status_code')), 'espera o vídeo ficar pronto');
});

test('Facebook com erro não impede o Instagram', async () => {
  const dados = tmp();
  const fetchImpl = async u => (String(u).includes('/photos') ? falha() : ok({ id: 'ig' }));
  const r = await rodar({ acao: 'rodar', dados, env: ENV_META, fetchImpl, log: silencio });
  assert.equal(r.postou, true);
  assert.deepEqual(r.resultados.map(x => [x.canal, x.ok]), [['facebook', false], ['instagram', true]]);
});

test('fila feita: rodízio usa texto fixo quando a IA falha', async () => {
  const dados = tmp();
  const feitos = fs.readdirSync(path.join(__dirname, '../../divulga/fila')).map(f => f.replace(/\.json$/, ''));
  fs.writeFileSync(path.join(dados, 'divulga-estado.json'), JSON.stringify({ rodizio: 0, feitos }));
  const fetchImpl = async u => (/groq|googleapis/.test(String(u)) ? falha() : ok({ id: 'x' }));
  const r = await rodar({ acao: 'rodar', dados, env: { ...ENV_META, GROQ_API_KEY: 'g' }, fetchImpl, log: silencio });
  assert.equal(r.postou, true);
  assert.equal(r.post.rodizio, true);
  assert.match(r.post.porRede('facebook').texto, /^NEXIA Body Coach: /);
  const est = JSON.parse(fs.readFileSync(path.join(dados, 'divulga-estado.json'), 'utf8'));
  assert.equal(est.rodizio, 1);
});

test('tira "link na bio" fora do Instagram', () => {
  assert.equal(semBio('Monta seu treino. Link na bio. #a'), 'Monta seu treino. #a');
  assert.equal(semBio('Comece grátis pelo link na bio. #a'), 'Comece grátis. #a');
});

test('vídeo com erro no Instagram não publica e não trava', async () => {
  const dados = tmp();
  const fetchImpl = async u => (String(u).includes('status_code') ? ok({ status_code: 'ERROR' }) : ok({ id: 'c' }));
  const r = await rodar({ acao: 'rodar', dados, env: ENV_META, fetchImpl, log: silencio });
  assert.deepEqual(r.resultados.map(x => [x.canal, x.ok]), [['facebook', true], ['instagram', false]]);
});

test('chave com quebra de linha no fim (salva pelo PowerShell) funciona', async () => {
  const dados = tmp();
  const corpos = [];
  const env = { DIVULGA_META_PAGE_ID: '1\r\n', DIVULGA_META_PAGE_TOKEN: 'tok\r\n', DIVULGA_PAUSA_MS: '0' };
  await rodar({ acao: 'rodar', dados, env, fetchImpl: async (u, o) => { corpos.push(String(u) + ' ' + String(o && o.body)); return ok({ id: 'x' }); }, log: silencio });
  assert.ok(corpos[0].includes('/1/photos'));
  assert.ok(corpos[0].includes('access_token=tok') && !corpos[0].includes('%0D'));
});

test('Cortex: anexo de qualquer tipo vai para o ramo cortex-anexos e rodapé antigo some', async () => {
  const { agir } = require('../../netlify/functions/central/pedidos-acoes');
  const chamadas = [];
  const p = { gh: async (url, init) => { chamadas.push([url, init && init.method]); if (/git\/ref\/heads\/cortex-anexos/.test(url)) throw new Error('404'); if (/heads\/develop/.test(url)) return { object: { sha: 'abc' } }; return {}; } };
  const r = await agir(p, { acao: 'anexar', nome: 'Captura de tela (1).png', base64: 'QUJD' }, 'dono');
  assert.equal(r.status, 200);
  assert.match(r.corpo.caminho, /^cortex-anexos\/\d{4}-\d{2}-\d{2}-[a-z0-9]+-Captura-de-tela-1-\.png$/);
  assert.ok(chamadas.some(([u, m]) => /git\/refs$/.test(u) && m === 'POST'));
  assert.ok(chamadas.some(([u, m]) => /contents\/cortex-anexos\//.test(u) && m === 'PUT'));
  assert.equal((await agir(p, { acao: 'anexar', nome: 'x', base64: 'A'.repeat(960000) }, 'dono')).status, 400);
  assert.equal((await agir(p, { acao: 'anexar', nome: 'x', base64: '<script>' }, 'dono')).status, 400);
  const { montarPedido } = require('../../netlify/functions/central/pedidos-pedir');
  assert.ok(!/no celular por/i.test(montarPedido('Mudar o texto do botão no Body Coach', 'dono').body));
  const { criarDetalhe } = require('../../netlify/functions/central/pedidos-detalhe');
  const gh = async (u) => (/comments/.test(u) ? [] : /search/.test(u) ? { items: [] } : { number: 1, title: 't', state: 'open', labels: [], user: { login: 'a' }, created_at: 'x', updated_at: 'x', body: 'Faça isso.\n\n_Pedido pelo Cortex no celular por gil@x.com._', comments: 0 });
  const d = await criarDetalhe(gh)(1);
  assert.ok(!/celular/i.test(d.conversa[0].texto));
});
