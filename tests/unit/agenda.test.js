'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createHandler, horariosLivres, montarConfig, hashSenha, fatias, agoraBr, COLLECTION } = require('../../netlify/functions/agenda.js');
const { AGENDAS } = require('../../clientes/agendas.js');

const { fakeDb } = require('../helpers/agenda-fake-db.js');

// 2026-10-12 (segunda) 09:00 em Brasília = 12:00 UTC.
const SEG_9H = Date.parse('2026-10-12T12:00:00Z');
const { codigo_sempre: _sempre, ...CADASTRO } = AGENDAS['agenda-teste'];
const mw = role => ({ verifyBearerToken: async (e) => (e.headers.authorization ? { ok: true, uid: 'm', role } : { ok: false }) });
function montar(opts = {}) {
  const db = opts.db || fakeDb();
  let agora = opts.agora || SEG_9H;
  const h = createHandler({ getDb: () => db, getMw: () => mw(opts.role || 'user'), getCadastro: s => (s === 'agenda-teste' ? CADASTRO : undefined), now: () => agora });
  let ip = 0;
  const post = (body, extra = {}) => h({ httpMethod: 'POST', headers: { 'cf-connecting-ip': extra.ip || '10.0.0.' + (++ip), ...(extra.headers || {}) }, body: JSON.stringify({ site: 'agenda-teste', ...body }) }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));
  const get = (q) => h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'agenda-teste', ...q } }).then(r => ({ ...r, json: JSON.parse(r.body) }));
  return { db, h, post, get, setAgora: t => { agora = t; } };
}
async function logar(a) {
  const r = await a.post({ acao: 'primeiro-acesso', codigo: 'teste-agenda', senha_nova: 'flor2026' });
  assert.equal(r.statusCode, 200, r.body);
  return r.json.token;
}
const pedido = { acao: 'agendar', servico: 'corte', data: '2026-10-13', inicio: '10:00', nome: 'Ana Souza', whatsapp: '(11) 98888-7777', consentimento: true };

test('AG1. horários livres: respeita expediente, duração, ocupados, bloqueios e antecedência', () => {
  const cfg = montarConfig(CADASTRO);
  const livres = horariosLivres(cfg, '2026-10-13', 30, [], SEG_9H);
  assert.equal(livres[0], '09:00');
  assert.equal(livres[livres.length - 1], '17:30');
  assert.equal(livres.length, 18);
  // 90 min não cabe depois das 16:30
  assert.equal(horariosLivres(cfg, '2026-10-13', 90, [], SEG_9H).pop(), '16:30');
  // ocupado 10:00-11:30 tira 10:00, 10:30, 11:00 e também 09:30 para serviço de 60 min
  const ocup = [{ tipo: 'agendamento', status: 'confirmado', inicio: '10:00', fim: '11:30' }];
  const l60 = horariosLivres(cfg, '2026-10-13', 60, ocup, SEG_9H);
  assert.ok(!l60.includes('09:30') && !l60.includes('10:00') && !l60.includes('11:00'));
  assert.ok(l60.includes('09:00') && l60.includes('11:30'));
  // cancelado não ocupa; bloqueio ocupa
  assert.ok(horariosLivres(cfg, '2026-10-13', 30, [{ ...ocup[0], status: 'cancelado' }], SEG_9H).includes('10:00'));
  assert.deepEqual(horariosLivres(cfg, '2026-10-13', 30, [{ tipo: 'bloqueio', inicio: '00:00', fim: '23:59' }], SEG_9H), []);
  // hoje às 09:00 com 2 h de antecedência: primeiro horário 11:00; domingo fechado; passado vazio
  assert.equal(horariosLivres(cfg, '2026-10-12', 30, [], SEG_9H)[0], '11:00');
  assert.deepEqual(horariosLivres(cfg, '2026-10-18', 30, [], SEG_9H), []);
  assert.deepEqual(horariosLivres(cfg, '2026-10-11', 30, [], SEG_9H), []);
  assert.deepEqual(fatias('10:00', '11:30', 30), ['1000', '1030', '1100']);
  assert.deepEqual(agoraBr(SEG_9H), { data: '2026-10-12', minuto: 540 });
});

test('AG2. público: vê serviços e dias, pede horário; o horário some para a próxima pessoa', async () => {
  const a = montar();
  const cfg = await a.get({});
  assert.equal(cfg.statusCode, 200);
  assert.equal(cfg.headers['Access-Control-Allow-Origin'], '*');
  assert.deepEqual(cfg.json.servicos.map(s => s.id), ['corte', 'coloracao']);
  assert.equal(cfg.json.dias[0], '2026-10-12');
  assert.ok(!cfg.json.dias.includes('2026-10-18'), 'domingo fechado não aparece');
  assert.equal(cfg.json.codigo_hash, undefined);
  const r = await a.post(pedido);
  assert.equal(r.statusCode, 201, r.body);
  const item = [...a.db.docs].find(([k]) => k.includes('/itens/'))[1];
  assert.equal(item.status, 'pendente');
  assert.equal(item.whatsapp, '11988887777');
  assert.equal(item.fim, '10:30');
  const h = await a.get({ data: '2026-10-13', servico: 'corte' });
  assert.ok(!h.json.horarios.includes('10:00'));
  const dup = await a.post({ ...pedido, nome: 'Bia Lima' });
  assert.equal(dup.statusCode, 409);
});

test('AG3. público: validações, LGPD, robô, limite por IP e agenda inexistente', async () => {
  const a = montar();
  assert.equal((await a.post({ ...pedido, consentimento: false })).statusCode, 400);
  assert.match((await a.post({ ...pedido, whatsapp: '' })).json.error, /WhatsApp/);
  assert.match((await a.post({ ...pedido, servico: 'x' })).json.error, /serviço/);
  assert.equal((await a.post({ ...pedido, inicio: '08:00' })).statusCode, 409, 'fora do expediente');
  assert.equal((await a.post({ ...pedido, data: '2026-02-30' })).statusCode, 400);
  const robo = await a.post({ ...pedido, site_url: 'http://spam' });
  assert.equal(robo.statusCode, 200);
  assert.equal([...a.db.docs.keys()].filter(k => k.includes('/itens/')).length, 0);
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await a.post({ ...pedido, inicio: `1${i}:00`.slice(0, 5) }, { ip: '9.9.9.9' })).statusCode);
  assert.deepEqual(codes.slice(6), [429, 429]);
  const outra = await a.h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'nao-existe' } });
  assert.equal(outra.statusCode, 404);
  assert.equal((await a.h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: '../x' } })).statusCode, 400);
});

test('AG4. primeiro acesso com código, entrar com senha, senha errada, código não serve de novo, sair', async () => {
  const a = montar();
  assert.equal((await a.post({ acao: 'listar' })).statusCode, 401);
  const semSenha = await a.post({ acao: 'entrar', senha: 'qualquer' });
  assert.equal(semSenha.json.primeiro_acesso, true);
  assert.equal((await a.post({ acao: 'primeiro-acesso', codigo: 'ERRADO123', senha_nova: 'flor2026' })).statusCode, 401);
  assert.match((await a.post({ acao: 'primeiro-acesso', codigo: 'TESTE-AGENDA', senha_nova: '123456' })).json.error, /fácil/);
  const token = await logar(a);
  assert.match(token, /^[a-f0-9]{64}$/);
  const conta = a.db.docs.get(`${COLLECTION}/agenda-teste`);
  assert.ok(conta.senha_hash && conta.senha_hash !== 'flor2026');
  assert.equal((await a.post({ acao: 'primeiro-acesso', codigo: 'TESTEAGENDA', senha_nova: 'outra2026' })).statusCode, 400);
  assert.equal((await a.post({ acao: 'entrar', senha: 'errada' })).statusCode, 401);
  const ent = await a.post({ acao: 'entrar', senha: 'flor2026' });
  assert.equal(ent.statusCode, 200);
  assert.equal((await a.post({ acao: 'listar', token: ent.json.token })).statusCode, 200);
  assert.equal((await a.post({ acao: 'sair', token: ent.json.token })).statusCode, 200);
  const depois = await a.post({ acao: 'listar', token: ent.json.token });
  assert.equal(depois.statusCode, 401);
  assert.equal(depois.json.sair, true);
  // sessão vencida
  a.setAgora(SEG_9H + 31 * 86400000);
  assert.equal((await a.post({ acao: 'listar', token })).statusCode, 401);
});

test('AG5. painel: lista, confirma, cancela (libera horário), reabre, marca atendido e falta', async () => {
  const a = montar();
  const token = await logar(a);
  await a.post(pedido);
  const l = await a.post({ acao: 'listar', token, de: '2026-10-12', ate: '2026-10-18' });
  assert.equal(l.json.itens.length, 1);
  assert.equal(l.json.pendentes.length, 1);
  assert.equal(l.json.config.nome, 'Agenda de Teste');
  const id = l.json.itens[0].id;
  assert.equal((await a.post({ acao: 'status', token, id, status: 'confirmado' })).statusCode, 200);
  assert.equal((await a.post({ acao: 'listar', token })).json.pendentes.length, 0);
  assert.equal((await a.post({ acao: 'status', token, id, status: 'cancelado' })).statusCode, 200);
  assert.ok((await a.get({ data: '2026-10-13', servico: 'corte' })).json.horarios.includes('10:00'), 'cancelado libera');
  assert.equal([...a.db.docs.keys()].filter(k => k.includes('/ocupado/')).length, 0);
  // outra pessoa pega o horário; reabrir o cancelado dá conflito
  assert.equal((await a.post({ ...pedido, nome: 'Bia Lima' })).statusCode, 201);
  assert.equal((await a.post({ acao: 'status', token, id, status: 'confirmado' })).statusCode, 409);
  assert.equal((await a.post({ acao: 'status', token, id, status: 'inventado' })).statusCode, 400);
  assert.equal((await a.post({ acao: 'status', token, id: 'nao-existe', status: 'concluido' })).statusCode, 404);
  const bia = (await a.post({ acao: 'listar', token })).json.pendentes[0].id;
  assert.equal((await a.post({ acao: 'status', token, id: bia, status: 'concluido' })).statusCode, 200);
  assert.equal((await a.post({ acao: 'status', token, id: bia, status: 'faltou' })).statusCode, 200);
});

test('AG6. painel: marca horário à mão, sem conflito; bloqueia dia e intervalo; desbloqueia', async () => {
  const a = montar();
  const token = await logar(a);
  const livresHoje = await a.post({ acao: 'horarios', token, data: '2026-10-12', servico: 'coloracao' });
  assert.equal(livresHoje.json.horarios[0], '09:00', 'a dona marca sem antecedência mínima');
  const c = await a.post({ acao: 'criar', token, nome: 'Carla', servico: 'coloracao', data: '2026-10-14', inicio: '14:00' });
  assert.equal(c.statusCode, 201, c.body);
  const conflito = await a.post({ acao: 'criar', token, nome: 'Dani', servico: 'corte', data: '2026-10-14', inicio: '15:00' });
  assert.equal(conflito.statusCode, 409);
  assert.match(conflito.json.error, /Carla/);
  const lista = (await a.post({ acao: 'listar', token, de: '2026-10-14', ate: '2026-10-14' })).json.itens;
  assert.equal(lista[0].status, 'confirmado');
  assert.equal(lista[0].fim, '15:30');
  // bloquear o dia inteiro: site não oferece nada; aviso sobre o que já estava marcado
  const b = await a.post({ acao: 'bloquear', token, data: '2026-10-14', motivo: 'Feriado' });
  assert.equal(b.statusCode, 201);
  assert.match(b.json.aviso, /1 agendamento/);
  assert.deepEqual((await a.get({ data: '2026-10-14' })).json.horarios, []);
  assert.equal((await a.post({ acao: 'criar', token, nome: 'Eva', servico: 'corte', data: '2026-10-14', inicio: '09:00' })).json.error, 'Esse horário está bloqueado.');
  assert.equal((await a.post({ acao: 'desbloquear', token, id: b.json.id })).statusCode, 200);
  assert.ok((await a.get({ data: '2026-10-14' })).json.horarios.includes('09:00'));
  // intervalo
  await a.post({ acao: 'bloquear', token, data: '2026-10-15', inicio: '12:00', fim: '13:00' });
  const h = (await a.get({ data: '2026-10-15', servico: 'corte' })).json.horarios;
  assert.ok(!h.includes('12:00') && !h.includes('12:30') && h.includes('13:00') && h.includes('11:30'));
  assert.equal((await a.post({ acao: 'bloquear', token, data: '2026-10-15', inicio: '13:00', fim: '12:00' })).statusCode, 400);
  assert.equal((await a.post({ acao: 'desbloquear', token, id: lista[0].id })).statusCode, 404, 'agendamento não é bloqueio');
});

test('AG7. painel: ajustes de horários e serviços valem no site; trocar senha; master entra para suporte', async () => {
  const a = montar();
  const token = await logar(a);
  const r = await a.post({ acao: 'config', token, config: { semana: { 0: [['10:00', '14:00']], 1: [] }, servicos: [{ nome: 'Escova', duracao: 45 }, { nome: '' }], intervalo: 15, aviso: 'Chegue 5 min antes', codigo_hash: 'x' } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.json.config.servicos, [{ id: 'escova', nome: 'Escova', duracao: 45, preco: '' }]);
  const pub = await a.get({});
  assert.equal(pub.json.aviso, 'Chegue 5 min antes');
  assert.ok(pub.json.dias.includes('2026-10-18'), 'domingo agora abre');
  assert.ok(!pub.json.dias.includes('2026-10-19'), 'segunda agora fecha');
  assert.deepEqual((await a.get({ data: '2026-10-18', servico: 'escova' })).json.horarios.slice(0, 3), ['10:00', '10:15', '10:30']);
  assert.equal(a.db.docs.get(`${COLLECTION}/agenda-teste`).codigo_hash, undefined, 'não grava campo estranho');
  assert.equal((await a.post({ acao: 'trocar-senha', token, senha_atual: 'errada', senha_nova: 'nova2026' })).statusCode, 401);
  assert.equal((await a.post({ acao: 'trocar-senha', token, senha_atual: 'flor2026', senha_nova: 'nova2026' })).statusCode, 200);
  assert.equal((await a.post({ acao: 'entrar', senha: 'nova2026' })).statusCode, 200);
  const master = montar({ db: a.db, role: 'master' });
  assert.equal((await master.post({ acao: 'listar' }, { headers: { authorization: 'Bearer x' } })).statusCode, 200);
  const comum = montar({ db: a.db, role: 'admin' });
  assert.equal((await comum.post({ acao: 'listar' }, { headers: { authorization: 'Bearer x' } })).statusCode, 401);
});

test('AG8. cadastro: hash do código bate, sem código em texto; painel e cópia do Studio Lima iguais', async () => {
  assert.equal(await hashSenha('TESTEAGENDA', CADASTRO.codigo_salt), CADASTRO.codigo_hash);
  for (const [slug, c] of Object.entries(AGENDAS)) {
    assert.match(slug, /^[a-z0-9-]{3,40}$/);
    assert.match(c.codigo_hash, /^[a-f0-9]{64}$/);
    assert.ok(montarConfig(c).servicos.length > 0);
  }
  assert.equal(montarConfig(AGENDAS.studiolima).semana[0][0][0], '06:00');
  for (const [slug, c] of Object.entries(AGENDAS)) if (slug !== 'agenda-teste') assert.equal(c.codigo_sempre, undefined, slug + ': código de cliente vale uma vez só');
  const raiz = path.join(__dirname, '../..');
  const base = fs.readFileSync(path.join(raiz, 'nexia-ai/site-kit/agenda/painel.html'), 'utf8');
  const copia = fs.readFileSync(path.join(raiz, 'sites/studiolima/agenda/index.html'), 'utf8');
  const normal = s => s.replace(/<meta name="agenda-site" content="[^"]*">/, '').replace(/<title>[^<]*<\/title>/, '');
  assert.equal(normal(copia), normal(base), 'a cópia do painel no site do Studio Lima saiu do modelo: copie de novo');
  assert.match(copia, /<meta name="agenda-site" content="studiolima">/);
  const landing = fs.readFileSync(path.join(raiz, 'sites/studiolima/index.html'), 'utf8');
  assert.match(landing, /const AG_SITE = 'studiolima'/);
  assert.ok(!/fetch\('\/api\/studiolima/.test(landing), 'nada aponta para a API antiga');
});

test('AG9. codigo_sempre (só a agenda de teste): o código refaz o primeiro acesso mesmo com senha criada', async () => {
  const db = fakeDb();
  const h = createHandler({ getDb: () => db, getMw: () => mw('user'), getCadastro: () => AGENDAS['agenda-teste'], now: () => SEG_9H });
  let ip = 0;
  const post = b => h({ httpMethod: 'POST', headers: { 'cf-connecting-ip': '10.9.0.' + (++ip) }, body: JSON.stringify({ site: 'agenda-teste', ...b }) }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));
  assert.equal((await post({ acao: 'primeiro-acesso', codigo: 'TESTEAGENDA', senha_nova: 'flor2026' })).statusCode, 200);
  assert.equal((await post({ acao: 'primeiro-acesso', codigo: 'TESTEAGENDA', senha_nova: 'lirio2026' })).statusCode, 200);
  assert.equal((await post({ acao: 'entrar', senha: 'lirio2026' })).statusCode, 200);
  assert.equal((await post({ acao: 'primeiro-acesso', codigo: 'ERRADO', senha_nova: 'rosa2026' })).statusCode, 401);
});
