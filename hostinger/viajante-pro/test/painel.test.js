'use strict';
// Painel premium (Fase 1): resumo com números reais, cotações completas + conversão em viagem,
// clientes sem duplicar, busca, documentos (upload/baixar/permissões) e app do passageiro sem dados internos.
process.env.VP_NAO_LIGAR = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { criarApp } = require('../server');
const { sqliteDriver } = require('../lib/drivers');

const driver = sqliteDriver(':memory:');
const { servidor, db } = criarApp({ env: { FORCE_HTTPS: '0' }, driver, semSmtp: true });
let base;
let token;

const api = async corpo => {
  const r = await fetch(base + '/api/viajante-pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...corpo }) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const arq = async (corpo, headers = {}) => {
  const r = await fetch(base + '/api/vp-arquivos', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(corpo) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};

test.before(async () => {
  await new Promise(r => servidor.listen(0, r));
  base = 'http://127.0.0.1:' + servidor.address().port;
  const salt = 'saltpainel';
  await db.collection('viajante_contas').doc('viajantepro').set({
    nome: 'Viajante Pro', senha_personalizada: true, senha_salt: salt,
    senha_hash: crypto.pbkdf2Sync('painel-teste', salt, 100000, 32, 'sha256').toString('hex'), config: {},
  });
  const r = await fetch(base + '/api/viajante-pro', { method: 'POST', body: JSON.stringify({ acao: 'entrar', senha: 'painel-teste' }) });
  token = (await r.json()).token;
});
test.after(() => new Promise(r => servidor.close(r)));

test('dashboard começa vazio e sem número inventado', async () => {
  const { status, j } = await api({ acao: 'painel-resumo', dias: 30 });
  assert.equal(status, 200);
  assert.equal(j.kpis.clientes, 0);
  assert.equal(j.kpis.cotacoes_abertas, 0);
  assert.equal(j.kpis.conversao, null, 'sem cotações, conversão não existe (não é 0%)');
  assert.equal(j.kpis.ticket_medio, null);
  assert.equal(j.serie.length, 6);
});

let cotId;
let viagemId;
let codigo;
test('cotação: site + painel, itens com custo/preço, status, conversão em viagem', async () => {
  let r = await fetch(base + '/api/viajante-pro', { method: 'POST', body: JSON.stringify({ acao: 'solicitar_cotacao', nome: 'Ana Lima', email: 'ANA@exemplo.com', whatsapp: '11988887777', destino: 'Maldivas', dataIda: '2027-01-10', dataVolta: '2027-01-20', adultos: 2, consentimento: true }) });
  assert.equal(r.status, 200);
  r = await api({ acao: 'cotacao-criar', nome: 'Bruno Reis', email: 'bruno@exemplo.com', destino: 'Paris', canal: 'indicacao' });
  assert.equal(r.status, 200);
  assert.equal(r.j.cotacao.status, 'em_preparacao');

  const lista = (await api({ acao: 'cotacao-listar' })).j.cotacoes;
  assert.equal(lista.length, 2, 'ação antiga continua listando tudo');
  cotId = lista.find(c => c.nome === 'Ana Lima').id;

  r = await api({ acao: 'cotacao-salvar', id: cotId, status: 'enviada', validade: '2027-01-01', desconto: '500', taxas: '100,50',
    itens: [{ tipo: 'voo', descricao: 'GRU-MLE executiva', fornecedor: 'Emirates', custo: '20.000,00', preco: '24000' }, { tipo: 'hotel', descricao: 'Villa sobre a água', custo: 30000, preco: 36000 }] });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.deepEqual(r.j.cotacao.totais, { custo: 50000, venda: 59600.5, margem: 9600.5, temValores: true });
  assert.equal((await api({ acao: 'cotacao-salvar', id: cotId, status: 'inventado' })).status, 400);

  r = await api({ acao: 'cotacao-converter', id: cotId });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  viagemId = r.j.viagem.id;
  codigo = r.j.viagem.codigoSecreto;
  assert.equal(r.j.viagem.passageiros.length, 2);
  assert.equal(r.j.viagem.servicos.length, 2);
  assert.equal(r.j.viagem.datas.inicio, '2027-01-10');
  assert.equal((await api({ acao: 'cotacao-converter', id: cotId })).status, 409, 'não converte duas vezes');
  const cot = (await api({ acao: 'cotacao-detalhe', id: cotId })).j.cotacao;
  assert.equal(cot.status_painel, 'aprovada');
  assert.equal(cot.viagem_id, viagemId);
  assert.ok(cot.historico.length >= 2);
});

test('dashboard reflete os dados reais', async () => {
  const { j } = await api({ acao: 'painel-resumo', dias: 30 });
  assert.equal(j.kpis.clientes, 2);
  assert.equal(j.kpis.cotacoes_periodo, 2);
  assert.equal(j.kpis.cotacoes_abertas, 1);
  assert.equal(j.kpis.aprovadas_periodo, 1);
  assert.equal(j.kpis.vendido_periodo, 59600.5);
  assert.equal(j.kpis.conversao, 50);
  assert.equal(j.kpis.margem_estimada, 9600.5);
  assert.equal(j.kpis.viagens_proximas, 1);
  assert.deepEqual(j.origem, { site: 1, indicacao: 1 });
  assert.equal(j.destinos_vendidos[0].destino, 'Maldivas');
  assert.ok(j.listas.atividades.length >= 2, 'trilha de atividades');
});

test('viagem: detalhes, serviços, status; app do passageiro não vê custos', async () => {
  let r = await api({ acao: 'viagem-salvar-detalhes', id: viagemId, status: 'confirmada', observacoes_internas: 'margem apertada', custo_total: 50000,
    servicos: [{ tipo: 'voo', descricao: 'EK262', localizador: 'ABC123', status: 'confirmada', observacoes: 'interno' }] });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal((await api({ acao: 'viagem-salvar-detalhes', id: viagemId, status: 'xyz' })).status, 400);
  r = await fetch(base + '/api/viajante-pro', { method: 'POST', body: JSON.stringify({ acao: 'app-viagem', codigo }) });
  const v = (await r.json()).viagem;
  assert.equal(v.servicos[0].localizador, 'ABC123');
  assert.equal(v.custo_total, undefined);
  assert.equal(v.valor_total, undefined);
  assert.equal(v.observacoes_internas, undefined);
  assert.equal(v.servicos[0].observacoes, undefined);
  // viagem-editar antigo continua funcionando e não apaga os campos novos
  r = await api({ acao: 'viagem-editar', id: viagemId, nome: 'Lua de mel Maldivas' });
  assert.equal(r.status, 200);
  assert.equal((await api({ acao: 'viagem-detalhe', id: viagemId })).j.viagem.servicos.length, 1);
});

test('clientes: sem duplicar (e-mail em maiúscula), CRM e busca', async () => {
  let r = await api({ acao: 'cliente-salvar', email: 'Ana@Exemplo.com', nome: 'Ana Lima', vip: true, etiquetas: 'lua de mel, praia', preferencias: { classe: 'Executiva' } });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const lista = (await api({ acao: 'cliente-listar' })).j.clientes;
  assert.equal(lista.filter(c => c.email === 'ana@exemplo.com').length, 1);
  const ana = lista.find(c => c.email === 'ana@exemplo.com');
  assert.equal(ana.vip, true);
  assert.equal(ana.cotacoes, 1);
  assert.equal(ana.viagens, 1);
  r = await api({ acao: 'cliente-detalhe', email: 'ana@exemplo.com' });
  assert.equal(r.j.cliente.preferencias.classe, 'Executiva');
  assert.equal(r.j.viagens.length, 1);
  r = await api({ acao: 'painel-buscar', q: 'maldiv' });
  assert.ok(r.j.resultados.some(x => x.tipo === 'cotacao'));
  assert.ok(r.j.resultados.some(x => x.tipo === 'viagem'));
  assert.equal((await api({ acao: 'cliente-salvar', email: 'sem-arroba', nome: 'X' })).status, 400);
});

test('documentos: enviar (admin), baixar, liberar ao passageiro, bloquear quem não pode', async () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(1300 * 1024)]); // > 2 partes
  const sem = await fetch(base + `/api/vp-arquivos?acao=enviar&nome=voucher.pdf&vinculo_tipo=viagem&vinculo_id=${viagemId}`, { method: 'POST', body: pdf });
  assert.equal(sem.status, 401, 'sem login não envia');
  const ruim = await fetch(base + `/api/vp-arquivos?acao=enviar&nome=pagina.html&vinculo_tipo=viagem&vinculo_id=${viagemId}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: '<script>' });
  assert.equal(ruim.status, 415, 'HTML não é aceito');
  let r = await fetch(base + `/api/vp-arquivos?acao=enviar&nome=Voucher%20Hotel.pdf&categoria=voucher&vinculo_tipo=viagem&vinculo_id=${viagemId}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/pdf' }, body: pdf });
  assert.equal(r.status, 200);
  const doc = (await r.json()).documento;
  assert.equal(doc.tamanho, pdf.length);
  r = await fetch(base + `/api/vp-arquivos?acao=enviar&nome=planilha.xlsx&categoria=planilha&vinculo_tipo=cliente&vinculo_id=ANA@exemplo.com`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: Buffer.from('PK fake xlsx') });
  assert.equal(r.status, 200);

  // admin baixa igual ao enviado
  r = await fetch(base + `/api/vp-arquivos?id=${doc.id}`, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /attachment/);
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(pdf), 'arquivo volta idêntico');

  // passageiro: só depois de liberado
  assert.equal((await fetch(base + `/api/vp-arquivos?id=${doc.id}`, { headers: { 'X-VP-Codigo': codigo } })).status, 403);
  assert.equal((await arq({ acao: 'app-listar', codigo })).j.documentos.length, 0);
  r = await arq({ acao: 'atualizar', id: doc.id, visivel_passageiro: true }, { Authorization: 'Bearer ' + token });
  assert.equal(r.status, 200);
  assert.equal((await arq({ acao: 'app-listar', codigo })).j.documentos.length, 1);
  assert.equal((await fetch(base + `/api/vp-arquivos?id=${doc.id}`, { headers: { 'X-VP-Codigo': codigo } })).status, 200);
  assert.equal((await fetch(base + `/api/vp-arquivos?id=${doc.id}`, { headers: { 'X-VP-Codigo': 'codigo-errado' } })).status, 403);

  // cliente vê seus documentos no CRM
  const det = (await api({ acao: 'cliente-detalhe', email: 'ana@exemplo.com' })).j;
  assert.equal(det.documentos.length, 2, 'planilha do cliente + voucher da viagem dele');

  // listar e excluir (com confirmação)
  assert.equal((await arq({ acao: 'listar' }, { Authorization: 'Bearer ' + token })).j.documentos.length, 2);
  assert.equal((await arq({ acao: 'excluir', id: doc.id }, { Authorization: 'Bearer ' + token })).status, 400);
  assert.equal((await arq({ acao: 'excluir', id: doc.id, confirmar: true }, { Authorization: 'Bearer ' + token })).status, 200);
  assert.equal((await fetch(base + `/api/vp-arquivos?id=${doc.id}`, { headers: { Authorization: 'Bearer ' + token } })).status, 404);
  assert.equal((await driver.partesLer(doc.id)).length, 0, 'partes apagadas do banco');
});

test('limite de 20 MB', async () => {
  const grande = Buffer.alloc(20 * 1024 * 1024 + 10);
  const r = await fetch(base + `/api/vp-arquivos?acao=enviar&nome=g.pdf&vinculo_tipo=geral`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: grande });
  assert.equal(r.status, 413);
});
