'use strict';
// Contrato: Kernex Finance — TELA do Salário v2 (aba Salário = prumo/orcamento.js). Dono 17/11: "só aceita print..
// deveria aceitar tudo.. PDF.. etc"; "recebo duas vezes ao mês"; "quando eu colocar o print da folha de ponto ele
// estimar quanto receberei". A API (servidor) é a do contrato finance-salario-v2: salario_ler, pagamento_salvar,
// pagamento_listar, ponto_salvar, salario_config, salario_previsao.
// Pedido:
// 1) Novo arquivo prumo/salario.js (funções PURAS, sem DOM), no padrão:
//      (function () { const MB = window.MB = window.MB || {}; MB.salario = { NOMES, nomeTipo, cartao }; })();
//    - NOMES / nomeTipo(tipo): adiantamento -> 'Adiantamento', mensal -> 'Salário do mês', decimo_terceiro_1 ->
//      '13º (1ª parcela)', decimo_terceiro_2 -> '13º (2ª parcela)', ferias -> 'Férias', plr -> 'PLR', outro -> 'Outro'.
//    - cartao(r) com r = resposta de salario_previsao { mes, recebidos, total_recebido, previsao, motivo } -> HTML:
//      <div class="card" id="sal-cartao">; título "Recebimentos de MM/AAAA"; cada recebido numa linha com o nome do
//      tipo, a data DD/MM e o líquido em R$ (padrão brasileiro "R$ 4.434,35"); "Total recebido" com total_recebido;
//      se previsao: bloco id="sal-previsao" com "Previsão do fechamento" e o valor a_receber em destaque (R$), as
//      linhas da previsao (nome e valor, só as diferentes de 0) e o aviso; se previsao null: o motivo e, se o motivo
//      falar de salário base, um botão <button type="button" data-acao="salario-base">Informar salário base</button>.
//      Sem recebidos: "Nenhum recebimento lançado neste mês.". Textos escapados (&, <, >, ").
// 2) prumo/orcamento.js (aba Salário):
//    - carrega /prumo/salario.js e mostra MB.salario.cartao(await MB.api('salario_previsao', { mes: mesSel })) no topo;
//    - botões: id="sal-holerite" "📄 Holerite (foto ou PDF)", id="sal-ponto" "🕒 Folha de ponto",
//      id="sal-manual" "✍️ Lançar à mão" e o data-acao="salario-base" abre um formulário (salario_config);
//    - <input type="file" accept="image/*,application/pdf,.pdf" multiple>: PDF vira imagens com o mesmo
//      MB.pdf.paraImagens de prumo/documentos.js (carregar /prumo/pdf.js); fotos com reduzir; até 5 arquivos;
//    - manda MB.api('salario_ler', { tipo: 'holerite' | 'ponto', imagens }) e, para CADA lido ok, abre o formulário de
//      conferência (tipo, data, bruto, líquido) e salva com pagamento_salvar (ou ponto_salvar para ponto);
//      os lidos com ok:false aparecem numa mensagem dizendo quantos não deu para ler;
//    - não usa mais holerite_ler nem holerite_salvar.
// 3) prumo/sw.js: '/prumo/salario.js' na lista CASCA.
// 4) (17/11, revisão do PR #3945, que lia só 1 arquivo e salvava o objeto errado) O FLUXO é testado rodando a tela:
//    - MB.salario.camposRecebimento(p, mesSel) -> campos do formulário (MB.ui.formulario) com nome: 'tipo' (opcoes =
//      <option> de cada tipo, o de p.tipo com selected), 'data_pagamento' (tipo 'date'), 'mes' (tipo 'month'),
//      'bruto', 'liquido' (tipo 'number') e 'empresa'; valores vindos de p (mes padrão = mesSel).
//    - MB.salario.corpoPagamento(p, d) -> { ...p, ...d, bruto: Number, liquido: Number } (sem os campos ok/erro/lido).
//    - Holerite: TODOS os arquivos escolhidos (até 5) vão juntos em `const { imagens } = await MB.pdf.paraImagens(arquivos,
//      reduzir)` (fotos e PDF juntos; é assim que pdf.js funciona) e depois em salario_ler { tipo, imagens }.
//    - Para cada lido ok de holerite: formulario('Confira o recebimento', MB.salario.camposRecebimento(lido.pagamento,
//      mesSel), (d) => MB.api('pagamento_salvar', MB.salario.corpoPagamento(lido.pagamento, d))).
//    - Para cada lido ok de ponto: MB.api('ponto_salvar', lido.ponto).
//    - 'Lançar à mão' usa o mesmo formulário com p = {}.
//    - Falhas: MB.ui.ok com a quantidade que não deu para ler. O <input type="file"> tem id="sal-arq".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
function carregar() {
  const window = { MB: {} };
  vm.runInNewContext(ler('salario.js'), { window, console });
  assert.ok(window.MB.salario, 'prumo/salario.js define window.MB.salario');
  return window.MB.salario;
}
const R = {
  mes: '2026-11', total_recebido: 10317.72, motivo: null,
  recebidos: [
    { id: 'a', tipo: 'adiantamento', data_pagamento: '2026-11-13', liquido: 4434.35 },
    { id: 'b', tipo: 'decimo_terceiro_1', data_pagamento: '2026-11-19', liquido: 5883.37 },
  ],
  previsao: { a_receber: 2759.64, liquido: 7193.99, aviso: 'É uma estimativa: convênios e outros descontos da empresa não entram.',
    linhas: [{ nome: 'Salário base', valor: 8868.69 }, { nome: 'Horas extras', valor: 604.68 }, { nome: 'Adicional noturno', valor: 0 }, { nome: 'DSR', valor: 184.03 }, { nome: 'INSS', valor: -988.09 }, { nome: 'IR', valor: -1475.33 }] },
};

test('nomes dos tipos de recebimento', () => {
  const s = carregar();
  assert.equal(s.nomeTipo('adiantamento'), 'Adiantamento');
  assert.equal(s.nomeTipo('mensal'), 'Salário do mês');
  assert.equal(s.nomeTipo('decimo_terceiro_1'), '13º (1ª parcela)');
  assert.equal(s.nomeTipo('decimo_terceiro_2'), '13º (2ª parcela)');
  assert.equal(s.nomeTipo('ferias'), 'Férias');
});

test('cartão: recebimentos do mês, total e previsão do fechamento', () => {
  const h = carregar().cartao(R);
  assert.match(h, /id="sal-cartao"/);
  assert.match(h, /Recebimentos de 11\/2026/);
  assert.match(h, /Adiantamento[\s\S]*13\/11[\s\S]*R\$\s4\.434,35/);
  assert.match(h, /13º \(1ª parcela\)[\s\S]*19\/11[\s\S]*R\$\s5\.883,37/);
  assert.match(h, /Total recebido[\s\S]*R\$\s10\.317,72/);
  assert.match(h, /id="sal-previsao"/);
  assert.match(h, /Previsão do fechamento[\s\S]*R\$\s2\.759,64/);
  assert.match(h, /Horas extras[\s\S]*R\$\s604,68/);
  assert.match(h, /DSR/);
  assert.doesNotMatch(h, /Adicional noturno/, 'linha com valor 0 não aparece');
  assert.match(h, /estimativa/i);
});

test('cartão sem salário base: mostra o motivo e o botão; sem recebidos: frase simples; escapa texto', () => {
  const s = carregar();
  const h = s.cartao({ mes: '2026-11', recebidos: [], total_recebido: 0, previsao: null, motivo: 'Informe seu salário base para eu prever o fechamento.' });
  assert.match(h, /Nenhum recebimento lançado neste mês\./);
  assert.match(h, /Informe seu salário base/);
  assert.match(h, /data-acao="salario-base"/);
  const x = s.cartao({ mes: '2026-11', recebidos: [], total_recebido: 0, previsao: null, motivo: '<img src=x>' });
  assert.doesNotMatch(x, /<img/);
  assert.doesNotMatch(x, /data-acao="salario-base"/);
});

test('aba Salário usa a API nova, aceita PDF e lê holerite e folha de ponto', () => {
  const o = ler('orcamento.js');
  assert.match(o, /\/prumo\/salario\.js/);
  assert.match(o, /salario_previsao/);
  assert.match(o, /MB\.salario\.cartao\(/);
  for (const id of ['sal-holerite', 'sal-ponto', 'sal-manual']) assert.match(o, new RegExp(`id="${id}"`), `botão #${id}`);
  // 18/11: accept misto abria o seletor de documentos do Android, que entregava 0 KB. Print = image/*; PDF = botão próprio.
  assert.match(o, /id="sal-arq" accept="image\/\*"/);
  assert.match(o, /id="sal-holerite-pdf"/);
  assert.match(o, /'application\/pdf,\.pdf'/);
  // 17/11 (celular do dono): o pdf.js falhava ou gerava imagem vazia. PDF vai CRU (FileReader) e o servidor lê.
  assert.match(o, /readAsDataURL/, 'PDF vai inteiro (data:application/pdf)');
  assert.match(o, /\/prumo\/pdf\.js/);
  assert.match(o, /salario_ler/);
  assert.match(o, /pagamento_salvar/);
  assert.match(o, /ponto_salvar/);
  assert.match(o, /salario_config/);
  assert.match(o, /data-acao="salario-base"|\[data-acao="salario-base"\]|'salario-base'/);
  assert.doesNotMatch(o, /holerite_ler|holerite_salvar/, 'não usa mais a leitura antiga');
  assert.match(ler('sw.js'), /'\/prumo\/salario\.js'/);
});

// ---------- Fluxo (item 4): roda prumo/orcamento.js com elementos falsos ----------
function montarTela(respostaLer) {
  const chamadas = []; const forms = []; const avisos = []; const pdfs = [];
  const stubs = {};
  const stub = (sel) => (stubs[sel] = stubs[sel] || { sel, onclick: null, onchange: null, dataset: {}, files: [], value: '', click() {}, closest() { return null; }, addEventListener() {} });
  const el = { innerHTML: '', querySelector: stub, querySelectorAll: () => [], addEventListener() {}, appendChild() {} };
  const window = { MB: { telas: {} } };
  const MB = window.MB;
  MB.api = async (acao, dados) => {
    chamadas.push({ acao, dados });
    if (acao === 'orcamento_resumo') return { orcamento: { fixas: [], guardar: [], limites: {} }, alertas: [], renda: 0, fixas: 0, guardar: 0, cartao: 0, sobra: 0, holerite_mes: null };
    if (acao === 'objetivo_listar') return { objetivos: [] };
    if (acao === 'salario_previsao') return { mes: '2026-11', recebidos: [], total_recebido: 0, previsao: null, motivo: 'Informe seu salário base para eu prever o fechamento.' };
    if (acao === 'salario_ler') return { lidos: respostaLer };
    return { ok: true };
  };
  const B64 = 'A'.repeat(300);
  const reduzir = async (f) => `data:image/jpeg;base64,${B64}${f.name.length}`;
  MB.ui = { aba() {}, brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s), TIPOS: {}, CATS: {}, hoje: () => '2026-11-20', opcoes: () => '', barra: () => '',
    formulario: (titulo, campos, aoSalvar) => { forms.push({ titulo, campos, aoSalvar }); }, reduzir, recarregar() {}, ok: (m) => { avisos.push(m); }, aviso: (m) => { avisos.push(m); } };
  MB.pdf = { ehPdf: (a) => /\.pdf$/.test(a.name), MAX: 5, paraImagens: async (arqs, red) => { pdfs.push({ arqs, red }); const imagens = []; for (const a of arqs) { if (/\.pdf$/.test(a.name)) imagens.push(`P1:${a.name}`, `P2:${a.name}`); else imagens.push(await red(a)); } return { imagens: imagens.slice(0, 5), cortou: false }; } };
  const document = { createElement: () => ({}), body: { appendChild: (s) => { if (s.onload) setTimeout(s.onload, 0); } }, querySelector: () => null };
  class FileReader { readAsDataURL(a) { this.result = `data:${a.type || ''};base64,${B64}P${a.name.length}`; setTimeout(() => this.onload(), 0); } }
  const ctx = { window, document, console, setTimeout, clearTimeout, Promise, FileReader };
  vm.runInNewContext(ler('salario.js'), ctx);
  vm.runInNewContext(ler('orcamento.js'), ctx);
  return { MB, el, stub, chamadas, forms, avisos, pdfs };
}
const espera = () => new Promise((r) => setTimeout(r, 30));
const campo = (campos, nome) => campos.find((c) => c.nome === nome);

test('funções puras do formulário de recebimento', () => {
  const s = carregar();
  const c = s.camposRecebimento({ tipo: 'decimo_terceiro_1', data_pagamento: '2026-11-19', mes: '2026-11', bruto: 5883.37, liquido: 5883.37, empresa: 'X' }, '2026-10');
  assert.match(campo(c, 'tipo').opcoes, /value="decimo_terceiro_1"[^>]*selected/);
  assert.match(campo(c, 'tipo').opcoes, /value="adiantamento"/);
  assert.equal(campo(c, 'data_pagamento').tipo, 'date');
  assert.equal(campo(c, 'data_pagamento').valor, '2026-11-19');
  assert.equal(campo(c, 'mes').valor, '2026-11');
  assert.equal(campo(c, 'liquido').tipo, 'number');
  assert.equal(campo(s.camposRecebimento({}, '2026-10'), 'mes').valor, '2026-10', 'mês padrão = mês da tela');
  const corpo = s.corpoPagamento({ tipo: 'adiantamento', mes: '2026-11', ok: true }, { data_pagamento: '2026-11-13', bruto: '4434.35', liquido: '4434.35' });
  assert.equal(corpo.liquido, 4434.35); assert.equal(corpo.bruto, 4434.35);
  assert.equal(corpo.tipo, 'adiantamento'); assert.equal(corpo.data_pagamento, '2026-11-13');
  assert.equal('ok' in corpo, false);
});

test('fluxo holerite: lê TODOS os arquivos (foto + PDF), confere cada um e salva o pagamento certo', async () => {
  const t = montarTela([{ ok: true, pagamento: { tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-13', bruto: 4434.35, liquido: 4434.35 } },
    { ok: true, pagamento: { tipo: 'decimo_terceiro_1', mes: '2026-11', data_pagamento: '2026-11-19', bruto: 5883.37, liquido: 5883.37 } },
    { ok: false, erro: 'Não consegui ler esta imagem.' }]);
  await t.MB.telas.orcamento(t.el);
  assert.equal(typeof t.stub('#sal-holerite').onclick, 'function', 'botão #sal-holerite ligado');
  t.stub('#sal-holerite').onclick();
  const arq = t.stub('#sal-arq');
  assert.equal(typeof arq.onchange, 'function', '<input type=file id="sal-arq"> com onchange');
  arq.files = [{ name: 'adiant.png', type: 'image/png' }, { name: 'decimo.pdf', type: 'application/pdf' }];
  await arq.onchange(); await espera();
  assert.equal(t.pdfs.length, 0, 'PDF não passa mais pelo pdf.js do celular');
  const ler1 = t.chamadas.find((c) => c.acao === 'salario_ler');
  assert.ok(ler1, 'chamou salario_ler');
  assert.equal(ler1.dados.tipo, 'holerite');
  const B = 'A'.repeat(300);
  assert.deepEqual([...ler1.dados.imagens], [`data:image/jpeg;base64,${B}10`, `data:application/pdf;base64,${B}P10`], 'foto reduzida + PDF inteiro');
  assert.equal(t.forms.length, 2, 'um formulário de conferência por recebimento lido');
  assert.match(campo(t.forms[0].campos, 'tipo').opcoes, /value="adiantamento"[^>]*selected/);
  assert.equal(campo(t.forms[1].campos, 'data_pagamento').valor, '2026-11-19');
  await t.forms[0].aoSalvar({ tipo: 'adiantamento', data_pagamento: '2026-11-13', mes: '2026-11', bruto: '4434.35', liquido: '4434.35', empresa: '' });
  const salvo = t.chamadas.find((c) => c.acao === 'pagamento_salvar');
  assert.ok(salvo, 'salvou com pagamento_salvar');
  assert.equal(salvo.dados.tipo, 'adiantamento'); assert.equal(salvo.dados.data_pagamento, '2026-11-13'); assert.equal(salvo.dados.liquido, 4434.35);
  assert.equal('ok' in salvo.dados, false, 'não manda o envelope { ok, pagamento }');
  assert.ok(t.avisos.some((m) => /1/.test(String(m))), 'avisa que 1 não deu para ler');
});

test('fluxo folha de ponto: salva o ponto lido; lançar à mão abre o formulário completo', async () => {
  const ponto = { mes: '2026-11', he50: 10, he100: 0, noturnas: 0, faltas: 0 };
  const t = montarTela([{ ok: true, ponto }]);
  await t.MB.telas.orcamento(t.el);
  t.stub('#sal-ponto').onclick();
  const arq = t.stub('#sal-arq');
  arq.files = [{ name: 'ponto.jpg', type: 'image/jpeg' }];
  await arq.onchange(); await espera();
  assert.equal(t.chamadas.find((c) => c.acao === 'salario_ler').dados.tipo, 'ponto');
  const ps = t.chamadas.find((c) => c.acao === 'ponto_salvar');
  assert.ok(ps, 'salvou com ponto_salvar');
  assert.deepEqual({ ...ps.dados }, ponto, 'manda o ponto lido (não { ok, ponto })');
  t.stub('#sal-manual').onclick();
  const f = t.forms[t.forms.length - 1];
  assert.ok(f && campo(f.campos, 'tipo') && campo(f.campos, 'data_pagamento'), 'formulário à mão tem tipo e data do pagamento');
});
