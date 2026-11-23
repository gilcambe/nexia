const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const memoria = require("../../nexia-ai/contrato/memoria.js");
const executor = require("../../nexia-ai/contrato/executor.js");

test("constituicao() retorna texto com as 6 seções e até 2500 caracteres", () => {
  const text = memoria.constituicao();
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0 && text.length <= 2500);
  assert.ok(text.includes("segurança dos dados do cliente"));
  assert.ok(text.includes("Pedido ambíguo"));
  assert.ok(text.includes("Recusar"));
  assert.ok(text.includes("Honestidade"));
  assert.ok(text.includes("editar e apagar"));
  assert.ok(text.includes("português do Brasil"));
});

test("constituicao() retorna string vazia quando o arquivo não existe", () => {
  const origExistsSync = fs.existsSync;
  fs.existsSync = (p) => {
    if (typeof p === "string" && p.endsWith("constituicao.md")) {
      return false;
    }
    return origExistsSync(p);
  };
  try {
    const text = memoria.constituicao();
    assert.equal(text, "");
  } finally {
    fs.existsSync = origExistsSync;
  }
});

test("executor inclui a constituição antes das lições no prompt de sistema", () => {
  const prompt = executor.montarPromptSistema();
  assert.equal(typeof prompt, "string");
  assert.ok(prompt.includes("CONSTITUIÇÃO DO CORTEX (valores; siga sempre):"));
  
  const posConstituicao = prompt.indexOf("CONSTITUIÇÃO DO CORTEX (valores; siga sempre):");
  const posLicoes = prompt.indexOf("LIÇÕES APRENDIDAS:");
  
  if (posLicoes !== -1) {
    assert.ok(posConstituicao < posLicoes);
  }
});
