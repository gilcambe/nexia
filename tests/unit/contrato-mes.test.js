// tests/unit/contrato-mes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

// Load the module under test
const mes = require('../../prumo/mes.js');

// Helper to simulate the DOM environment expected by mes.js
function createFakeDocument() {
  const elements = {};
  return {
    createElement(tag) {
      const el = { tagName: tag.toUpperCase(), children: [], attributes: {}, innerHTML: '' };
      el.appendChild = (child) => el.children.push(child);
      el.setAttribute = (k, v) => (el.attributes[k] = v);
      el.addEventListener = (event, handler) => (el[`on${event}`] = handler);
      el.click = () => {
        if (el.onclick) el.onclick();
        // also fire custom handlers stored in attributes like data-onclick
        if (el.attributes['data-onclick']) el.attributes['data-onclick']();
      };
      return el;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      // very simple selector support for ".linha"
      return Object.values(elements).filter((el) => el.classList && el.classList.contains('linha'));
    },
    register(id, el) {
      elements[id] = el;
    }
  };
}

// Fake MB.ui.formulario implementation to capture calls
const fakeFormCalls = [];
const MB = {
  ui: {
    formulario: (dados) => {
      fakeFormCalls.push(dados);
    }
  },
  api: {
    removerLancamento: (id) => {
      // no‑op for test, just record
    }
  }
};

// Fake confirm implementation
let confirmResult = false;
global.confirm = (msg) => confirmResult;

// Prepare a minimal item list used by mes.renderLista (hypothetical function)
const sampleItems = [
  { id: '1', descricao: 'Conta de luz', valor: 120 },
  { id: '2', descricao: 'Internet', valor: 80 }
];

// Assume mes.js exports a function `renderLista(items, document, MB)` that returns a DOM element
// If the real export differs, adjust the test accordingly.

test('renderLista inclui botões de edição e remoção', () => {
  const doc = createFakeDocument();
  const container = doc.createElement('div');
  doc.register('container', container);

  // Call the function under test
  const resultEl = mes.renderLista(sampleItems, doc, MB);

  // Verify that result is a DOM element containing children
  assert.ok(resultEl);
  assert.ok(Array.isArray(resultEl.children));

  // Each line should have exactly two button elements (✏️ and 🗑)
  const linhas = resultEl.children.filter((c) => c.classList && c.classList.contains('linha'));
  assert.equal(linhas.length, sampleItems.length, 'deve haver uma linha por item');

  linhas.forEach((linha) => {
    const editBtn = linha.children.find((c) => c.innerHTML === '✏️');
    const deleteBtn = linha.children.find((c) => c.innerHTML === '🗑');
    assert.ok(editBtn, 'botão de edição presente');
    assert.ok(deleteBtn, 'botão de remoção presente');
  });
});

test('clicar no botão de edição abre formulário preenchido', () => {
  const doc = createFakeDocument();
  const resultEl = mes.renderLista(sampleItems, doc, MB);
  const primeiraLinha = resultEl.children.find((c) => c.classList && c.classList.contains('linha'));
  const editBtn = primeiraLinha.children.find((c) => c.innerHTML === '✏️');

  // Simular clique
  editBtn.click();

  // O formulário deve ter sido chamado com os dados do primeiro item
  assert.equal(fakeFormCalls.length, 1, 'formulário chamado uma vez');
  assert.deepStrictEqual(fakeFormCalls[0], sampleItems[0]);
});

test('clicar no botão de remoção pede confirmação e remove o item', () => {
  const doc = createFakeDocument();
  const resultEl = mes.renderLista(sampleItems, doc, MB);
  const primeiraLinha = resultEl.children.find((c) => c.classList && c.classList.contains('linha'));
  const deleteBtn = primeiraLinha.children.find((c) => c.innerHTML === '🗑');

  // Caso 1: usuário cancela (confirm returns false)
  confirmResult = false;
  deleteBtn.click();
  // linha deve permanecer
  assert.ok(resultEl.children.includes(primeiraLinha), 'item não removido quando cancelado');

  // Caso 2: usuário confirma (confirm returns true)
  confirmResult = true;
  // substituímos a remoção real por um spy
  let removed = false;
  const MBSpy = {
    ui: MB.ui,
    api: {
      removerLancamento: (id) => {
        removed = id === sampleItems[0].id;
      }
    }
  };
  // Render novamente com spy para capturar chamada
  const resultEl2 = mes.renderLista(sampleItems, doc, MBSpy);
  const linha2 = resultEl2.children.find((c) => c.classList && c.classList.contains('linha'));
  const delBtn2 = linha2.children.find((c) => c.innerHTML === '🗑');
  delBtn2.click();

  assert.ok(removed, 'removerLancamento foi chamado com o id correto');
  // A linha deve ter sido removida do DOM
  assert.ok(!resultEl2.children.includes(linha2), 'linha removida do DOM após confirmação');
});
