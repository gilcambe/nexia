'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { responderComoVoceEstaHoje } = require('../../scripts/body-coach-helper.js');

function criarPageMock(opcoes = {}) {
  const acoes = [];

  const criarLocator = (pattern) => {
    const patternStr = String(pattern);
    return {
      first: () => criarLocator(pattern),
      isVisible: async () => {
        if (/Como você está hoje/i.test(patternStr)) return !!opcoes.temTelaComoVoceEsta;
        if (/Dormi bem|Bem/i.test(patternStr)) return !!opcoes.temSono;
        if (/Comi bem|Bem/i.test(patternStr)) return !!opcoes.temComida;
        if (/\^\[34\]\$/.test(patternStr)) return !!opcoes.temEnergia;
        if (/Come\[cç\]ar treino\|Montar Treino/i.test(patternStr)) return !!opcoes.temSubmit;
        if (/Montar Treino de Hoje\|Come\[cç\]ar treino de hoje/i.test(patternStr)) return !!opcoes.temBotaoAntigo;
        return false;
      },
      click: async () => {
        acoes.push(`click: ${patternStr}`);
        return true;
      },
    };
  };

  return {
    acoes,
    getByText: (regex) => criarLocator(regex),
    getByRole: (_role, { name }) => criarLocator(name),
  };
}

test('Body Coach Helper: detecta e responde "Como você está hoje?"', async () => {
  const pageMock = criarPageMock({
    temTelaComoVoceEsta: true,
    temSono: true,
    temComida: true,
    temEnergia: true,
    temSubmit: true,
  });

  const res = await responderComoVoceEstaHoje(pageMock);
  assert.equal(res, true);
  assert.ok(pageMock.acoes.some((a) => /Dormi bem/.test(a)));
  assert.ok(pageMock.acoes.some((a) => /Comi bem/.test(a)));
  assert.ok(pageMock.acoes.some((a) => /34/.test(a)));
  assert.ok(pageMock.acoes.some((a) => /Come/.test(a)));
});

test('Body Coach Helper: fallback para botão antigo quando tela não está visível', async () => {
  const pageMock = criarPageMock({
    temTelaComoVoceEsta: false,
    temBotaoAntigo: true,
  });

  const res = await responderComoVoceEstaHoje(pageMock);
  assert.equal(res, true);
  assert.ok(pageMock.acoes.some((a) => /Montar Treino/.test(a)));
});

test('Body Coach Helper: retorna false quando nenhum botão/tela está visível', async () => {
  const pageMock = criarPageMock({
    temTelaComoVoceEsta: false,
    temBotaoAntigo: false,
  });

  const res = await responderComoVoceEstaHoje(pageMock);
  assert.equal(res, false);
  assert.equal(pageMock.acoes.length, 0);
});
