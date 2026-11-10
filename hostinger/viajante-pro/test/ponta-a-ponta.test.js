'use strict';
// Sobe o servidor da Hostinger com banco SQLite em memória (no lugar do MySQL) e SMTP falso,
// e passa pelos fluxos reais: páginas, cotação + e-mail, login do painel, trocar senha,
// viagens (criar/editar/listar/excluir), app do passageiro + chat, fotos, site, área do passageiro.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

process.env.VP_NAO_LIGAR = '1';
const { criarApp } = require('../server');
const { sqliteDriver } = require('../lib/drivers');

const emails = [];
const env = {
  FORCE_HTTPS: '0',
  SMTP_HOST: 'smtp.teste', SMTP_USER: 'contato@viajante.pro', SMTP_PASS: 'x', SMTP_FROM: 'contato@viajante.pro',
  LEADS_NOTIFY_EMAIL: 'cotacao.site@viajante.pro',
  VP_PAINEL_URL: 'https://viajante.pro',
};
const driver = sqliteDriver(':memory:');
const { servidor, db } = criarApp({ env, driver, smtp: { enviar: async m => { emails.push(m); return { messageId: '<t@x>' }; } } });
let base;

async function api(corpo, extra = {}) {
  const r = await fetch(base + '/api/viajante-pro' + (extra.qs || ''), {
    method: extra.method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: extra.method === 'GET' ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

function pbkdf2(senha, salt) {
  return crypto.pbkdf2Sync(senha, salt, 100000, 32, 'sha256').toString('hex');
}

test.before(async () => {
  await new Promise(r => servidor.listen(0, r));
  base = 'http://127.0.0.1:' + servidor.address().port;
  // Conta do painel com senha conhecida só para o teste.
  await db.collection('viajante_contas').doc('viajantepro').set({
    nome: 'Viajante Pro', senha_salt: 'saltteste', senha_hash: pbkdf2('senha-teste-1', 'saltteste'), config: {},
  });
});
test.after(() => new Promise(r => servidor.close(r)));

test('páginas abrem nas mesmas rotas e "/" é a landing', async () => {
  for (const rota of ['/', '/viajante-pro', '/viajante-pro/cotacoes', '/viajante-pro/viagens', '/viajante-pro/editar',
    '/viajante-pro/admin', '/vp/guia', '/vp/passageiro', '/viajante-pro/pax', '/viajante-pro/app']) {
    const r = await fetch(base + rota);
    assert.equal(r.status, 200, rota);
    assert.match(r.headers.get('content-type'), /text\/html/, rota);
  }
  const landing = await (await fetch(base + '/')).text();
  assert.doesNotMatch(landing, /gstatic\.com\/firebasejs/, 'SDK do Firebase deve ser trocado pelo adaptador');
  assert.match(landing, /\/core\/firebase-hostinger\.js/);
  for (const f of ['/viajante-pro/vp-marca.js', '/viajante-pro/app/app.js', '/viajante-pro/app/sw.js', '/core/nexia-boot.js', '/core/firebase-hostinger.js', '/viajante-pro/img/vp-oficial.jpg']) {
    assert.equal((await fetch(base + f)).status, 200, f);
  }
  assert.equal((await fetch(base + '/viajante-pro/../package.json')).status, 404);
  assert.equal((await fetch(base + '/netlify/functions/viajante-pro.js')).status, 404, 'código da API não pode ser baixado');
  assert.equal((await fetch(base + '/clientes/viajantepro.js')).status, 404);
  assert.equal((await fetch(base + '/.env')).status, 404);
  const cfg = await (await fetch(base + '/api/firebase-config')).json();
  assert.equal(cfg.hostinger, true);
});

test('cotação pública grava no banco e manda e-mail pelo SMTP', async () => {
  const { status, j } = await api({ acao: 'solicitar_cotacao', nome: 'Maria Teste', email: 'maria@exemplo.com', whatsapp: '11999998888', destino: 'Gramado', consentimento: true });
  assert.equal(status, 200, JSON.stringify(j));
  const snap = await db.collection('viajante_contas').doc('viajantepro').collection('cotacoes').get();
  assert.equal(snap.size, 1);
  assert.equal(snap.docs[0].data().nome, 'Maria Teste');
  const email = emails.find(e => /NOVA COTAÇÃO/.test(e.subject));
  assert.ok(email, 'e-mail da cotação deveria sair pelo SMTP');
  assert.deepEqual(email.to, ['"Atendimento Viajante Pro" <cotacao.site@viajante.pro>']);
  assert.match(email.from, /contato@viajante\.pro/);
  assert.match(email.html, /https:\/\/viajante\.pro\/viajante-pro\/cotacoes/);
  assert.equal(email.replyTo, 'maria@exemplo.com');
});

test('painel: login, cotações, trocar senha, viagens, chat, fotos e site', async () => {
  assert.equal((await api({ acao: 'entrar', senha: 'errada' })).status, 401);
  let r = await api({ acao: 'entrar', senha: 'senha-teste-1' });
  assert.equal(r.status, 200);
  let token = r.j.token;

  r = await api({ acao: 'cotacao-listar', token });
  assert.equal(r.j.cotacoes.length, 1);
  const cot = r.j.cotacoes[0];
  r = await api({ acao: 'cotacao-atualizar-status', token, id: cot.id, status: 'respondida' });
  assert.equal(r.status, 200, JSON.stringify(r.j));

  r = await api({ acao: 'trocar-senha', token, senha_atual: 'senha-teste-1', senha_nova: 'senha-teste-2' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal((await api({ acao: 'entrar', senha: 'senha-teste-2' })).status, 200);

  r = await api({ acao: 'viagem-criar', token, nome: 'Família Silva', destino: 'Gramado', datas: { inicio: '2026-12-20', fim: '2026-12-27' }, passageiros: [{ nome: 'Ana', email: 'ana@exemplo.com' }], roteiro: [{ dia: 1, descricao: 'Chegada' }] });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const vId = r.j.id;
  const codigo = new URL(base + r.j.link).searchParams.get('v');

  r = await api({ acao: 'viagem-editar', token, id: vId, nome: 'Família Silva (editada)', destino: 'Gramado', datas: { inicio: '2026-12-20', fim: '2026-12-28' } });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await api({ acao: 'viagem-listar', token });
  assert.equal(r.j.viagens.length, 1);
  assert.equal(r.j.viagens[0].nome, 'Família Silva (editada)');

  // App do passageiro (link secreto) + chat nos dois sentidos
  r = await api({ acao: 'app-viagem', codigo });
  assert.equal(r.status, 200);
  assert.equal(r.j.viagem.destino, 'Gramado');
  r = await api({ acao: 'app-chat-enviar', codigo, texto: 'Olá agência!' });
  assert.equal(r.status, 200);
  r = await api({ acao: 'chat-enviar', token, v: vId, texto: 'Olá Ana!' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await api({ acao: 'chat-listar', token, v: vId });
  assert.equal(r.j.mensagens.length, 2);
  r = await api({ acao: 'chat-conversas', token });
  assert.equal(r.status, 200);
  r = await api({ acao: 'app-chat-listar', codigo });
  assert.equal(r.j.mensagens.length, 2);

  // Foto: envia e baixa como imagem
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  r = await api({ acao: 'foto-enviar', token, dados: png, tipo: 'image/png' });
  assert.equal(r.status, 200);
  const img = await fetch(base + r.j.url);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await img.arrayBuffer()).subarray(1, 4).toString(), 'PNG');

  // Site (CMS): salvar e ler público
  r = await api({ acao: 'site-salvar', token, conteudo: { hero: { titulo: 'Viaje com a gente' } } });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await api(null, { method: 'GET', qs: '?site=viajantepro' });
  assert.equal(r.j.conteudo.hero.titulo, 'Viaje com a gente');

  r = await api({ acao: 'viagem-excluir', token, id: vId });
  assert.equal(r.status, 200);
  assert.equal((await api({ acao: 'viagem-listar', token })).j.viagens.length, 0);
  assert.equal((await api({ acao: 'cotacao-listar', token: 'falso' })).status, 401);
});

test('área do passageiro: código por e-mail e entrada', async () => {
  const antes = emails.length;
  let r = await api({ acao: 'pax-codigo', email: 'joao@exemplo.com' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(emails.length, antes + 1, 'código deve sair por e-mail');
  const codigo = /(\d{6})/.exec(emails[emails.length - 1].html)[1];
  r = await api({ acao: 'pax-entrar', email: 'joao@exemplo.com', codigo, senha_nova: 'minhasenha1' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const paxToken = r.j.token;
  assert.ok(paxToken);
  r = await api({ acao: 'pax-perfil-salvar', token: paxToken, nome: 'João' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await api({ acao: 'pax-solicitar', token: paxToken, tipo: 'duvida', mensagem: 'Posso levar pet?' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await api({ acao: 'pax-minhas', token: paxToken });
  assert.equal(r.status, 200, JSON.stringify(r.j));
});

test('formulário antigo (/api/leads) e páginas antigas (/api/vp-docs)', async () => {
  let r = await fetch(base + '/api/leads', { method: 'POST', body: JSON.stringify({ nome: 'Lead', email: 'lead@exemplo.com', consentimento: true }) });
  assert.equal(r.status, 201);
  r = await fetch(base + '/api/vp-docs', { method: 'POST', body: JSON.stringify({ op: 'add', path: 'tenants/viajante-pro/alerts', data: { tipo: 'sos', t: { __fv: 'ts' } } }) });
  assert.equal(r.status, 200);
  const alerts = await db.collection('tenants').doc('viajante-pro').collection('alerts').get();
  assert.equal(alerts.size, 1);
  assert.match(alerts.docs[0].data().t, /^\d{4}-\d{2}-\d{2}T/);
  r = await fetch(base + '/api/vp-docs', { method: 'POST', body: JSON.stringify({ op: 'set', path: 'viajante_contas/viajantepro', data: { senha_hash: 'x' } }) });
  assert.equal(r.status, 403, 'não pode mexer na conta do painel pelas páginas');
  r = await fetch(base + '/api/vp-docs', { method: 'POST', body: JSON.stringify({ op: 'list', path: 'tenants/viajante-pro/passenger_docs' }) });
  assert.deepEqual(await r.json(), { docs: [] }, 'leitura pública não expõe documentos');
});

test('saúde', async () => {
  const r = await fetch(base + '/saude');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).banco, 'ok');
});

module.exports = { _driver: driver, _caminho: path.resolve(__dirname) };
