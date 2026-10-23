'use strict';
// Cancelamento, contrato, música e comprovante enviado pelo cliente.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, hashSenha } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');
const SP = require('../../sites/splash/agenda/painel.js');

const SALT = '1234567890abcdef1234567890abcdef';
let ipN = 0;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200, 1)]).toString('base64');

async function montar() {
  const db = fakeDb();
  const cadastro = { nome: 'Splash Teste', versao: 1, codigo_salt: SALT, codigo_hash: await hashSenha('CODIGO123', SALT), config: LOCACOES.splash.config };
  const h = createHandler({ getDb: () => db, getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }), getCadastro: s => (s === 'splash' ? cadastro : undefined), getLista: () => ({ splash: cadastro }), now: () => Date.parse('2026-10-12T12:00:00Z') });
  const post = body => h({ httpMethod: 'POST', headers: { 'cf-connecting-ip': '78.2.' + ((ipN >> 8) & 255) + '.' + (ipN++ & 255) }, body: JSON.stringify({ site: 'splash', ...body }) }).then(r => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') }));
  const t = (await post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' })).json.token;
  return { post, api: (acao, e = {}) => post({ acao, token: t, ...e }), publico: () => h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'splash' } }).then(r => JSON.parse(r.body)), lista: u => h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'splash', foto_listar: '1', ...(u ? { unidade: u } : {}) } }).then(r => JSON.parse(r.body)) };
}

test('CONTR1. cancelamento e música saem na rota pública; contrato não', async () => {
  const a = await montar();
  const r = await a.api('config', { config: { cancelamento: { horas: 72, texto: 'Sem devolução do sinal.' }, contrato: 'Contrato {nome}', musica: { estilo: 'tropical', url: 'https://x.com/a.mp3' } } });
  assert.equal(r.status, 200);
  const pub = await a.publico();
  assert.deepEqual(pub.cancelamento, { horas: 72, texto: 'Sem devolução do sinal.' });
  assert.deepEqual(pub.musica, { estilo: 'tropical', url: 'https://x.com/a.mp3' });
  assert.equal(pub.contrato, undefined);
  const lig = (await a.api('listar', { de: '2026-10-12', ate: '2026-10-12' })).json.config;
  assert.equal(lig.contrato, 'Contrato {nome}');
  const ruim = await a.api('config', { config: { cancelamento: { horas: 99999 }, musica: { estilo: 'xx', url: 'javascript:alert(1)' } } });
  assert.equal(ruim.json.config.cancelamento.horas, 720);
  assert.deepEqual(ruim.json.config.musica, { estilo: 'alegre', url: '' });
});

test('CONTR2. comprovante: protocolo + WhatsApp conferem; não aparece na lista pública', async () => {
  const a = await montar();
  const ped = await a.post({ acao: 'pedir', unidade: 'santa-adelia', data: '2026-10-25', nome: 'Cliente C', whatsapp: '11977776666', tipo_evento: 'Aniversário', convidados: 10, consentimento: true });
  assert.equal(ped.status, 201);
  const base = { acao: 'comprovante-enviar', protocolo: ped.json.protocolo, dados: PNG, tipo: 'image/png' };
  assert.equal((await a.post({ ...base, whatsapp: '11000000000' })).status, 404, 'WhatsApp errado');
  assert.equal((await a.post({ ...base, whatsapp: '11977776666', dados: 'nao-e-imagem!!' })).status, 400);
  const ok = await a.post({ ...base, whatsapp: '(11) 97777-6666' });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  const pend = (await a.api('listar', { de: '2026-10-01', ate: '2026-10-31' })).json.pendentes.find(i => i.protocolo === ped.json.protocolo);
  assert.equal(pend.comprovantes.length, 1);
  assert.equal((await a.lista()).fotos.length, 0, 'lista pública sem comprovantes');
  assert.equal((await a.lista('comprovantes')).fotos.length, 0);
});

test('CONTR3. contrato é preenchido com os dados da reserva', () => {
  const cfg = { nome: 'Splash', unidades: [{ id: 'u', nome: 'Unidade U', endereco: 'Rua A, 1' }], cancelamento: { horas: 48, texto: '' } };
  const txt = SP.preencherContrato('{nome}|{data}|{unidade}|{endereco}|{valor_total}|{saldo}|{cancelamento}|{xyz}', { nome: 'Ana', data: '2026-11-02', unidade: 'u', valor_total: 1000, valor_sinal: 300, pagamentos: [{ valor: 300 }] }, cfg);
  assert.match(txt, /^Ana\|02\/11\/2026\|Unidade U\|Rua A, 1\|R\$\s?1\.000,00\|R\$\s?700,00\|.*48 horas.*\|\{xyz\}$/);
  const msg = SP.montarMensagemConfirmacao({ nome: 'Ana', data: '2026-11-02', unidade: 'u' }, { ...cfg, contrato: 'Olá {nome}' });
  assert.match(msg, /confirmada/); assert.match(msg, /Olá Ana/);
});
