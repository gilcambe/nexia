import test from "node:test";
import assert from "node:assert";

// Função pura que traduz as etapas de uma tarefa do Cortex em texto legível.
function etapaDe(etapas) {
  if (!etapas || etapas.length === 0) return "Sem etapa";
  const primeira = etapas[0];
  if (primeira === "cortex-fila") return "Na fila";
  if (primeira === "cortex-travado") return "Travada";
  if (primeira === "cortex-rodando") {
    const partes = [];
    for (let i = 1; i < etapas.length; i++) {
      partes.push(etapas[i].replace(/-/g, " "));
    }
    return partes.length
      ? `Em execução: ${partes.join(" ")}`
      : "Em execução";
  }
  return "Sem etapa";
}

test("etapaDe traduz as etapas da tarefa", (t) => {
  t.test("cortex-fila vira 'Na fila'", () => {
    assert.strictEqual(etapaDe(["cortex-fila"]), "Na fila");
  });

  t.test("cortex-rodando com pista e tentativa", () => {
    const texto = etapaDe(["cortex-rodando", "pista-3", "tentativa-2"]);
    assert.ok(texto.includes("Em execução"), "deve conter 'Em execução': " + texto);
    assert.ok(texto.includes("pista 3"), "deve conter 'pista 3': " + texto);
    assert.ok(texto.includes("tentativa 2"), "deve conter 'tentativa 2': " + texto);
  });

  t.test("cortex-travado começa com 'Travada'", () => {
    assert.ok(etapaDe(["cortex-travado"]).startsWith("Travada"));
  });

  t.test("sem etapas retorna 'Sem etapa'", () => {
    assert.strictEqual(etapaDe([]), "Sem etapa");
    assert.strictEqual(etapaDe(undefined), "Sem etapa");
  });
});
