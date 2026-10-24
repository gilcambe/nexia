'use strict';
// Preço por semana/fim de semana/promoção, extras com promoção, comissão, consulta pública e senhas iniciais.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, hashSenha, resumoFinanceiro } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

let ipN = 0;
async function montar() {
  const db = fakeDb();
  const cadastro = { ...LOCACOES.splash, codigo_salt: 'aa'.repeat(16), codigo_hash: await hashSenha('CODIGO123', 'aa'.repeat(16)) };
  const h = createHandler({ getDb: () => db, getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }), getCadastro: s => (s === 'splash' ? cadastro : undefined), getLista: () => ({ splash: cadastro }), now: () => Date.parse('2026-10-12T12:00:00Z') });
  const post = body => h({ httpMethod: 'POST', headers: { 'cf-connecting-ip': '79.3.' + ((ipN >> 8) & 255) + '.' + (ipN++ & 255) }, body: JSON.stringify({ site: 'splash', ...body }) }).then(r => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') }));
  const get = q => h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'splash', ...q } }).then(r => JSON.parse(r.body));
  return { post, get };
}

test('PRECO1. senhas iniciais ADMIN01 e AMANDA01 entram; trocar a senha desliga as iniciais', async () => {
  const a = await montar();
  for (const s of ['ADMIN01', 'amanda01', ' Admin01 ']) assert.equal((await a.post({ acao: 'entrar', senha: s })).status, 200, s);
  assert.equal((await a.post({ acao: 'entrar', senha: 'errada123' })).status, 400, 'sem senha criada ainda pede o primeiro acesso');
  const tok = (await a.post({ acao: 'entrar', senha: 'AMANDA01' })).json.token;
  assert.equal((await a.post({ acao: 'trocar-senha', token: tok, senha_atual: 'AMANDA01', senha_nova: 'minhaSenha77' })).status, 200);
  assert.equal((await a.post({ acao: 'entrar', senha: 'AMANDA01' })).status, 401, 'inicial deixa de valer');
  assert.equal((await a.post({ acao: 'entrar', senha: 'ADMIN01' })).status, 401);
  assert.equal((await a.post({ acao: 'entrar', senha: 'minhaSenha77' })).status, 200);
});

test('PRECO2. diária muda entre semana, fim de semana e promoção; extra com promoção; pedido usa o valor certo', async () => {
  const a = await montar();
  const tok = (await a.post({ acao: 'entrar', senha: 'ADMIN01' })).json.token;
  const cfg = await a.post({ acao: 'config', token: tok, config: {
    unidades: [{ id: 'santa-adelia', nome: 'Splash Santa Adélia', valor_semana: 500, valor_fds: 900 }, { id: 'santa-barbara', nome: 'Splash Santa Bárbara', valor_diaria: 700, terceiro: true, comissao: { tipo: 'percentual', valor: 10 } }],
    extras: [{ id: 'decoracao', nome: 'Decoração', valor: 400, valor_promo: 300, ativo: true }],
    datas_especiais: [{ unidade: 'santa-adelia', de: '2026-10-28', ate: '2026-10-28', valor: 650, texto: 'Promo de terça' }],
    sinal: { tipo: 'percentual', valor: 30 },
  } });
  assert.equal(cfg.status, 200, JSON.stringify(cfg.json));
  const pub = await a.get({});
  assert.equal(pub.unidades[1].comissao, undefined, 'comissão não é pública');
  assert.equal(pub.unidades[1].terceiro, undefined);
  const mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.deepEqual(mapa.precos['2026-10-21'], { v: 500 });      // quarta
  assert.deepEqual(mapa.precos['2026-10-24'], { v: 900 });      // sábado
  assert.deepEqual(mapa.precos['2026-10-28'], { v: 650, p: 'Promo de terça' });
  const ped = base => a.post({ acao: 'pedir', unidade: 'santa-adelia', nome: 'Cli', whatsapp: '11955554444', tipo_evento: 'Aniversário', convidados: 10, consentimento: true, ...base });
  const p1 = await ped({ data: '2026-10-24', extras: ['decoracao'] });
  assert.equal(p1.json.valor_total, 1200, 'fds 900 + decoração promocional 300');
  assert.equal(p1.json.sinal_valor, 360);
  const p2 = await ped({ data: '2026-10-28' });
  assert.equal(p2.json.valor_total, 650);
});

test('PRECO3. consulta pública da reserva exige protocolo + WhatsApp', async () => {
  const a = await montar();
  const p = await a.post({ acao: 'pedir', unidade: 'santa-adelia', data: '2026-10-21', nome: 'Cli', whatsapp: '11955554444', tipo_evento: 'Aniversário', convidados: 10, consentimento: true });
  assert.equal((await a.post({ acao: 'consultar', protocolo: p.json.protocolo, whatsapp: '11000000000' })).status, 404);
  const ok = await a.post({ acao: 'consultar', protocolo: p.json.protocolo.toLowerCase(), whatsapp: '(11) 95555-4444' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.status, 'pedido');
});

test('PRECO4. comissão da unidade de outro dono: devida, recebida e a receber', () => {
  const unidades = [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B', terceiro: true, comissao: { tipo: 'percentual', valor: 10 } }];
  const r = resumoFinanceiro([{ unidade: 'b', data: '2026-10-20', status: 'confirmado', valor_total: 1000, pagamentos: [{ valor: 300, data: '2026-10-01' }] }, { unidade: 'a', data: '2026-10-21', status: 'confirmado', valor_total: 500, pagamentos: [{ valor: 500, data: '2026-10-02' }] }],
    [{ unidade: 'b', data: '2026-10-25', valor: 40, tipo: 'comissao' }, { unidade: 'a', data: '2026-10-25', valor: 100 }], unidades, '2026-10-01', '2026-10-31');
  const b = r.por_unidade.find(u => u.id === 'b');
  assert.equal(b.comissao_devida, 100); assert.equal(b.comissao_recebida, 40); assert.equal(b.comissao_a_receber, 60);
  assert.equal(r.total.minha_receita, 540); assert.equal(r.total.meu_lucro, 440);
  assert.equal(r.total.despesas, 100, 'comissão recebida não conta como despesa');
});
