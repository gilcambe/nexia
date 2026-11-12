"use strict";

// Teste do pedido #895c30: a notificacao de lembrete da tela de Compras
// usa o nome "Kernex Finance: " no lugar de "Prumo: ".

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ARQUIVO = path.join(__dirname, "..", "..", "prumo", "compras.js");

// Janela falsa: o arquivo e uma IIFE que usa window.MB.
function janelaFalsa() {
  const notificacoes = [];
  const win = {
    MB: {
      auth: { usuario: () => ({ nome: "Dono" }) },
      listar: () => [],
      ler: () => ({ itens: [] }),
    },
    Notification: function (titulo, opcoes) {
      notificacoes.push({ titulo: titulo, opcoes: opcoes });
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ itens: [] }) }),
  };
  win.window = win;
  return { win: win, notificacoes: notificacoes };
}

test("a notificacao de lembrete comeca com 'Kernex Finance: '", () => {
  const codigo = fs.readFileSync(ARQUIVO, "utf8");
  assert.ok(
    codigo.indexOf("Kernex Finance: ' + l.nome") !== -1,
    "a notificacao deve usar 'Kernex Finance: ' + l.nome",
  );
  assert.ok(
    codigo.indexOf("Prumo: ' + l.nome") === -1,
    "nao deve sobrar a string antiga 'Prumo: ' + l.nome",
  );
});

test("vigiarLembretes cria a notificacao com o nome do produto", () => {
  const codigo = fs.readFileSync(ARQUIVO, "utf8");
  const falsa = janelaFalsa();
  const contexto = vm.createContext(falsa.win);
  vm.runInContext(codigo, contexto, { filename: ARQUIVO });

  const MB = falsa.win.MB;
  assert.equal(typeof MB.telas.compras, "function", "MB.telas.compras continua existindo");
  assert.equal(typeof MB.telas.abrirLista, "function", "MB.telas.abrirLista continua existindo");
  assert.equal(typeof MB.telas.vigiarLembretes, "function", "MB.telas.vigiarLembretes continua existindo");

  const lista = { nome: "Feira", itens: [{ nome: "Arroz" }] };
  MB.telas.vigiarLembretes(lista);

  assert.equal(falsa.notificacoes.length, 1, "deve criar 1 notificacao");
  assert.equal(falsa.notificacoes[0].titulo, "Kernex Finance: Feira");
  assert.equal(falsa.notificacoes[0].opcoes.icon, "/prumo/icone.svg");
  assert.equal(falsa.notificacoes[0].opcoes.body, "Faltam 1 itens na sua lista.");
});
