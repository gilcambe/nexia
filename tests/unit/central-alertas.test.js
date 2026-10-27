'use strict';
// Central: cada alerta abre com o que aconteceu, o impacto e o passo a passo (pedido do dono, 27/10).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../src/pages/central', f), 'utf8');

test('ALERTA1: todo aviso tem oque, impacto e passos', () => {
  const s = ler('avisos.ts');
  const pushes = s.split(/a\.push\(/).slice(1);
  assert.ok(pushes.length >= 10);
  for (const p of pushes) for (const campo of ['oque:', 'impacto:', 'passos:']) assert.ok(p.includes(campo), `aviso sem ${campo}: ${p.slice(0, 80)}`);
});

test('ALERTA2: card Alertas, sino e lista abrem a janela de detalhe (nada de clique que não faz nada)', () => {
  const painel = ler('Painel.tsx');
  const page = ler('page.tsx');
  assert.ok(!painel.includes('ir("inicio")'), 'card Alertas não pode mandar para a própria tela');
  assert.ok(painel.includes('abrirAlerta(null)') && painel.includes('abrirAlerta(k)'));
  assert.ok(page.includes('setAlerta(null)') && page.includes('<AvisoDetalhe'));
  const det = ler('AvisoDetalhe.tsx');
  assert.ok(det.includes('Pedir conserto ao Cortex') && det.includes('O que fazer, passo a passo'));
});

test('ALERTA3: aba antiga avisa que tem versão nova; máquinas mostram o agente real', () => {
  assert.ok(ler('page.tsx').includes('central-versao-nova'));
  const painel = ler('Painel.tsx');
  assert.ok(painel.includes('d.maquinas') && !painel.includes('ainda não estão ligados à Central. O agente'));
});
