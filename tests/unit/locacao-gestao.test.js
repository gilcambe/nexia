'use strict';
// Gestão da dona: pagamentos por reserva, despesas, resumo financeiro por unidade, clientes fiéis, promoções e avaliações.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, hashSenha, resumoFinanceiro, resumoClientes, montarConfig } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const SEG_9H = Date.parse('2026-10-12T12:00:00Z');
const SALT = '1234567890abcdef1234567890abcdef';
let ipN = 0;

async function montar() {
  const db = fakeDb();
  const cadastro = { nome: 'Splash Teste', versao: 1, codigo_salt: SALT, codigo_hash: await hashSenha('CODIGO123', SALT), config: LOCACOES.splash.config };
  const h = createHandler({
    getDb: () => db,
    getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }),
    getCadastro: s => (s === 'splash' ? cadastro : undefined),
    getLista: () => ({ splash: cadastro }),
    now: () => SEG_9H,
  });
  const post = body => h({ httpMethod: 'POST', headers: { 'cf-connecting-ip': '77.1.' + ((ipN >> 8) & 255) + '.' + (ipN++ & 255) }, body: JSON.stringify({ site: 'splash', ...body }) })
    .then(r => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') }));
  const t = (await post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' })).json.token;
  const api = (acao, extra = {}) => post({ acao, token: t, ...extra });
  const publico = () => h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'splash' } }).then(r => JSON.parse(r.body));
  return { api, post, publico };
}

const reserva = (a, extra) => a.api('criar', { unidade: 'santa-adelia', data: '2026-10-20', nome: 'Cliente A', whatsapp: '11988887777', tipo_evento: 'Aniversário', convidados: 20, status: 'confirmado', valor_total: 1000, valor_sinal: 300, ...extra });

test('GEST1. pagamentos: registra, soma em valor_pago, valida valor e remove', async () => {
  const a = await montar();
  const c = await reserva(a);
  assert.equal(c.status, 201, JSON.stringify(c.json));
  const id = c.json.id;
  const p1 = await a.api('pagamento-registrar', { id, valor: 300, forma: 'pix', data: '2026-10-12', obs: 'Sinal' });
  assert.equal(p1.status, 201);
  const p2 = await a.api('pagamento-registrar', { id, valor: 200.5, forma: 'dinheiro' });
  assert.equal(p2.json.valor_pago, 500.5);
  assert.equal(p2.json.pagamento.data, '2026-10-12', 'sem data informada, usa hoje (Brasília)');
  assert.equal((await a.api('pagamento-registrar', { id, valor: 0 })).status, 400);
  assert.equal((await a.api('pagamento-registrar', { id, valor: -5 })).status, 400);
  assert.equal((await a.api('pagamento-registrar', { id: 'naoexiste', valor: 10 })).status, 404);
  const rm = await a.api('pagamento-remover', { id, pagamento_id: p1.json.pagamento.id });
  assert.equal(rm.json.valor_pago, 200.5);
  assert.equal((await a.api('pagamento-remover', { id, pagamento_id: 'xxxx' })).status, 404);
});

test('GEST2. "Sinal pago" registra o sinal como pagamento recebido, sem duplicar', async () => {
  const a = await montar();
  const ped = await a.post({ acao: 'pedir', site: 'splash', unidade: 'santa-adelia', data: '2026-10-25', nome: 'Pedido X', whatsapp: '11977776666', tipo_evento: 'Aniversário', convidados: 10, consentimento: true });
  assert.equal(ped.status, 201, JSON.stringify(ped.json));
  const id = (await a.api('listar', { de: '2026-10-01', ate: '2026-10-31' })).json.pendentes.find(i => i.protocolo === ped.json.protocolo).id;
  assert.equal((await a.api('editar', { id, campos: { valor_total: 800, valor_sinal: 200 } })).status, 200);
  assert.equal((await a.api('status', { id, status: 'confirmado' })).status, 200);
  const l = (await a.api('listar', { de: '2026-10-01', ate: '2026-10-31' })).json.itens.find(i => i.id === id);
  assert.equal(l.valor_pago, 200);
  assert.equal(l.pagamentos.length, 1);
  assert.equal(l.pagamentos[0].obs, 'Sinal');
});

test('GEST3. despesas: salva, edita, lista por período/unidade e exclui; recusa dados inválidos', async () => {
  const a = await montar();
  const d1 = await a.api('despesa-salvar', { unidade: 'santa-adelia', data: '2026-10-05', categoria: 'Limpeza', descricao: 'Produtos da piscina', valor: 150 });
  assert.equal(d1.status, 200);
  await a.api('despesa-salvar', { unidade: 'geral', data: '2026-10-07', categoria: 'Internet', valor: 100 });
  await a.api('despesa-salvar', { unidade: 'santa-barbara', data: '2026-09-07', categoria: 'Água', valor: 80 });
  assert.equal((await a.api('despesa-salvar', { unidade: 'santa-adelia', data: '2026-10-05', valor: 0 })).status, 400);
  assert.equal((await a.api('despesa-salvar', { unidade: 'xx', data: '2026-10-05', valor: 5 })).status, 400);
  assert.equal((await a.api('despesa-salvar', { unidade: 'geral', data: '31/10', valor: 5 })).status, 400);
  const lista = await a.api('despesa-listar', { de: '2026-10-01', ate: '2026-10-31' });
  assert.equal(lista.json.despesas.length, 2);
  assert.equal(lista.json.total, 250);
  await a.api('despesa-salvar', { id: d1.json.id, unidade: 'santa-adelia', data: '2026-10-05', categoria: 'Limpeza', valor: 175 });
  assert.equal((await a.api('despesa-listar', { de: '2026-10-01', ate: '2026-10-31', unidade: 'santa-adelia' })).json.total, 175);
  assert.equal((await a.api('despesa-excluir', { id: d1.json.id })).status, 200);
  assert.equal((await a.api('despesa-excluir', { id: d1.json.id })).status, 404);
});

test('GEST4. financeiro: faturamento, recebido, a receber, despesas e lucro por unidade', async () => {
  const a = await montar();
  const r1 = await reserva(a, { data: '2026-10-20', valor_total: 1000 });
  const r2 = await reserva(a, { unidade: 'santa-barbara', data: '2026-10-21', nome: 'Cliente B', whatsapp: '11955554444', valor_total: 600 });
  await reserva(a, { data: '2026-10-22', nome: 'Sem valor', whatsapp: '11944443333', valor_total: 0 });
  await a.api('pagamento-registrar', { id: r1.json.id, valor: 400, data: '2026-10-10' });
  await a.api('pagamento-registrar', { id: r2.json.id, valor: 600, data: '2026-10-11' });
  await a.api('despesa-salvar', { unidade: 'santa-adelia', data: '2026-10-05', valor: 150 });
  await a.api('despesa-salvar', { unidade: 'geral', data: '2026-10-06', valor: 50 });
  const f = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31' })).json;
  const ade = f.por_unidade.find(u => u.id === 'santa-adelia');
  const bar = f.por_unidade.find(u => u.id === 'santa-barbara');
  assert.deepEqual([ade.reservas, ade.faturamento, ade.recebido, ade.a_receber, ade.despesas, ade.lucro_caixa], [2, 1000, 400, 600, 150, 250]);
  assert.deepEqual([bar.reservas, bar.faturamento, bar.recebido, bar.a_receber, bar.lucro_previsto], [1, 600, 600, 0, 600]);
  assert.equal(f.total.faturamento, 1600);
  assert.equal(f.total.recebido, 1000);
  assert.equal(f.total.despesas, 200);
  assert.equal(f.total.lucro_caixa, 800);
  assert.equal(f.total.lucro_previsto, 1400);
  assert.equal(f.reservas_sem_valor, 1);
  assert.equal(f.meses[0].mes, '2026-10');
  assert.ok(f.por_unidade.some(u => u.id === 'geral' && u.despesas === 50), 'despesa geral aparece em linha própria');
});

test('GEST5. financeiro ignora reservas não confirmadas, bloqueios e fora do período', () => {
  const unidades = [{ id: 'u1', nome: 'U1' }];
  const r = resumoFinanceiro([
    { unidade: 'u1', status: 'pedido', data: '2026-10-10', valor_total: 500 },
    { unidade: 'u1', status: 'bloqueado', data: '2026-10-11', valor_total: 500 },
    { unidade: 'u1', status: 'confirmado', data: '2026-11-01', valor_total: 500 },
    { unidade: 'u1', status: 'concluido', data: '2026-10-12', valor_total: 700, pagamentos: [{ valor: 700, data: '2026-10-12' }] },
  ], [], unidades, '2026-10-01', '2026-10-31');
  assert.equal(r.total.faturamento, 700);
  assert.equal(r.total.recebido, 700);
  assert.equal(r.total.a_receber, 0);
});

test('GEST6. clientes: agrupa pelo WhatsApp, conta só reservas fechadas, marca fiéis e sugere desconto', async () => {
  const cfg = montarConfig({ config: LOCACOES.splash.config }, { fidelidade: { minimo: 2, percentual: 8 } });
  assert.deepEqual(cfg.fidelidade, { minimo: 2, percentual: 8 });
  const lista = resumoClientes([
    { nome: 'Maria', whatsapp: '(11) 98888-7777', unidade: 'santa-adelia', status: 'confirmado', data: '2026-03-01', valor_total: 900, pagamentos: [{ valor: 900 }] },
    { nome: 'Maria Silva', whatsapp: '11988887777', unidade: 'santa-barbara', status: 'concluido', data: '2026-08-01', valor_total: 1100 },
    { nome: 'João', whatsapp: '11977776666', unidade: 'santa-adelia', status: 'confirmado', data: '2026-09-01', valor_total: 500 },
    { nome: 'João', whatsapp: '11977776666', unidade: 'santa-adelia', status: 'cancelado', data: '2026-09-09', valor_total: 500 },
    { nome: 'Dia bloqueado', whatsapp: '', unidade: 'santa-adelia', status: 'bloqueado', data: '2026-09-10' },
  ], cfg.fidelidade);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].nome, 'Maria Silva', 'usa o nome mais recente');
  assert.deepEqual([lista[0].reservas, lista[0].total, lista[0].pago, lista[0].fiel, lista[0].desconto_sugerido], [2, 2000, 900, true, 8]);
  assert.deepEqual(lista[0].unidades.sort(), ['santa-adelia', 'santa-barbara']);
  assert.deepEqual([lista[1].reservas, lista[1].cancelados, lista[1].fiel, lista[1].desconto_sugerido], [1, 1, false, 0]);
});

test('GEST7. config: fidelidade, promoções com imagem e avaliações são salvas, limpas e só o público ativo sai na rota pública', async () => {
  const a = await montar();
  const salvo = await a.api('config', { config: {
    fidelidade: { minimo: 4, percentual: 12 },
    promocoes: [
      { texto: 'Dia 02/11 por R$ 799,99', imagem: '/api/locacao?site=splash&foto=aaaaaaaaaaaaaaaaaaaaaaaa', ativa: true },
      { imagem: 'javascript:alert(1)' },
      { texto: 'Escondida', ativa: false },
    ],
    avaliacoes: [{ nome: 'Ana', texto: 'Festa linda!', estrelas: 9 }, { texto: '' }, { nome: 'Beto', texto: 'Voltaremos', estrelas: 4, ativa: false }],
  } });
  assert.equal(salvo.status, 200, JSON.stringify(salvo.json));
  assert.deepEqual(salvo.json.config.fidelidade, { minimo: 4, percentual: 12 });
  assert.equal(salvo.json.config.promocoes.length, 2, 'promoção só com imagem inválida é descartada');
  assert.equal(salvo.json.config.avaliacoes[0].estrelas, 5, 'estrelas limitadas a 5');
  const pub = await a.publico();
  assert.equal(pub.promocoes.length, 1, 'só promoção ativa aparece');
  assert.match(pub.promocoes[0].imagem, /^\/api\/locacao\?/);
  assert.deepEqual(pub.avaliacoes.map(v => v.nome), ['Ana'], 'avaliação escondida não aparece');
  assert.equal(pub.fidelidade, undefined, 'regra de fidelidade é só da dona');
});
