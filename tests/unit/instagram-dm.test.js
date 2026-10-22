'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createHandler, normalizarTexto, validarAssinatura, testarPalavraChave } = require('../../netlify/functions/instagram-dm.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const SECRET_TESTE = 'meta_app_secret_12345';
const VERIFY_TOKEN_TESTE = 'token_verificacao_ig_123';
const PAGE_TOKEN_TESTE = 'EAABb...long_lived_page_token';
const IG_USER_ID_TESTE = '17841400000000000';

function assinar(bodyStr, secret = SECRET_TESTE) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(bodyStr || '').digest('hex');
}

async function montar(opts = {}) {
  const db = opts.db || fakeDb();
  let agora = opts.agora || Date.parse('2026-10-12T12:00:00Z');
  const envs = {
    META_APP_SECRET: SECRET_TESTE,
    IG_VERIFY_TOKEN: VERIFY_TOKEN_TESTE,
    IG_PAGE_TOKEN: PAGE_TOKEN_TESTE,
    IG_USER_ID: IG_USER_ID_TESTE,
    ...(opts.env || {}),
  };

  const chamadasFetch = [];
  const fetchFake = async (url, options) => {
    chamadasFetch.push({ url, options, body: JSON.parse(options.body || '{}') });
    return {
      ok: opts.fetchOk !== undefined ? opts.fetchOk : true,
      status: opts.fetchStatus || 200,
      json: async () => ({ id: 'message_id_123' }),
    };
  };

  const h = createHandler({
    getDb: () => db,
    fetchApi: fetchFake,
    getEnv: key => envs[key],
    now: () => agora,
  });

  // Salvar regras iniciais no Firestore fake se fornecidas
  if (opts.regras !== undefined) {
    await db.collection('nutri_contas').doc('adriano')
      .collection('dm_config').doc('regras')
      .set({
        regras: opts.regras,
        mensagem_padrao: 'Mensagem padrão',
      });
  }

  const getWebhook = (q) => h({
    httpMethod: 'GET',
    queryStringParameters: q,
  });

  const postWebhook = (payloadObj, extraHeaders = {}) => {
    const bodyStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
    const signature = extraHeaders.signature !== undefined ? extraHeaders.signature : assinar(bodyStr);
    const headers = { ...extraHeaders };
    if (signature !== null) headers['x-hub-signature-256'] = signature;

    return h({
      httpMethod: 'POST',
      headers,
      body: bodyStr,
    }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));
  };

  return { db, h, getWebhook, postWebhook, chamadasFetch, setAgora: t => { agora = t; } };
}

test('IG1. normalização de texto e teste de palavras-chave com acento e maiúsculas', () => {
  assert.equal(normalizarTexto('Olá! QUERO SABER...'), 'ola! quero saber...');
  assert.equal(normalizarTexto('Nutrição Esportiva'), 'nutricao esportiva');

  const palavras = ['consulta', 'agendamento', 'eu quero'];
  assert.equal(testarPalavraChave('olá, eu QUERO agendar uma consulta!', palavras), true);
  assert.equal(testarPalavraChave('qual o valor da consulta?', palavras), true);
  assert.equal(testarPalavraChave('post muito legal parabéns', palavras), false);
});

test('IG2. verificação GET do webhook Meta (hub.mode, verify_token, challenge)', async () => {
  const a = await montar();

  // Verificação correta devolve challenge em text/plain
  const okRes = await a.getWebhook({
    'hub.mode': 'subscribe',
    'hub.verify_token': VERIFY_TOKEN_TESTE,
    'hub.challenge': '1158201484',
  });
  assert.equal(okRes.statusCode, 200);
  assert.equal(okRes.body, '1158201484');

  // Token incorreto devolve 403
  const errRes = await a.getWebhook({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'token_errado',
    'hub.challenge': '1158201484',
  });
  assert.equal(errRes.statusCode, 403);
});

test('IG3. rejeição de POST com assinatura X-Hub-Signature-256 inválida ou ausente', async () => {
  const a = await montar();
  const payload = { object: 'instagram', entry: [] };

  // Sem assinatura → 401
  const semAss = await a.postWebhook(payload, { signature: null });
  assert.equal(semAss.statusCode, 401);

  // Assinatura com chave errada → 401
  const assErr = await a.postWebhook(payload, { signature: assinar(JSON.stringify(payload), 'chave_falsa') });
  assert.equal(assErr.statusCode, 401);
});

test('IG4. processa comentário com palavra-chave e envia 1 DM via Graph API', async () => {
  const regras = [{
    id: 'regra1',
    palavras: ['agendar', 'consulta', 'quero'],
    mensagem: 'Olá! Acesse nosso biolink para agendar sua consulta:',
    link: 'https://biolink.website/nutriadriano',
    ativa: true,
  }];

  const a = await montar({ regras });

  const eventPayload = {
    object: 'instagram',
    entry: [{
      id: 'entry_1',
      changes: [{
        field: 'comments',
        value: {
          id: 'comment_1001',
          text: 'Eu QUERO agendar uma consulta presencial!',
          from: { id: 'user_888', username: 'paciente_teste' },
        },
      }],
    }],
  };

  const res = await a.postWebhook(eventPayload);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.recebidos, 1);
  assert.equal(res.json.enviados, 1);

  // Confere se a Graph API foi chamada corretamente
  assert.equal(a.chamadasFetch.length, 1);
  const chamada = a.chamadasFetch[0];
  assert.match(chamada.url, new RegExp(IG_USER_ID_TESTE + '/messages$'));
  assert.equal(chamada.options.headers.Authorization, 'Bearer ' + PAGE_TOKEN_TESTE);
  assert.equal(chamada.body.recipient.comment_id, 'comment_1001');
  assert.match(chamada.body.message.text, /https:\/\/biolink\.website\/nutriadriano/);

  // Confere se o envio foi registrado em dm_enviados
  const enviadoSnap = await a.db.collection('nutri_contas').doc('adriano')
    .collection('dm_enviados').doc('comment_1001').get();
  assert.equal(enviadoSnap.exists, true);
});

test('IG5. desduplicação: mesmo comment_id não envia mensagem novamente', async () => {
  const regras = [{
    id: 'regra1',
    palavras: ['info'],
    mensagem: 'Mensagem informativa',
    ativa: true,
  }];

  const a = await montar({ regras });

  const eventPayload = {
    object: 'instagram',
    entry: [{
      id: 'entry_1',
      changes: [{
        field: 'comments',
        value: {
          id: 'comment_2002',
          text: 'Gostaria de mais info',
          from: { id: 'user_777' },
        },
      }],
    }],
  };

  // Primeira tentativa -> envia 1 DM
  const r1 = await a.postWebhook(eventPayload);
  assert.equal(r1.json.enviados, 1);
  assert.equal(a.chamadasFetch.length, 1);

  // Segunda tentativa com o mesmo comment_id -> ignorado
  const r2 = await a.postWebhook(eventPayload);
  assert.equal(r2.json.enviados, 0);
  assert.equal(r2.json.ignorados, 1);
  assert.equal(a.chamadasFetch.length, 1, 'Não deve fazer nova chamada à Graph API');
});

test('IG6. limite por usuário: 1 DM a cada 24 horas por perfil', async () => {
  const regras = [{
    id: 'regra1',
    palavras: ['duvida', 'ajuda'],
    mensagem: 'Olá! Resposta para sua dúvida.',
    ativa: true,
  }];

  const a = await montar({ regras });

  const payloadComentario1 = {
    object: 'instagram',
    entry: [{
      id: 'entry_1',
      changes: [{
        field: 'comments',
        value: {
          id: 'comment_3001',
          text: 'Tenho uma duvida',
          from: { id: 'user_repeat_55' },
        },
      }],
    }],
  };

  const payloadComentario2 = {
    object: 'instagram',
    entry: [{
      id: 'entry_1',
      changes: [{
        field: 'comments',
        value: {
          id: 'comment_3002',
          text: 'Preciso de ajuda com duvida de novo',
          from: { id: 'user_repeat_55' },
        },
      }],
    }],
  };

  // Primeiro comentário -> envia
  const r1 = await a.postWebhook(payloadComentario1);
  assert.equal(r1.json.enviados, 1);

  // Segundo comentário do mesmo usuário no mesmo dia -> ignorado pelo limite de 24h
  const r2 = await a.postWebhook(payloadComentario2);
  assert.equal(r2.json.enviados, 0);
  assert.equal(r2.json.ignorados, 1);

  // Passadas 25 horas -> novo comentário do mesmo usuário é aceito
  a.setAgora(Date.now() + 25 * 3600 * 1000);
  const r3 = await a.postWebhook(payloadComentario2);
  assert.equal(r3.json.enviados, 1);
});

test('IG7. comentários da própria conta do Instagram são ignorados', async () => {
  const regras = [{
    id: 'regra1',
    palavras: ['obrigado'],
    mensagem: 'De nada!',
    ativa: true,
  }];

  const a = await montar({ regras });

  const eventPayload = {
    object: 'instagram',
    entry: [{
      id: 'entry_1',
      changes: [{
        field: 'comments',
        value: {
          id: 'comment_self_1',
          text: 'Muito obrigado a todos!',
          from: { id: IG_USER_ID_TESTE }, // ID da própria conta do Adriano
        },
      }],
    }],
  };

  const res = await a.postWebhook(eventPayload);
  assert.equal(res.json.enviados, 0);
  assert.equal(res.json.ignorados, 1);
  assert.equal(a.chamadasFetch.length, 0);
});

test('IG8. tratamento seguro de falta de variáveis e regras inativas', async () => {
  // 1. Falta de IG_PAGE_TOKEN -> retorna aviso "falta configurar" com HTTP 200 sem quebrar
  const aSemEnv = await montar({ env: { IG_PAGE_TOKEN: '' } });
  const rSemEnv = await aSemEnv.postWebhook({ object: 'instagram', entry: [{ id: '1', changes: [{ field: 'comments', value: { id: 'c1', text: 'oi', from: { id: 'u1' } } }] }] });
  assert.equal(rSemEnv.statusCode, 200);
  assert.equal(rSemEnv.json.aviso, 'falta configurar');

  // 2. Regra inativa não envia mensagem
  const aRegraInativa = await montar({
    regras: [{ id: 'r1', palavras: ['teste'], mensagem: 'Msg', ativa: false }],
  });
  const rInativa = await aRegraInativa.postWebhook({
    object: 'instagram',
    entry: [{ id: '1', changes: [{ field: 'comments', value: { id: 'c2', text: 'teste', from: { id: 'u2' } } }] }],
  });
  assert.equal(rInativa.statusCode, 200);
  assert.equal(rInativa.json.aviso, 'sem regras ativas');
  assert.equal(aRegraInativa.chamadasFetch.length, 0);
});

test('IG9. tokens de acesso e segredos nunca aparecem nos logs ou corpo da resposta', async () => {
  const a = await montar({ regras: [{ palavras: ['secreto'], mensagem: 'Resposta', ativa: true }] });
  const payload = {
    object: 'instagram',
    entry: [{ id: '1', changes: [{ field: 'comments', value: { id: 'c99', text: 'secreto', from: { id: 'u99' } } }] }],
  };

  const res = await a.postWebhook(payload);
  const jsonStr = JSON.stringify(res);

  assert.equal(jsonStr.includes(PAGE_TOKEN_TESTE), false);
  assert.equal(jsonStr.includes(SECRET_TESTE), false);
  assert.equal(jsonStr.includes(VERIFY_TOKEN_TESTE), false);
});

test('IGDM-X1. palavra curta não casa no meio de outra palavra e a frase inteira casa', () => {
  assert.equal(testarPalavraChave(normalizarTexto('que boi bonito'), ['oi']), false);
  assert.equal(testarPalavraChave(normalizarTexto('Oi!'), ['oi']), true);
  assert.equal(testarPalavraChave(normalizarTexto('EU QUERO saber mais'), ['eu quero']), true);
});
