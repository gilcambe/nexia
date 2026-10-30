import { test } from "node:test";
import assert from "node:assert/strict";
import { nota } from "../nota.js";

test("retorna acerto quando a resposta do atendente usa a palavra-chave", () => {
  const resultado = nota(
    "meu pedido atrasou",
    "Seu pedido atrasou mesmo",
    ["pedido", "atraso"]
  );

  assert.equal(resultado.acertou, true);
  assert.equal(typeof resultado.fraseModelo, "string");
  assert.equal(typeof resultado.traducaoPt, "string");
});

test("retorna erro quando a resposta do atendente não usa a palavra-chave", () => {
  const resultado = nota(
    "meu pedido atrasou",
    "Estou estudando isso agora",
    ["pedido", "atraso"]
  );

  assert.equal(resultado.acertou, false);
  assert.equal(typeof resultado.fraseModelo, "string");
  assert.equal(typeof resultado.traducaoPt, "string");
});
