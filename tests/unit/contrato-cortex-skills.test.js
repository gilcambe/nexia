const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("SKILL tela-finance: frontmatter, corpo e caminho invalido", () => {
  const arquivo = path.join(__dirname, "../../nexia-ai/skills/tela-finance/SKILL.md");
  const conteudo = fs.readFileSync(arquivo, "utf8");

  // caso comum: frontmatter valido
  assert.ok(conteudo.startsWith("---\n"), "deve iniciar com frontmatter");
  assert.ok(conteudo.includes("name: tela-finance"), "deve conter name");
  assert.ok(conteudo.includes("description: quando a tarefa mexe em telas do Kernex Finance em prumo/"), "deve conter description");

  // corpo: remove frontmatter e verifica trechos concretos
  const corpo = conteudo.split("\n---\n").pop();
  assert.ok(corpo.includes("window.MB = Object.assign(window.MB || {}, ...)"), "corpo deve instruir sobre window.MB");
  assert.ok(corpo.includes("conferir o formato que o servidor devolve antes de usar"), "corpo deve instruir sobre formato do servidor");
  assert.ok(corpo.includes("ligar botão só se o elemento existir"), "corpo deve instruir sobre botão");

  // entrada invalida: caminho inexistente deve lancar erro
  assert.throws(() => {
    fs.readFileSync(path.join(__dirname, "../../nexia-ai/skills/nao-existe/SKILL.md"), "utf8");
  });
});