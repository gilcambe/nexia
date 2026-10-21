'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, montarConfig, hashSenha, COLLECTION } = require('../../netlify/functions/nutri.js');
const { NUTRIS } = require('../../clientes/nutris.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const SALT_TESTE = '1234567890abcdef1234567890abcdef';

async function getCadastroTeste() {
  const hash = await hashSenha('CODIGONUTRI123', SALT_TESTE);
  return {
    nome: 'Adriano Blumer Teste',
    versao: 1,
    codigo_salt: SALT_TESTE,
    codigo_hash: hash,
    config: NUTRIS.adriano.config,
  };
}

const mw = role => ({ verifyBearerToken: async (e) => (e.headers && e.headers.authorization ? { ok: true, uid: 'm', role } : { ok: false }) });

async function montar(opts = {}) {
  const db = opts.db || fakeDb();
  let agora = opts.agora || Date.parse('2026-10-12T12:00:00Z');
  const cadastro = opts.cadastro || (await getCadastroTeste());

  const h = createHandler({
    getDb: () => db,
    getMw: () => mw(opts.role || 'user'),
    getCadastro: s => (s === 'adriano' ? cadastro : undefined),
    getLista: () => ({ adriano: cadastro }),
    now: () => agora,
  });

  let ip = 0;
  const post = (body, extra = {}) => h({
    httpMethod: 'POST',
    headers: { 'cf-connecting-ip': extra.ip || '10.0.0.' + (++ip), ...(extra.headers || {}) },
    body: JSON.stringify({ site: 'adriano', ...body }),
  }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));

  const get = (q, extra = {}) => h({
    httpMethod: 'GET',
    headers: extra.headers || {},
    queryStringParameters: { site: 'adriano', ...q },
  }).then(r => {
    let json = {};
    try { json = JSON.parse(r.body || '{}'); } catch { json = {}; }
    return { ...r, json };
  });

  return { db, h, post, get, setAgora: t => { agora = t; }, cadastro };
}

async function logar(a, ip) {
  const r = await a.post({ acao: 'primeiro-acesso', codigo: 'CODIGONUTRI123', senha_nova: 'senhaValida123' }, ip ? { ip } : {});
  assert.equal(r.statusCode, 200, r.body);
  return r.json.token;
}

test('NUT1. público: consulta config geral com dados reais', async () => {
  const a = await montar();
  const pub = await a.get({});
  assert.equal(pub.statusCode, 200);
  assert.equal(pub.json.nome, 'Adriano Blumer');
  assert.equal(pub.json.email, 'nutri.adrianoblumer@gmail.com');
  assert.equal(pub.json.biolink, 'https://biolink.website/nutriadriano');
  assert.match(pub.json.endereco, /Vila Mariana/);
});

test('NUT2. primeiro acesso com código único e rejeição na segunda tentativa', async () => {
  const a = await montar();

  // Tentar entrar antes do primeiro acesso dá aviso para usar código de ativação
  const antes = await a.post({ acao: 'entrar', senha: 'qualquercoisa' });
  assert.equal(antes.statusCode, 400);
  assert.equal(antes.json.primeiro_acesso, true);

  // Primeiro acesso normal com código
  const token = await logar(a);
  assert.match(token, /^[a-f0-9]{64}$/);

  // Segunda tentativa com código de primeiro acesso deve falhar
  const seg = await a.post({ acao: 'primeiro-acesso', codigo: 'CODIGONUTRI123', senha_nova: 'outraSenha456' });
  assert.equal(seg.statusCode, 400);
  assert.match(seg.json.error, /já tem senha/);

  // Login normal com a nova senha deve funcionar
  const ent = await a.post({ acao: 'entrar', senha: 'senhaValida123' });
  assert.equal(ent.statusCode, 200);
  assert.match(ent.json.token, /^[a-f0-9]{64}$/);
});

test('NUT3. conta sem ativação do administrador exibe aviso', async () => {
  const a = await montar({ cadastro: { nome: 'Adriano Inativo', versao: 1, config: NUTRIS.adriano.config } });
  const res = await a.post({ acao: 'entrar', senha: '123' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json.sem_ativacao, true);

  const res1 = await a.post({ acao: 'primeiro-acesso', codigo: '123', senha_nova: 'senha123' });
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.json.sem_ativacao, true);
});

test('NUT4. salvar conteúdo, histórico e restauração', async () => {
  const a = await montar();
  const token = await logar(a);

  // Tentar salvar sem login deve dar 401
  const semLogin = await a.post({ acao: 'site-salvar', conteudo: { hero: { title: 'Teste Sem Login' } } });
  assert.equal(semLogin.statusCode, 401);

  // Salvar versão 1
  const v1Data = {
    hero: { title: 'Nutrição Esportiva V1', subtitle: 'Versão 1' },
    dicas: [{ titulo: 'Dica 1', texto: 'Coma bem', categoria: 'Treino' }],
  };
  const s1 = await a.post({ acao: 'site-salvar', token, conteudo: v1Data });
  assert.equal(s1.statusCode, 200);
  assert.equal(s1.json.conteudo.hero.title, 'Nutrição Esportiva V1');

  // Salvar versão 2
  const v2Data = {
    hero: { title: 'Nutrição Esportiva V2', subtitle: 'Versão 2' },
  };
  const s2 = await a.post({ acao: 'site-salvar', token, conteudo: v2Data });
  assert.equal(s2.statusCode, 200);

  // Consultar histórico
  const hist = await a.post({ acao: 'site-historico', token });
  assert.equal(hist.statusCode, 200);
  assert.equal(hist.json.historico.length, 1);

  const histId = hist.json.historico[0].id;

  // Restaurar versão anterior
  const rest = await a.post({ acao: 'site-restaurar', token, id: histId });
  assert.equal(rest.statusCode, 200);
  assert.equal(rest.json.conteudo.hero.title, 'Nutrição Esportiva V1');

  // Consulta pública reflete o conteúdo restaurado
  const pub = await a.get({ conteudo: 1 });
  assert.equal(pub.statusCode, 200);
  assert.equal(pub.json.conteudo.hero.title, 'Nutrição Esportiva V1');
});

test('NUT5. upload de fotos: validação de assinatura, tamanho e grupos', async () => {
  const a = await montar();
  const token = await logar(a);

  // Foto PNG válida de 4 bytes
  const pngValidaBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

  // Recusa sem token
  const semTok = await a.post({ acao: 'foto-enviar', dados: pngValidaBase64, tipo: 'image/png' });
  assert.equal(semTok.statusCode, 401);

  // Recusa se arquivo não for foto (assinatura incorreta)
  const fakeData = Buffer.from([0x00, 0x11, 0x22, 0x33]).toString('base64');
  const fakeRes = await a.post({ acao: 'foto-enviar', token, dados: fakeData, tipo: 'image/png' });
  assert.equal(fakeRes.statusCode, 400);
  assert.match(fakeRes.json.error, /não é uma foto válida/);

  // Recusa se tamanho exceder 600 KB
  const bigBuf = Buffer.alloc(601 * 1024);
  bigBuf[0] = 0x89; bigBuf[1] = 0x50; bigBuf[2] = 0x4e; bigBuf[3] = 0x47;
  const bigRes = await a.post({ acao: 'foto-enviar', token, dados: bigBuf.toString('base64'), tipo: 'image/png' });
  assert.equal(bigRes.statusCode, 400);
  assert.match(bigRes.json.error, /grande demais/);

  // Upload válido com grupo
  const upOk = await a.post({
    acao: 'foto-enviar',
    token,
    dados: pngValidaBase64,
    tipo: 'image/png',
    grupo: 'consultorio',
    legenda: 'Foto do consultório na Vila Mariana',
  });
  assert.equal(upOk.statusCode, 201);
  const fotoId = upOk.json.id;

  // Listagem pública de fotos
  const listPub = await a.get({ foto_listar: 1, grupo: 'consultorio' });
  assert.equal(listPub.statusCode, 200);
  assert.equal(listPub.json.fotos.length, 1);
  assert.equal(listPub.json.fotos[0].id, fotoId);
  assert.equal(listPub.json.fotos[0].grupo, 'consultorio');

  // Buscar binário da foto via GET público
  const fotoBin = await a.get({ foto: fotoId });
  assert.equal(fotoBin.statusCode, 200);
  assert.equal(fotoBin.headers['Content-Type'], 'image/png');
  assert.equal(fotoBin.isBase64Encoded, true);
});

test('NUT6. configuração privada do Instagram DM', async () => {
  const a = await montar();
  const token = await logar(a);

  // Leitura inicial vazia
  const lerIni = await a.post({ acao: 'dm-config-ler', token });
  assert.equal(lerIni.statusCode, 200);
  assert.equal(lerIni.json.regras.length, 0);
  assert.match(lerIni.json.mensagem_padrao, /Deixe sua mensagem completa/);

  // Salvar regras com sanitização e validação de link https
  const regras = [
    {
      palavras: ['consulta', 'agendar', 'horário'],
      mensagem: 'Para agendamentos acesse o biolink!',
      link: 'https://biolink.website/nutriadriano',
      ativa: true,
    },
    {
      palavras: ['invalido'],
      mensagem: 'Link http invalido',
      link: 'http://site-nao-https.com',
      ativa: true,
    },
  ];

  const salv = await a.post({
    acao: 'dm-config-salvar',
    token,
    regras,
    mensagem_padrao: 'Resposta padrão customizada',
  });
  assert.equal(salv.statusCode, 200);
  assert.equal(salv.json.config.regras.length, 2);
  assert.equal(salv.json.config.regras[0].link, 'https://biolink.website/nutriadriano');
  assert.equal(salv.json.config.regras[1].link, '', 'links não-HTTPS são zerados por segurança');

  // Leitura reflete as regras salvas
  const lerFim = await a.post({ acao: 'dm-config-ler', token });
  assert.equal(lerFim.json.regras.length, 2);
  assert.equal(lerFim.json.mensagem_padrao, 'Resposta padrão customizada');
});

test('NUT7. isolamento de dados privados em chamadas públicas', async () => {
  const a = await montar();
  const token = await logar(a);

  // Salvar DM config privada
  await a.post({
    acao: 'dm-config-salvar',
    token,
    regras: [{ palavras: ['privado'], mensagem: 'segredo' }],
  });

  // Chamada pública para /api/nutri?site=adriano
  const pubCfg = await a.get({});
  assert.equal(pubCfg.statusCode, 200);
  assert.equal(pubCfg.json.regras, undefined);
  assert.equal(pubCfg.json.senha_hash, undefined);
  assert.equal(pubCfg.json.senha_salt, undefined);

  // Chamada pública para conteúdo
  const pubCont = await a.get({ conteudo: 1 });
  assert.equal(pubCont.statusCode, 200);
  assert.equal(pubCont.json.regras, undefined);

  // Chamada pública para fotos
  const pubFotos = await a.get({ foto_listar: 1 });
  assert.equal(pubFotos.statusCode, 200);
  assert.equal(pubFotos.json.regras, undefined);
});

test('NUT8. suporte KERNEX master: lista nutris e abre sessão de suporte de 8 h', async () => {
  const master = await montar({ role: 'master' });
  const auth = { headers: { authorization: 'Bearer tokenMaster' } };

  const lista = await master.get({ suporte: 'lista' }, auth);
  assert.equal(lista.statusCode, 200);
  assert.equal(lista.json.nutris[0].site, 'adriano');

  const suporte = await master.post({ acao: 'suporte', site: 'adriano' }, auth);
  assert.equal(suporte.statusCode, 200, suporte.body);
  assert.match(suporte.json.token, /^[a-f0-9]{64}$/);
  assert.equal(suporte.json.horas, 8);
});
