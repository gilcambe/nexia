'use strict';
// 18/11 (dono): "Tudo que subir no app deve ter a opção de apagar". Recebimento lançado: tocar abre Salvar/Apagar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');

test('cada recebimento vira linha tocável com o id', () => {
  const window = { MB: { ui: { brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s) } } };
  vm.runInNewContext(ler('salario.js'), { window, console });
  const h = window.MB.salario.cartao({ mes: '2026-11', recebidos: [{ id: 'p1', tipo: 'adiantamento', data_pagamento: '2026-11-13', liquido: 4434.35 }], total_recebido: 4434.35, previsao: null, motivo: '' });
  assert.match(h, /data-pag="p1"/);
});

test('a tela do Salário liga editar e apagar no recebimento', () => {
  const o = ler('orcamento.js');
  assert.match(o, /querySelectorAll\('\[data-pag\]'\)/);
  assert.match(o, /pagamento_apagar', \{ id: p\.id \}/);
  assert.match(o, /pagamento_salvar', \{ \.\.\.MB\.salario\.corpoPagamento\(p, d\), id: p\.id \}/);
});
