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
  assert.match(o, /accept="image\/\*,application\/pdf,\.pdf"/);
  assert.match(o, /paraImagens\(/, 'PDF vira imagens com MB.pdf.paraImagens');
  assert.match(o, /\/prumo\/pdf\.js/);
  assert.match(o, /salario_ler/);
  assert.match(o, /pagamento_salvar/);
  assert.match(o, /ponto_salvar/);
  assert.match(o, /salario_config/);
  assert.match(o, /data-acao="salario-base"|\[data-acao="salario-base"\]|'salario-base'/);
  assert.doesNotMatch(o, /holerite_ler|holerite_salvar/, 'não usa mais a leitura antiga');
  assert.match(ler('sw.js'), /'\/prumo\/salario\.js'/);
});
