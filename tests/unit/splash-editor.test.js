'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, hashSenha } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const SEG_9H = Date.parse('2026-10-12T12:00:00Z');
const SALT_TESTE = '1234567890abcdef1234567890abcdef';

async function getCadastroTeste() {
  const hash = await hashSenha('CODIGO123', SALT_TESTE);
  return {
    nome: 'Splash Eventos Teste',
    versao: 1,
    codigo_salt: SALT_TESTE,
    codigo_hash: hash,
    config: {
      ...LOCACOES.splash.config,
      pix: { chave: 'chave-pix-secreta-da-amanda@pix.com', titular: 'Amanda Splash' },
    },
  };
}

const mw = role => ({ verifyBearerToken: async (e) => (e.headers.authorization ? { ok: true, uid: 'm', role } : { ok: false }) });

async function montar(opts = {}) {
  const db = opts.db || fakeDb();
  let agora = opts.agora || SEG_9H;
  const cadastro = opts.cadastro || (await getCadastroTeste());

  const h = createHandler({
    getDb: () => db,
    getMw: () => mw(opts.role || 'user'),
    getCadastro: s => (s === 'splash' ? cadastro : undefined),
    getLista: () => ({ splash: cadastro }),
    now: () => agora,
  });

  let ip = 0;
  const post = (body, extra = {}) => h({
    httpMethod: 'POST',
    headers: { 'cf-connecting-ip': extra.ip || '10.0.0.' + (++ip), ...(extra.headers || {}) },
    body: JSON.stringify({ site: 'splash', ...body }),
  }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));

  const get = (q, extra = {}) => h({
    httpMethod: 'GET',
    headers: extra.headers || {},
    queryStringParameters: { site: 'splash', ...q },
  }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));

  return { db, h, post, get, cadastro };
}

async function logar(a) {
  const r = await a.post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' });
  assert.equal(r.statusCode, 200, r.body);
  return r.json.token;
}

function fotoValidaJpegBase64(size = 100) {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf.toString('base64');
}

test('ED1. sem login não salva nem edita nada (HTTP 401)', async () => {
  const a = await montar();

  const r1 = await a.post({ acao: 'site-salvar', conteudo: { textos: { titulo: 'Novo Título' } } });
  assert.equal(r1.statusCode, 401);

  const r2 = await a.post({ acao: 'foto-enviar', dados: fotoValidaJpegBase64(500), tipo: 'image/jpeg' });
  assert.equal(r2.statusCode, 401);

  const r3 = await a.post({ acao: 'foto-editar', id: '123456789012345678901234', legenda: 'Nova' });
  assert.equal(r3.statusCode, 401);

  const r4 = await a.post({ acao: 'foto-remover', id: '123456789012345678901234' });
  assert.equal(r4.statusCode, 401);

  const r5 = await a.post({ acao: 'video-salvar', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.equal(r5.statusCode, 401);
});

test('ED2. foto grande recusada (> 600 KB) e foto válida aceita', async () => {
  const a = await montar();
  const token = await logar(a);

  // Foto grande (> 600 KB)
  const fotoGrande = fotoValidaJpegBase64(601 * 1024);
  const rG = await a.post({ acao: 'foto-enviar', token, dados: fotoGrande, tipo: 'image/jpeg', unidade: 'santa-adelia' });
  assert.equal(rG.statusCode, 400);
  assert.match(rG.json.error, /grande demais/i);

  // Foto válida
  const fotoOk = fotoValidaJpegBase64(10 * 1024);
  const rOk = await a.post({ acao: 'foto-enviar', token, dados: fotoOk, tipo: 'image/jpeg', unidade: 'santa-adelia', legenda: 'Piscina principal' });
  assert.equal(rOk.statusCode, 201);
  assert.equal(rOk.json.ok, true);
  assert.ok(rOk.json.id);

  // Listar fotos da unidade
  const rList = await a.get({ foto_listar: '1', unidade: 'santa-adelia' });
  assert.equal(rList.statusCode, 200);
  assert.equal(rList.json.fotos.length, 1);
  assert.equal(rList.json.fotos[0].legenda, 'Piscina principal');
});

test('ED3. vídeo com domínio não permitido recusado e embed seguro gerado para vídeos permitidos', async () => {
  const a = await montar();
  const token = await logar(a);

  // Domínio proibido
  const rProibido = await a.post({ acao: 'video-salvar', token, url: 'https://site-de-videos-desconhecido.com/v/12345', titulo: 'Vídeo Suspeito' });
  assert.equal(rProibido.statusCode, 400);
  assert.match(rProibido.json.error, /não permitido/i);

  // YouTube
  const rYt = await a.post({ acao: 'video-salvar', token, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', titulo: 'Tour Santa Adélia', unidade: 'santa-adelia' });
  assert.equal(rYt.statusCode, 201);
  assert.equal(rYt.json.video.provedor, 'youtube');
  assert.equal(rYt.json.video.embed_url, 'https://www.youtube.com/embed/dQw4w9WgXcQ');

  // Instagram Reel
  const rIg = await a.post({ acao: 'video-salvar', token, url: 'https://www.instagram.com/reel/C1234567890/', titulo: 'Reel da Festa', unidade: 'santa-barbara' });
  assert.equal(rIg.statusCode, 201);
  assert.equal(rIg.json.video.provedor, 'instagram');
  assert.equal(rIg.json.video.embed_url, 'https://www.instagram.com/p/C1234567890/embed/');

  // Vimeo
  const rVim = await a.post({ acao: 'video-salvar', token, url: 'https://vimeo.com/76979871', titulo: 'Vimeo Demo', unidade: 'santa-adelia' });
  assert.equal(rVim.statusCode, 201);
  assert.equal(rVim.json.video.provedor, 'vimeo');
  assert.equal(rVim.json.video.embed_url, 'https://player.vimeo.com/video/76979871');

  // Listar vídeos da unidade santa-adelia
  const rList = await a.get({ video_listar: '1', unidade: 'santa-adelia' });
  assert.equal(rList.statusCode, 200);
  assert.equal(rList.json.videos.length, 2);
});

test('ED4. fluxo de conteúdo: salvamento, histórico das versões e restauração', async () => {
  const a = await montar();
  const token = await logar(a);

  // Versão 1
  const v1 = { textos: { titulo: 'Versão 1 do Site Splash' }, aviso: { ativo: true, texto: 'Aviso V1', cor: 'warning' } };
  const rSalvar1 = await a.post({ acao: 'site-salvar', token, conteudo: v1 });
  assert.equal(rSalvar1.statusCode, 200);
  assert.equal(rSalvar1.json.conteudo.textos.titulo, 'Versão 1 do Site Splash');

  // Versão 2 (a V1 deve ir para o histórico)
  const v2 = { textos: { titulo: 'Versão 2 do Site Splash' }, aviso: { ativo: false, texto: 'Aviso V2', cor: 'info' } };
  const rSalvar2 = await a.post({ acao: 'site-salvar', token, conteudo: v2 });
  assert.equal(rSalvar2.statusCode, 200);

  // Listar histórico
  const rHist = await a.post({ acao: 'site-historico', token });
  assert.equal(rHist.statusCode, 200);
  assert.equal(rHist.json.historico.length, 1);
  const idV1 = rHist.json.historico[0].id;

  // Restaurar Versão 1
  const rRestaurar = await a.post({ acao: 'site-restaurar', token, id: idV1 });
  assert.equal(rRestaurar.statusCode, 200);
  assert.equal(rRestaurar.json.conteudo.textos.titulo, 'Versão 1 do Site Splash');

  // Consulta pública retorna a versão restaurada
  const rPublico = await a.get({ conteudo: '1' });
  assert.equal(rPublico.statusCode, 200);
  assert.equal(rPublico.json.conteudo.textos.titulo, 'Versão 1 do Site Splash');
  assert.equal(rPublico.json.conteudo.aviso.texto, 'Aviso V1');
});

test('ED5. ação site-desfazer apaga conteúdo personalizado e volta ao original', async () => {
  const a = await montar();
  const token = await logar(a);

  await a.post({ acao: 'site-salvar', token, conteudo: { textos: { titulo: 'Título Temporário' } } });

  const rAntes = await a.get({ conteudo: '1' });
  assert.equal(rAntes.json.conteudo.textos.titulo, 'Título Temporário');

  // Desfazer
  const rDesfazer = await a.post({ acao: 'site-desfazer', token });
  assert.equal(rDesfazer.statusCode, 200);

  const rDepois = await a.get({ conteudo: '1' });
  assert.equal(rDepois.statusCode, 200);
  assert.equal(rDepois.json.conteudo, null);
});

test('ED6. público não vê chave Pix nem dados sensíveis no conteúdo', async () => {
  const a = await montar();

  // Consulta pública de config
  const rConfig = await a.get({});
  assert.equal(rConfig.statusCode, 200);
  assert.equal(rConfig.json.pix, undefined);

  // Consulta pública de conteúdo
  const rConteudo = await a.get({ conteudo: '1' });
  assert.equal(rConteudo.statusCode, 200);
  assert.equal(JSON.stringify(rConteudo.json).includes('chave-pix-secreta-da-amanda@pix.com'), false);
});
