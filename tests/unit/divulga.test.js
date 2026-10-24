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
  assert.match(r.post.porRede('facebook').texto, /Body Coach: /);
  assert.match(r.post.porRede('facebook').texto.split('\n')[0], /[:?]$/); // gancho na 1ª linha
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

test('calendário: tema de cada dia da semana, gancho na 1ª linha, CTA e 5 a 10 hashtags', () => {
  const { SEMANA, temaDoDia, montarLegenda, hashtagsNicho } = require('../../divulga/lib/calendario');
  assert.equal(SEMANA.length, 7);
  assert.equal(temaDoDia(new Date('2026-10-19T15:00:00Z')).tema, 'dica-treino'); // segunda
  assert.equal(temaDoDia(new Date('2026-10-23T15:00:00Z')).tema, 'oferta-loja'); // sexta
  assert.equal(temaDoDia(new Date('2026-10-18T15:00:00Z')).tema, 'teste-gratis'); // domingo
  const c = { nome: 'NEXIA Body Coach', hashtags: ['#treino', '#dieta'] };
  const l = montarLegenda(c, 'desafio', 'Venha treinar com a gente.');
  const linhas = l.split('\n');
  assert.match(linhas[0], /30 dias/);
  assert.match(l, /Marque um amigo/);
  assert.match(l, /#DesafioBodyCoach/);
  const h = hashtagsNicho(c);
  assert.ok(h.length >= 5 && h.length <= 10);
  assert.equal(new Set(h.map(x => x.toLowerCase())).size, h.length);
});

test('visual: carrossel com 5 telas, story 1080x1920 com contagem e antes/depois com 2 prints', () => {
  const { carrossel, story, antesDepois } = require('../../divulga/lib/visual');
  const c = { nome: 'NEXIA Body Coach', assuntos: ['treino com IA'] };
  const telas = carrossel(c, { prints: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'] });
  assert.equal(telas.length, 5);
  assert.match(telas[0], /não vê resultado/);
  assert.match(telas[4], /Comente QUERO/);
  assert.match(telas[1], /AAA/);
  const s = story(c, { pergunta: 'Vai treinar?', ate: '2026-10-25', hoje: new Date('2026-10-23T12:00:00Z') });
  assert.match(s, /--w:1080px;--h:1920px/);
  assert.match(s, /Faltam 2 dias/);
  const ad = antesDepois(c, { antes: 'data:image/jpeg;base64,X1', depois: 'data:image/jpeg;base64,X2' });
  assert.ok(ad.includes('X1') && ad.includes('X2'));
  assert.match(carrossel({ nome: '<b>x</b>' })[1], /&lt;b&gt;/);
});

test('gerar: monta as 7 peças do cliente real sem rede', () => {
  const { montarPecas } = require('../../divulga/gerar');
  const cliente = JSON.parse(fs.readFileSync(path.join(__dirname, '../../divulga/clientes/body-coach.json'), 'utf8'));
  const p = montarPecas(cliente, new Date('2026-10-19T15:00:00Z'));
  assert.equal(Object.keys(p).length, 7);
  assert.match(p.story, /segunda/);
});

test('/conheca: conta o clique do dia, vai para o app com UTM e nunca falha para o visitante', async () => {
  const { createHandler, destino, dia } = require('../../netlify/functions/conheca');
  const gravados = [];
  const admin = { firestore: { FieldValue: { increment: n => ({ inc: n }) } } };
  const db = { collection: nome => ({ doc: id => ({ set: async (d, o) => gravados.push({ nome, id, d, o }) }) }) };
  const h = createHandler({ getDb: () => ({ admin, db }), agora: () => new Date('2026-10-19T01:00:00Z') });
  const r = await h({ httpMethod: 'GET', queryStringParameters: { r: 'story' } });
  assert.equal(r.statusCode, 302);
  assert.equal(r.headers.Location, 'https://nexiabodycoach.pages.dev/?utm_source=story&utm_medium=social&utm_campaign=divulga');
  assert.equal(gravados[0].nome, 'divulga_cliques');
  assert.equal(gravados[0].id, '2026-10-18'); // 22h em Brasília ainda é dia 18
  assert.deepEqual(gravados[0].d.redes, { story: { inc: 1 } });
  const r2 = await createHandler({ getDb: () => { throw new Error('banco fora'); } })({ httpMethod: 'GET', queryStringParameters: { r: 'inventada' } });
  assert.equal(r2.statusCode, 302);
  assert.match(r2.headers.Location, /utm_source=bio/);
  assert.equal((await h({ httpMethod: 'POST' })).statusCode, 405);
  assert.equal(destino('bio').includes('utm_campaign=divulga'), true);
  assert.equal(dia(new Date('2026-10-19T02:59:00Z')), '2026-10-18');
  const { resolveFunctionName } = require('../../lib/routes.js');
  assert.equal(resolveFunctionName('/api/conheca'), 'conheca');
  assert.ok(fs.readFileSync(path.join(__dirname, '../../public/conheca/index.html'), 'utf8').includes('/api/conheca?r=bio'));
});

test('interação semanal: 20 itens que mudam por semana, sem inventar perfis, e convite de collab pronto', () => {
  const { listaSemanal, conviteCollab, roteiroCollabs } = require('../../divulga/lib/interacao');
  const a = listaSemanal(new Date('2026-10-19T12:00:00Z'));
  const b = listaSemanal(new Date('2026-10-26T12:00:00Z'));
  assert.equal(a.itens.length, 20);
  assert.ok(a.itens.every(i => !/@/.test(i.alvo)));
  assert.notDeepEqual(a.itens.map(i => i.alvo), b.itens.map(i => i.alvo));
  assert.match(conviteCollab('Ana'), /^Oi, Ana!/);
  assert.equal(roteiroCollabs().length, 4);
});

test('ensaio mostra a lista de interação e o roteiro de collabs', async () => {
  const linhas = [];
  await rodar({ acao: 'ensaio', env: {}, fetchImpl: async () => ok({}), log: t => linhas.push(t) });
  const t = linhas.join('\n');
  assert.match(t, /interagir à mão/);
  assert.match(t, /roteiro de 3 collabs/);
});

test('visual de marca: post único traz a tela do app, a marca Body Coach e escapa o texto', () => {
  const { postUnico } = require('../../divulga/lib/visual');
  const h = postUnico({ nome: 'Body Coach' }, { titulo: 'Dieta <x>', destaque: 'ok', texto: 'texto', tela: 'dieta' });
  assert.match(h, /Dieta de hoje/);
  assert.match(h, /Body Coach/);
  assert.match(h, /tela de exemplo/);
  assert.match(h, /Dieta &lt;x&gt;/);
});

test('histórico com formato e serie: último item deve ter formato definido', async () => {
  const dados = tmp();
  // Cria um estado com uma fila feita
  const estadoInicial = { rodizio: 0, feitos: [], historico: [] };
  fs.writeFileSync(path.join(dados, 'divulga-estado.json'), JSON.stringify(estadoInicial));
  
  const fetchImpl = async u => ok({ id: 'test' });
  const r = await rodar({ acao: 'rodar', dados, env: ENV_META, fetchImpl, log: silencio });
  
  // Lê o estado atualizado
  const estadoFinal = JSON.parse(fs.readFileSync(path.join(dados, 'divulga-estado.json'), 'utf8'));
  const historico = estadoFinal.historico;
  
  // Verifica que o histórico tem pelo menos um item
  assert.ok(historico.length > 0, 'Histórico deve ter pelo menos um item');
  
  // Pega o último item do histórico
  const ultimoItem = historico[historico.length - 1];
  
  // Verifica que o formato existe e é uma string
  assert.ok(ultimoItem.hasOwnProperty('formato'), 'Último item deve ter chave "formato"');
  assert.equal(typeof ultimoItem.formato, 'string', 'Formato deve ser uma string');
  
  // Verifica que a série existe (pode ser null)
  assert.ok(ultimoItem.hasOwnProperty('serie'), 'Último item deve ter chave "serie"');
  
  // Verifica outras chaves obrigatórias
  assert.ok(ultimoItem.hasOwnProperty('quando'), 'Último item deve ter chave "quando"');
  assert.ok(ultimoItem.hasOwnProperty('id'), 'Último item deve ter chave "id"');
  assert.ok(ultimoItem.hasOwnProperty('cliente'), 'Último item deve ter chave "cliente"');
  assert.ok(ultimoItem.hasOwnProperty('resultados'), 'Último item deve ter chave "resultados"');
});
