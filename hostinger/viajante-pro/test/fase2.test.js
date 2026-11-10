'use strict';
// Fase 2: financeiro (recebido ≠ vendido, parcelas que somam exato, atrasados, margem por viagem),
// agenda/tarefas e leads do site — tudo refletindo no dashboard e nas notificações.
process.env.VP_NAO_LIGAR = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { criarApp } = require('../server');
const { sqliteDriver } = require('../lib/drivers');

const { servidor, db } = criarApp({ env: { FORCE_HTTPS: '0' }, driver: sqliteDriver(':memory:'), semSmtp: true });
let base, token, viagemId;
const api = async corpo => {
  const r = await fetch(base + '/api/viajante-pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...corpo }) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const hoje = new Date().toISOString().slice(0, 10);
const diasAtras = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  await new Promise(r => servidor.listen(0, r));
  base = 'http://127.0.0.1:' + servidor.address().port;
  await db.collection('viajante_contas').doc('viajantepro').set({ nome: 'VP', senha_personalizada: true, senha_salt: 's', senha_hash: crypto.pbkdf2Sync('f2', 's', 100000, 32, 'sha256').toString('hex'), config: {} });
  token = (await (await fetch(base + '/api/viajante-pro', { method: 'POST', body: JSON.stringify({ acao: 'entrar', senha: 'f2' }) })).json()).token;
  const c = await api({ acao: 'cotacao-criar', nome: 'Lia', email: 'lia@exemplo.com', destino: 'Roma', dataIda: '2027-05-01', dataVolta: '2027-05-10', itens: [{ tipo: 'hotel', descricao: 'Hotel', custo: 7000, preco: 10000 }] });
  viagemId = (await api({ acao: 'cotacao-converter', id: c.j.cotacao.id })).j.viagem.id;
});
test.after(() => new Promise(r => servidor.close(r)));

test('sem lançamentos, financeiro vazio (nada inventado)', async () => {
  const { j } = await api({ acao: 'fin-resumo' });
  assert.equal(j.recebido, 0);
  assert.equal(j.a_receber, 0);
  assert.equal(j.por_viagem.length, 1, 'viagem vendida aparece com o que falta lançar');
  assert.equal(j.por_viagem[0].falta_lancar, 10000);
  assert.equal((await api({ acao: 'painel-resumo' })).j.kpis.tem_financeiro, false);
});

test('parcelamento soma exatamente e vence mês a mês', async () => {
  const r = await api({ acao: 'fin-salvar', tipo: 'receber', categoria: 'venda', descricao: 'Pacote Roma', valor: '10.000,00', parcelas: 3, vencimento: '2027-01-31', viagem_id: viagemId, cliente_email: 'LIA@exemplo.com', forma: 'cartao' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const ps = r.j.lancamentos;
  assert.equal(ps.length, 3);
  assert.equal(ps.reduce((t, p) => t + Math.round(p.valor * 100), 0), 1000000, 'soma em centavos = R$ 10.000,00');
  assert.deepEqual(ps.map(p => p.vencimento), ['2027-01-31', '2027-02-28', '2027-03-31'], 'fim de mês ajustado');
  assert.deepEqual(ps.map(p => p.parcela), ['1/3', '2/3', '3/3']);
  assert.equal(ps[0].cliente_email, 'lia@exemplo.com');
  assert.equal((await api({ acao: 'fin-salvar', tipo: 'receber', descricao: 'x', valor: 0 })).status, 400);
});

test('recebido ≠ vendido; atrasados; margem por viagem com custos lançados', async () => {
  const l = (await api({ acao: 'fin-listar' })).j.lancamentos;
  const p1 = l.find(x => x.parcela === '1/3');
  let r = await api({ acao: 'fin-salvar', id: p1.id, status: 'pago', pago_em: hoje });
  assert.equal(r.j.lancamento.situacao, 'pago');
  await api({ acao: 'fin-salvar', tipo: 'pagar', categoria: 'fornecedor', descricao: 'Hotel Roma', valor: 7000, vencimento: diasAtras(2), viagem_id: viagemId, fornecedor: 'Hotel X' });
  await api({ acao: 'fin-salvar', tipo: 'receber', categoria: 'comissao', descricao: 'Comissão operadora', valor: 500, vencimento: diasAtras(5) });
  const { j } = await api({ acao: 'fin-resumo', inicio: diasAtras(30), fim: hoje });
  assert.equal(j.recebido, 3333.33);
  assert.equal(j.a_pagar, 0, 'o do fornecedor está atrasado, não pendente');
  assert.equal(j.atrasado_pagar, 7000);
  assert.equal(j.atrasado_receber, 500);
  assert.equal(j.comissoes_receber, 500);
  assert.equal(j.saldo_periodo, 3333.33);
  const pv = j.por_viagem.find(x => x.id === viagemId);
  assert.equal(pv.vendido, 10000);
  assert.equal(pv.recebido, 3333.33);
  assert.equal(pv.custos, 7000);
  assert.equal(pv.custo_fonte, 'lancamentos');
  assert.equal(pv.margem, 3000);
  assert.equal(pv.falta_lancar, 0);
  const dash = (await api({ acao: 'painel-resumo' })).j;
  assert.equal(dash.kpis.recebido_periodo, 3333.33);
  assert.equal(dash.alertas.pagamentos_atrasados.length, 2);
  // cancelar tira do atrasado
  const forn = (await api({ acao: 'fin-listar' })).j.lancamentos.find(x => x.descricao === 'Hotel Roma');
  await api({ acao: 'fin-salvar', id: forn.id, status: 'cancelado' });
  assert.equal((await api({ acao: 'fin-resumo' })).j.atrasado_pagar, 0);
  assert.equal((await api({ acao: 'fin-excluir', id: forn.id })).status, 400, 'excluir pede confirmação');
  assert.equal((await api({ acao: 'fin-excluir', id: forn.id, confirmar: true })).status, 200);
});

test('tarefas: criar, vincular, concluir; atrasadas e de hoje no dashboard', async () => {
  let r = await api({ acao: 'tarefa-salvar', titulo: 'Emitir bilhetes', data: hoje, hora: '14:00', prioridade: 'alta', vinculo: { tipo: 'viagem', id: viagemId } });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  await api({ acao: 'tarefa-salvar', titulo: 'Ligar para Lia', data: diasAtras(1) });
  assert.equal((await api({ acao: 'tarefa-salvar', titulo: '' })).status, 400);
  let dash = (await api({ acao: 'painel-resumo' })).j;
  assert.equal(dash.kpis.tarefas_hoje, 1);
  assert.equal(dash.kpis.tarefas_atrasadas, 1);
  const lista = (await api({ acao: 'tarefa-listar' })).j.tarefas;
  assert.equal(lista[0].titulo, 'Ligar para Lia', 'ordenadas por data');
  r = await api({ acao: 'tarefa-salvar', id: lista[0].id, status: 'concluida' });
  assert.ok(r.j.tarefa.concluida_em);
  dash = (await api({ acao: 'painel-resumo' })).j;
  assert.equal(dash.kpis.tarefas_atrasadas, 0);
  assert.equal((await api({ acao: 'tarefa-excluir', id: lista[0].id })).status, 200);
});

test('leads do site: listar e mudar etapa', async () => {
  const r = await fetch(base + '/api/leads', { method: 'POST', body: JSON.stringify({ nome: 'Leo', email: 'leo@exemplo.com', consentimento: true }) });
  assert.equal(r.status, 201);
  const ls = (await api({ acao: 'lead-listar' })).j.leads;
  assert.equal(ls.length, 1);
  assert.equal((await api({ acao: 'lead-atualizar', id: ls[0].id, status: 'conversando', proxima_acao: 'Enviar opções de Roma' })).status, 200);
  assert.equal((await api({ acao: 'lead-atualizar', id: ls[0].id, status: 'inventado' })).status, 400);
  assert.equal((await api({ acao: 'lead-listar' })).j.leads[0].status, 'conversando');
});
