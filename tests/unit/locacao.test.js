'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, montarConfig, hashSenha, agoraBr, COLLECTION } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

// 2026-10-12 (segunda) 09:00 em Brasília = 12:00 UTC.
const SEG_9H = Date.parse('2026-10-12T12:00:00Z');
const SALT_TESTE = '1234567890abcdef1234567890abcdef';

async function getCadastroTeste() {
  const hash = await hashSenha('CODIGO123', SALT_TESTE);
  return {
    nome: 'Splash Eventos Teste',
    versao: 1,
    codigo_salt: SALT_TESTE,
    codigo_hash: hash,
    config: LOCACOES.splash.config,
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

  return { db, h, post, get, setAgora: t => { agora = t; }, cadastro };
}

async function logar(a, ip) {
  const r = await a.post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' }, ip ? { ip } : {});
  assert.equal(r.statusCode, 200, r.body);
  return r.json.token;
}

const pedidoPadrao = {
  acao: 'pedir',
  unidade: 'santa-adelia',
  data: '2026-10-15',
  nome: 'Maria Silva',
  whatsapp: '11999998888',
  email: 'maria@exemplo.com',
  tipo_evento: 'Aniversário',
  convidados: 50,
  obs: 'Mesa para bolo',
  consentimento: true,
};

test('LOC1. público: consulta config geral e mapa mensal por unidade', async () => {
  const a = await montar();
  const pub = await a.get({});
  assert.equal(pub.statusCode, 200);
  assert.equal(pub.json.nome, 'Splash Piscina e Lazer');
  assert.equal(pub.json.unidades.length, 2);
  assert.equal(pub.json.unidades[0].id, 'santa-adelia');
  assert.equal(pub.json.unidades[1].id, 'santa-barbara');

  const mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.statusCode, 200);
  assert.equal(mapa.json.unidade, 'santa-adelia');
  assert.equal(mapa.json.mes, '2026-10');
  assert.equal(mapa.json.dias['2026-10-15'], 'livre');
});

test('LOC2. público: pedido ok gera protocolo, prazo e grava trava no Firestore', async () => {
  const a = await montar();
  const res = await a.post(pedidoPadrao);
  assert.equal(res.statusCode, 201, res.body);
  assert.equal(res.json.ok, true);
  assert.match(res.json.protocolo, /^SPL-[A-F0-9]{6}$/);
  assert.ok(res.json.prazo_ate);

  const lockDoc = a.db.docs.get(`${COLLECTION}/splash/dias/santa-adelia_2026-10-15`);
  assert.ok(lockDoc, 'trava do dia deve existir');

  const mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.json.dias['2026-10-15'], 'ocupado');
});

test('LOC3. conflito de datas: dia ocupado = 409 e corrida entre pedidos simultâneos', async () => {
  const a = await montar();
  const ok1 = await a.post(pedidoPadrao);
  assert.equal(ok1.statusCode, 201);

  const dup = await a.post({ ...pedidoPadrao, nome: 'João Souza' });
  assert.equal(dup.statusCode, 409);
  assert.match(dup.json.error, /já está reservado/);

  // Simulação de corrida simultânea
  const aCorrida = await montar();
  const p1 = aCorrida.post(pedidoPadrao, { ip: '1.1.1.1' });
  const p2 = aCorrida.post({ ...pedidoPadrao, nome: 'Carlos' }, { ip: '2.2.2.2' });
  const [r1, r2] = await Promise.all([p1, p2]);

  const statusCodes = [r1.statusCode, r2.statusCode].sort();
  assert.deepEqual(statusCodes, [201, 409], 'apenas um pedido simultâneo deve vencer');
});

test('LOC4. unidades independentes: mesmo dia em unidades diferentes é permitido', async () => {
  const a = await montar();
  const r1 = await a.post({ ...pedidoPadrao, unidade: 'santa-adelia' });
  assert.equal(r1.statusCode, 201);

  const r2 = await a.post({ ...pedidoPadrao, unidade: 'santa-barbara', nome: 'Bia Santos' });
  assert.equal(r2.statusCode, 201, 'unidades diferentes na mesma data devem ser permitidas');

  const mapa1 = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  const mapa2 = await a.get({ unidade: 'santa-barbara', mes: '2026-10' });

  assert.equal(mapa1.json.dias['2026-10-15'], 'ocupado');
  assert.equal(mapa2.json.dias['2026-10-15'], 'ocupado');
});

test('LOC5. prazo expirado: reserva em pedido libera o dia após prazo_ate vencer', async () => {
  const a = await montar();
  const r = await a.post(pedidoPadrao);
  assert.equal(r.statusCode, 201);

  // Avança tempo em 49 horas (prazo padrão é 48 h)
  a.setAgora(SEG_9H + 49 * 3600000);

  const mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.json.dias['2026-10-15'], 'livre', 'dia deve estar livre após prazo expirar');

  const novoPedido = await a.post({ ...pedidoPadrao, nome: 'Novo Cliente' });
  assert.equal(novoPedido.statusCode, 201, 'deve permitir novo pedido no dia expirado');
});

test('LOC6. painel: recusar/cancelar libera dia; confirmar mantém e impede expiração', async () => {
  const a = await montar();
  const token = await logar(a);

  // Pedido 1 -> recusar
  const p1 = await a.post(pedidoPadrao);
  const id1 = [...a.db.docs.entries()].find(([k]) => k.includes('/reservas/'))[1].id;

  const rec = await a.post({ acao: 'status', token, id: id1, status: 'recusado' });
  assert.equal(rec.statusCode, 200);

  let mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.json.dias['2026-10-15'], 'livre', 'recusar libera o dia');

  // Pedido 2 -> confirmar
  const p2 = await a.post({ ...pedidoPadrao, nome: 'Maria Silva 2' });
  const id2 = [...a.db.docs.entries()].find(([k, v]) => k.includes('/reservas/') && v.nome === 'Maria Silva 2')[1].id;

  const conf = await a.post({ acao: 'status', token, id: id2, status: 'confirmado' });
  assert.equal(conf.statusCode, 200);

  // Avança 100 horas: confirmado não expira
  a.setAgora(SEG_9H + 100 * 3600000);
  mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.json.dias['2026-10-15'], 'ocupado', 'reserva confirmada não expira');
});

test('LOC7. bloqueio: dona bloqueia dia ou período, impedindo pedidos', async () => {
  const a = await montar();
  const token = await logar(a);

  const blk = await a.post({ acao: 'bloquear', token, unidade: 'santa-adelia', de: '2026-10-20', ate: '2026-10-22', motivo: 'Reforma' });
  assert.equal(blk.statusCode, 201);
  assert.equal(blk.json.bloqueios, 3);

  const tent = await a.post({ ...pedidoPadrao, data: '2026-10-21' });
  assert.equal(tent.statusCode, 409);
  assert.match(tent.json.error, /reservado/);
});

test('LOC8. segurança e privacidade: sem token nega painel; mapa público não vaza dados', async () => {
  const a = await montar();
  await a.post(pedidoPadrao);

  const unauth = await a.post({ acao: 'listar' });
  assert.equal(unauth.statusCode, 401);

  const pubMap = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(pubMap.json.dias['2026-10-15'], 'ocupado');
  assert.equal(pubMap.json.nome, undefined, 'mapa público não deve vazar nomes');
  assert.equal(pubMap.json.whatsapp, undefined, 'mapa público não deve vazar WhatsApp');
  assert.equal(pubMap.json.email, undefined);
});

test('LOC9. regras de negócio: antecedência mínima e limite de dias futuros', async () => {
  const a = await montar();
  const token = await logar(a);

  // Ajusta antecedência para 3 dias e limite para 30 dias
  await a.post({ acao: 'config', token, config: { antecedencia_dias: 3, dias_a_frente: 30 } });

  // 2026-10-12 + 2 dias = 2026-10-14 (rejeita, exige 3 dias)
  const antec = await a.post({ ...pedidoPadrao, data: '2026-10-14' });
  assert.equal(antec.statusCode, 400);
  assert.match(antec.json.error, /antecedência/);

  // 2026-10-12 + 40 dias = 2026-11-21 (rejeita, excede limite de 30 dias)
  const limite = await a.post({ ...pedidoPadrao, data: '2026-11-21' });
  assert.equal(limite.statusCode, 400);
  assert.match(limite.json.error, /limite/);
});

test('LOC10. honeypot anti-robô e limite por IP', async () => {
  const a = await montar();

  const robo = await a.post({ ...pedidoPadrao, campo_extra: 'spam' });
  assert.equal(robo.statusCode, 200);
  assert.equal(a.db.docs.size, 0, 'robô não deve gravar nada no banco');

  const codes = [];
  for (let i = 0; i < 8; i++) {
    const r = await a.post({ ...pedidoPadrao, data: `2026-10-${16 + i}` }, { ip: '8.8.8.8' });
    codes.push(r.statusCode);
  }
  assert.deepEqual(codes.slice(6), [429, 429]);
});

test('LOC11. primeiro acesso e troca de senha', async () => {
  const a = await montar();

  // Conta sem ativacao
  const semAtiv = await montar({ cadastro: { nome: 'Inativa', versao: 1, config: LOCACOES.splash.config } });
  const semAtivRes = await semAtiv.post({ acao: 'entrar', senha: '123' });
  assert.equal(semAtivRes.statusCode, 400);
  assert.equal(semAtivRes.json.sem_ativacao, true);

  // Primeiro acesso normal com código
  const token = await logar(a);
  assert.match(token, /^[a-f0-9]{64}$/);

  // Troca de senha
  const tr = await a.post({ acao: 'trocar-senha', token, senha_atual: 'senhaValida123', senha_nova: 'novaSenha456' });
  assert.equal(tr.statusCode, 200);

  const loginNovo = await a.post({ acao: 'entrar', senha: 'novaSenha456' });
  assert.equal(loginNovo.statusCode, 200);
});

test('LOC12. suporte NEXIA master: lista contas de locação e abre sessão de suporte de 8 h', async () => {
  const master = await montar({ role: 'master' });
  const auth = { headers: { authorization: 'Bearer tokenMaster' } };

  const lista = await master.get({ suporte: 'lista' }, auth);
  assert.equal(lista.statusCode, 200);
  assert.equal(lista.json.locacoes[0].site, 'splash');

  const suporte = await master.post({ acao: 'suporte', site: 'splash' }, auth);
  assert.equal(suporte.statusCode, 200, suporte.body);
  assert.match(suporte.json.token, /^[a-f0-9]{64}$/);
  assert.equal(suporte.json.horas, 8);
});

test('LOC13. o código do primeiro acesso NÃO vale depois que a dona criou a senha (sem sequestro de conta)', async () => {
  const a = await montar();
  await logar(a); // cria a senha 'senhaValida123'
  const r = await a.post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'outraSenha456' });
  assert.equal(r.statusCode, 400);
  assert.ok(/já tem senha/.test(r.json.error));
  const entrar = await a.post({ acao: 'entrar', senha: 'senhaValida123' });
  assert.equal(entrar.statusCode, 200, 'a senha original continua valendo');
  const trocada = await a.post({ acao: 'entrar', senha: 'outraSenha456' });
  assert.equal(trocada.statusCode, 401);
});

test('LOC14. só valem as mudanças de situação previstas (finais não voltam)', async () => {
  const a = await montar();
  const token = await logar(a);
  await a.post(pedidoPadrao, { ip: '32.0.0.1' });
  const id = [...a.db.docs.entries()].find(([k]) => k.includes('/reservas/'))[1].id;
  const st = s => a.post({ acao: 'status', token, id, status: s });
  assert.equal((await st('concluido')).statusCode, 400, 'pedido não vira concluído direto');
  assert.equal((await st('aguardando_sinal')).statusCode, 200);
  assert.equal((await st('pedido')).statusCode, 400, 'não volta para pedido');
  assert.equal((await st('confirmado')).statusCode, 200);
  assert.equal((await st('recusado')).statusCode, 400, 'confirmado não vira recusado');
  assert.equal((await st('concluido')).statusCode, 200);
  assert.equal((await st('confirmado')).statusCode, 400, 'concluído é final');
});

test('LOC15. a rota pública só mostra a chave Pix se a dona deixar e o sinal não vem com valor inventado', async () => {
  const a = await montar();
  const tok = await logar(a);
  await a.post({ acao: 'config', token: tok, config: { pix: { chave: '123.456.789-00', titular: 'Amanda' } } });
  const pub = await a.get({});
  assert.equal(pub.statusCode, 200);
  assert.equal(pub.json.pix.chave, '123.456.789-00', 'a dona deixou "mostrar" ligado: o Pix aparece para o cliente');
  await a.post({ acao: 'config', token: tok, config: { pix: { chave: '123.456.789-00', titular: 'Amanda', mostrar: false } } });
  const oculto = await a.get({});
  assert.ok(!JSON.stringify(oculto.json).includes('123.456.789'), 'com "mostrar" desligado o Pix não sai no público');
  assert.equal(oculto.json.pix, null);
  const limpa = montarConfig({}, {});
  assert.equal(limpa.sinal.valor, 0);
  const painel = await a.post({ acao: 'listar', token: tok });
  assert.equal(painel.json.config.pix.chave, '123.456.789-00', 'no painel a dona vê o Pix');
});

test('LOC16. calendário e listagem por unidade funcionam sem índice composto do Firestore', async () => {
  const a = await montar();
  const tok = await logar(a, '33.0.0.1');
  await a.post(pedidoPadrao, { ip: '31.0.0.1' });
  await a.post({ ...pedidoPadrao, unidade: 'santa-barbara', data: '2026-10-20', nome: 'Outra Pessoa' }, { ip: '31.0.0.2' });
  const mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.statusCode, 200);
  assert.equal(mapa.json.dias['2026-10-15'], 'ocupado');
  assert.equal(mapa.json.dias['2026-10-20'], 'livre', 'o dia ocupado na outra unidade continua livre aqui');
  const lista = await a.post({ acao: 'listar', token: tok, de: '2026-10-01', ate: '2026-10-31', unidade: 'santa-barbara' }, { ip: '33.0.0.1' });
  assert.equal(lista.statusCode, 200);
  assert.deepEqual(lista.json.itens.map(i => i.nome), ['Outra Pessoa']);
});

test('LOC17. painel: só dá para apagar reserva recusada/cancelada; ativa é protegida', async () => {
  const a = await montar();
  const token = await logar(a, '33.0.0.2');
  await a.post(pedidoPadrao);
  const id = [...a.db.docs.entries()].find(([k]) => k.includes('/reservas/'))[1].id;
  const nega = await a.post({ acao: 'excluir', token, id });
  assert.equal(nega.statusCode, 400, 'pedido ativo não pode ser apagado');
  await a.post({ acao: 'status', token, id, status: 'recusado' });
  const ok = await a.post({ acao: 'excluir', token, id });
  assert.equal(ok.statusCode, 200);
  assert.ok(![...a.db.docs.keys()].some(k => k.includes('/reservas/' + id)), 'reserva sumiu');
  const mapa = await a.get({ unidade: 'santa-adelia', mes: '2026-10' });
  assert.equal(mapa.json.dias['2026-10-15'], 'livre');
  const sem = await a.post({ acao: 'excluir', id });
  assert.equal(sem.statusCode, 401, 'sem login não apaga');
});

test('LOC18. avaliações de clientes: ficam esperando, só a dona aprova e aí aparecem na rota pública', async () => {
  const a = await montar();
  const token = await logar(a, '33.0.0.3');
  const env = await a.post({ acao: 'avaliar', nome: 'Cliente Feliz', estrelas: 5, texto: 'Festa maravilhosa, adoramos!' }, { ip: '44.0.0.1' });
  assert.equal(env.statusCode, 201);
  let pub = await a.get({});
  assert.equal((pub.json.avaliacoes || []).length, 0, 'não aparece antes de aprovar');
  const lista = await a.post({ acao: 'avaliacoes-clientes', token });
  assert.equal(lista.json.itens.length, 1);
  const bot = await a.post({ acao: 'avaliar', nome: 'Robo', texto: 'spam spam spam', empresa: 'x' }, { ip: '44.0.0.2' });
  assert.equal(bot.json.ok, true);
  assert.equal((await a.post({ acao: 'avaliacoes-clientes', token })).json.itens.length, 1, 'robô não grava');
  await a.post({ acao: 'avaliacao-moderar', token, id: lista.json.itens[0].id, aprovar: true });
  pub = await a.get({});
  assert.equal(pub.json.avaliacoes.length, 1);
  assert.equal(pub.json.avaliacoes[0].nome, 'Cliente Feliz');
  assert.equal((await a.post({ acao: 'avaliacao-moderar', id: 'x' })).statusCode, 401);
});

test('LOC19. extras e promoções guardam a unidade; foto oculta some da lista pública', async () => {
  const a = await montar();
  const token = await logar(a, '33.0.0.4');
  const c = await a.post({ acao: 'config', token, config: { extras: [{ nome: 'Decoração Adélia', valor: 100, unidade: 'santa-adelia' }, { nome: 'Bolo', valor: 50 }] } });
  assert.equal(c.statusCode, 200);
  const pub = await a.get({});
  assert.equal(pub.json.extras.find(e => e.nome === 'Decoração Adélia').unidade, 'santa-adelia');
  assert.equal(pub.json.extras.find(e => e.nome === 'Bolo').unidade, 'todas');
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const f = await a.post({ acao: 'foto-enviar', token, unidade: 'santa-adelia', dados: png, tipo: 'image/png' });
  assert.equal(f.statusCode, 201);
  assert.equal((await a.get({ foto_listar: '1', unidade: 'santa-adelia' })).json.fotos.length, 1);
  await a.post({ acao: 'foto-editar', token, id: f.json.id, oculta: true });
  assert.equal((await a.get({ foto_listar: '1', unidade: 'santa-adelia' })).json.fotos.length, 0, 'oculta some do site');
  assert.equal((await a.post({ acao: 'foto-listar', token, unidade: 'santa-adelia' })).json.fotos.length, 1, 'painel ainda vê');
  await a.post({ acao: 'foto-remover', token, id: f.json.id });
  assert.equal((await a.post({ acao: 'foto-listar', token, unidade: 'santa-adelia' })).json.fotos.length, 0);
});

test('LOC20. patrocinadores: só os ativos e dentro do período saem no site; valor combinado fica só no painel', async () => {
  const a = await montar();
  const token = await logar(a, '33.0.0.5');
  const c = await a.post({ acao: 'config', token, config: { patrocinadores: [
    { nome: 'Padaria Boa', link: 'https://exemplo.com', nivel: 'ouro', valor_acordado: 500, obs: 'pago em dinheiro' },
    { nome: 'Loja Off', ativo: false },
    { nome: 'Loja Vencida', ate: '2020-01-01' },
    { nome: 'Link ruim', link: 'javascript:alert(1)' },
  ] } });
  assert.equal(c.statusCode, 200);
  const pub = await a.get({});
  const nomes = pub.json.patrocinadores.map(p => p.nome);
  assert.deepEqual(nomes.sort(), ['Link ruim', 'Padaria Boa']);
  const boa = pub.json.patrocinadores.find(p => p.nome === 'Padaria Boa');
  assert.equal(boa.valor_acordado, undefined);
  assert.equal(pub.json.patrocinadores.find(p => p.nome === 'Link ruim').link, '', 'link inseguro é descartado');
});

test('LOC21. lembretes: só aparecem ligados, só de reserva confirmada, e some depois de marcar como enviado', async () => {
  const a = await montar();
  const token = await logar(a, '33.0.0.6');
  await a.post(pedidoPadrao, { ip: '44.0.0.9' });
  const id = [...a.db.docs.entries()].find(([k]) => k.includes('/reservas/'))[1].id;
  await a.post({ acao: 'status', token, id, status: 'confirmado' });
  let l = await a.post({ acao: 'lembretes', token });
  assert.equal(l.json.ativo, false);
  assert.equal(l.json.itens.length, 0, 'desligado não lista nada');
  await a.post({ acao: 'config', token, config: { lembretes: { ativo: true, saldo: { ativo: true, dias: 30 }, antes: { ativo: true, dias: 2 } } } });
  await a.post({ acao: 'editar', token, id, campos: { valor_total: 1000 } });
  l = await a.post({ acao: 'lembretes', token });
  assert.ok(l.json.itens.length >= 1, 'há lembrete para enviar');
  const it = l.json.itens[0];
  assert.ok(it.mensagem.length > 10 && it.whatsapp);
  await a.post({ acao: 'lembrete-marcar', token, id, chave: it.chave });
  const l2 = await a.post({ acao: 'lembretes', token });
  assert.ok(!l2.json.itens.some(x => x.chave === it.chave), 'marcado como enviado some da lista');
});

test('LOC22. lembrete de avaliação: só depois da festa, uma vez, e só se ligado', () => {
  const lib = require('../../netlify/functions/locacao-lib/lembretes');
  const r = { id: 'a', status: 'concluido', data: '2026-10-10', nome: 'Ana Souza', whatsapp: '11999999999', unidade_nome: 'Splash', valor_total: 0 };
  const off = { lembretes: lib.limparLembretes({ ativo: true }) };
  assert.equal(lib.devidos([r], off, '2026-10-11').length, 0, 'desligado não pede');
  const on = { lembretes: lib.limparLembretes({ ativo: true, avaliacao: { ativo: true, dias: 1 } }) };
  const l = lib.devidos([r], on, '2026-10-11');
  assert.equal(l.length, 1);
  assert.equal(l[0].tipo, 'avaliacao');
  assert.ok(l[0].mensagem.includes('{link}'), 'o link entra no painel');
  assert.equal(lib.devidos([r], on, '2026-10-10').length, 0, 'no dia da festa ainda não');
  assert.equal(lib.devidos([r], on, '2026-10-30').length, 0, 'depois de 7 dias não insiste');
  assert.equal(lib.devidos([{ ...r, lembretes_enviados: { avaliacao: 'x' } }], on, '2026-10-11').length, 0, 'já enviado');
});

test('LOC23. campanhas: salvarCampanha e listarCampanhas persistem e retornam últimas 30', async () => {
  const a = await montar();
  const token = await logar(a, '55.0.0.1');

  // Sem título -> 400
  const semTitulo = await a.post({ action: 'salvarCampanha', token, texto: 'Sem titulo' }, { ip: '55.0.0.2' });
  assert.equal(semTitulo.statusCode, 400);

  // Criar campanha válida via action
  const c1 = await a.post({
    action: 'salvarCampanha',
    token,
    titulo: 'Promoção Verão',
    texto: 'Super desconto de verão',
    foto: 'https://exemplo.com/foto.jpg',
    link: 'https://exemplo.com',
    tipo: 'promo',
  }, { ip: '55.0.0.3' });
  assert.equal(c1.statusCode, 201);
  assert.equal(c1.json.ok, true);
  assert.ok(c1.json.id);

  // Listar campanhas
  const lista = await a.post({ action: 'listarCampanhas' }, { ip: '55.0.0.4' });
  assert.equal(lista.statusCode, 200);
  assert.equal(lista.json.ok, true);
  assert.equal(lista.json.campanhas.length, 1);
  assert.equal(lista.json.campanhas[0].titulo, 'Promoção Verão');
});

test('LOC24. instagram handle: salvarHandleInstagram valida regex e obterHandleInstagram recupera', async () => {
  const a = await montar();
  const token = await logar(a, '56.0.0.1');

  // Handle inválido com caracteres proibidos
  const inv = await a.post({ action: 'salvarHandleInstagram', token, handle: '@splash!!' }, { ip: '56.0.0.2' });
  assert.equal(inv.statusCode, 400);

  // Handle válido (com @ inicial para ser removido automaticamente)
  const val = await a.post({ action: 'salvarHandleInstagram', token, handle: '@splash_oficial.1' }, { ip: '56.0.0.3' });
  assert.equal(val.statusCode, 200);
  assert.equal(val.json.ok, true);
  assert.equal(val.json.handle, 'splash_oficial.1');

  // Obter handle
  const obt = await a.post({ action: 'obterHandleInstagram' }, { ip: '56.0.0.4' });
  assert.equal(obt.statusCode, 200);
  assert.equal(obt.json.ok, true);
  assert.equal(obt.json.handle, 'splash_oficial.1');
});

test('LOC25. contatos: obterContatosComConsentimento, marcarEnviado e removerContato', async () => {
  const a = await montar();
  const token = await logar(a, '57.0.0.1');

  // Faz um pedido com consentimento = true
  const ped = await a.post({ ...pedidoPadrao, consentimento: true }, { ip: '99.0.0.1' });
  assert.equal(ped.statusCode, 201);

  // Obter contatos com consentimento
  const contatos1 = await a.post({ action: 'obterContatosComConsentimento', token }, { ip: '57.0.0.2' });
  assert.equal(contatos1.statusCode, 200);
  assert.equal(contatos1.json.ok, true);
  assert.equal(contatos1.json.contatos.length, 1);
  const idContato = contatos1.json.contatos[0].id;
  assert.equal(contatos1.json.contatos[0].enviado, false);

  // Marcar como enviado
  const env = await a.post({ action: 'marcarEnviado', token, id: idContato }, { ip: '57.0.0.3' });
  assert.equal(env.statusCode, 200);

  const contatos2 = await a.post({ action: 'obterContatosComConsentimento', token }, { ip: '57.0.0.4' });
  assert.equal(contatos2.json.contatos[0].enviado, true);

  // Remover contato
  const rem = await a.post({ action: 'removerContato', token, id: idContato }, { ip: '57.0.0.5' });
  assert.equal(rem.statusCode, 200);

  const contatos3 = await a.post({ action: 'obterContatosComConsentimento', token }, { ip: '57.0.0.6' });
  assert.equal(contatos3.json.contatos.length, 0, 'contato removido não deve mais aparecer na lista');
});
