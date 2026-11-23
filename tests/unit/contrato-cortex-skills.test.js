const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { listar, catalogo, escolher, carregar } = require("../../nexia-ai/skills/index.js");

test("cortex skills - catalogo", () => {
  // Caso comum
  const lista = [
    { nome: "A", descricao: "B" },
    { nome: "tela-finance", descricao: "telas do finance" }
  ];
  const cat = catalogo(lista);
  assert.equal(cat, "SKILLS DISPONÍVEIS:\n- A: B\n- tela-finance: telas do finance");
  // O catalogo nao contem o corpo
  assert.equal(cat.includes("corpo"), false);

  // Caso de borda: lista vazia
  assert.equal(catalogo([]), "SKILLS DISPONÍVEIS:");

  // Entrada inválida: null ou indefinido
  assert.equal(catalogo(null), "SKILLS DISPONÍVEIS:");
  assert.equal(catalogo(undefined), "SKILLS DISPONÍVEIS:");
});

test("cortex skills - escolher", () => {
  const skills = [
    {
      nome: "tela-finance",
      descricao: "quando a tarefa mexe em telas do Kernex Finance em prumo/"
    },
    {
      nome: "job-agendado",
      descricao: "quando a tarefa cria ou muda cron, robô, fila ou varredura"
    }
  ];

  // Caso comum: "criar cron que atualiza o estado" escolhe job-agendado e não tela-finance
  const escolhidas = escolher("criar cron que atualiza o estado", skills);
  assert.equal(escolhidas.length, 1);
  assert.equal(escolhidas[0].nome, "job-agendado");

  // Prioriza mais palavras em comum
  const skillPouca = { nome: "pouca", descricao: "tarefa apenas" };
  const skillMuita = { nome: "muita", descricao: "tarefa cria muda cron" };
  const ordenadas = escolher("tarefa cria cron", [skillPouca, skillMuita], 2);
  assert.equal(ordenadas.length, 2);
  assert.equal(ordenadas[0].nome, "muita");
  assert.equal(ordenadas[1].nome, "pouca");

  // Caso de borda: respeita max
  const limitadas = escolher("tarefa cria cron", [skillPouca, skillMuita], 1);
  assert.equal(limitadas.length, 1);
  assert.equal(limitadas[0].nome, "muita");

  // Entrada inválida: pedido vazio ou sem correspondência
  assert.deepEqual(escolher("", skills), []);
  assert.deepEqual(escolher("xyz abc", skills), []);
  assert.deepEqual(escolher(null, skills), []);
  assert.deepEqual(escolher("cron", null), []);
});

test("cortex skills - carregar", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-skills-carregar-"));
  const skillDir = path.join(tmpDir, "minha-skill");
  fs.mkdirSync(skillDir, { recursive: true });

  const corpoEsperado = "Linha 1 do corpo\nLinha 2 do corpo";
  const conteudoComFm = `---\nname: minha-skill\ndescription: descricao da skill\n---\n${corpoEsperado}`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), conteudoComFm, "utf8");

  // Caso comum: carregar devolve o corpo sem frontmatter
  const corpo = carregar("minha-skill", tmpDir);
  assert.equal(corpo, corpoEsperado);

  // Caso de borda: corte em 6000 caracteres
  const skillLongaDir = path.join(tmpDir, "skill-longa");
  fs.mkdirSync(skillLongaDir, { recursive: true });
  const corpoLongo = "a".repeat(7000);
  fs.writeFileSync(path.join(skillLongaDir, "SKILL.md"), `---\nname: skill-longa\ndescription: d\n---\n${corpoLongo}`, "utf8");
  const corpoCarregadoLongo = carregar("skill-longa", tmpDir);
  assert.equal(corpoCarregadoLongo.length, 6000);
  assert.equal(corpoCarregadoLongo, "a".repeat(6000));

  // Entrada inválida: skill inexistente
  assert.equal(carregar("inexistente", tmpDir), "");
  assert.equal(carregar(null, tmpDir), "");
});

test("cortex skills - listar", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-skills-listar-"));

  const dirB = path.join(tmpDir, "b-skill");
  const dirA = path.join(tmpDir, "a-skill");
  fs.mkdirSync(dirB, { recursive: true });
  fs.mkdirSync(dirA, { recursive: true });

  fs.writeFileSync(
    path.join(dirB, "SKILL.md"),
    "---\nname: b-skill\ndescription: desc B\n---\nCorpo B",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dirA, "SKILL.md"),
    "---\nname: a-skill\ndescription: desc A\n---\nCorpo A",
    "utf8"
  );

  // Pasta com SKILL.md quebrado (sem frontmatter)
  const dirQuebrado = path.join(tmpDir, "quebrada");
  fs.mkdirSync(dirQuebrado, { recursive: true });
  fs.writeFileSync(path.join(dirQuebrado, "SKILL.md"), "Apenas texto sem frontmatter", "utf8");

  // Pasta vazia
  const dirVazio = path.join(tmpDir, "vazia");
  fs.mkdirSync(dirVazio, { recursive: true });

  // Caso comum e borda: ignora quebrados e devolve ordenado por nome
  const lista = listar(tmpDir);
  assert.equal(lista.length, 2);
  assert.deepEqual(lista, [
    { nome: "a-skill", descricao: "desc A" },
    { nome: "b-skill", descricao: "desc B" }
  ]);

  // Entrada inválida: pasta inexistente devolve [] sem erro
  const listaInvalida = listar(path.join(tmpDir, "caminho-inexistente"));
  assert.deepEqual(listaInvalida, []);
});
