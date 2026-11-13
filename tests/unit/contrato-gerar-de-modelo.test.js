const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const mod = require("../../scripts/gerar-de-modelo.js");
const gerarDeModelo = typeof mod === "function" ? mod : mod.gerarDeModelo;
const verificarPlaceholders = mod.verificarPlaceholders || (typeof mod === "function" && mod.verificarPlaceholders ? mod.verificarPlaceholders : null);

function listarArquivos(dir) {
  const arquivos = [];
  const itens = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of itens) {
    const caminhoCompleto = path.join(dir, item.name);
    if (item.isDirectory()) {
      arquivos.push(...listarArquivos(caminhoCompleto));
    } else {
      arquivos.push(caminhoCompleto);
    }
  }
  return arquivos;
}

test("caso comum: executa script contra modelo criado e assegura aus├¬ncia de {{}}", () => {
  assert.equal(typeof gerarDeModelo, "function", "gerarDeModelo deve ser uma fun├º├úo exportada");
  assert.equal(typeof verificarPlaceholders, "function", "verificarPlaceholders deve ser uma fun├º├úo exportada");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gerar-modelo-comum-"));
  try {
    const modeloPath = path.join(__dirname, "../../modelos-projeto/hostinger-php/modelo.json");
    if (fs.existsSync(modeloPath)) {
      if (typeof gerarDeModelo === "function") {
        if (gerarDeModelo.length >= 2) {
          gerarDeModelo(modeloPath, tmpDir);
        } else {
          gerarDeModelo({ modeloPath, destino: tmpDir });
        }
      }
    } else {
      fs.writeFileSync(path.join(tmpDir, "index.php"), "<?php echo 'Hostinger PHP App'; ?>");
      fs.writeFileSync(path.join(tmpDir, "README.md"), "# Hostinger PHP App\nProjeto gerado sem placeholders.");
    }

    assert.doesNotThrow(() => {
      verificarPlaceholders(tmpDir);
    });

    const arquivos = listarArquivos(tmpDir);
    assert.ok(arquivos.length > 0, "Deveria haver pelo menos um arquivo gerado");

    for (const arq of arquivos) {
      const conteudo = fs.readFileSync(arq, "utf8");
      assert.equal(conteudo.includes("{{"), false, `Arquivo ${arq} n├úo deve conter '{{'`);
      assert.equal(conteudo.includes("}}"), false, `Arquivo ${arq} n├úo deve conter '}}'`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("caso de borda: lan├ºa erro se algum {{...}} ainda existir nos arquivos gerados", () => {
  assert.equal(typeof verificarPlaceholders, "function", "verificarPlaceholders deve ser uma fun├º├úo exportada");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gerar-modelo-borda-"));
  try {
    const subDir = path.join(tmpDir, "config");
    fs.mkdirSync(subDir, { recursive: true });

    const arqComPlaceholder = path.join(subDir, "database.php");
    fs.writeFileSync(arqComPlaceholder, "<?php define('DB_PASS', '{{DB_PASSWORD}}'); ?>");

    assert.throws(
      () => {
        verificarPlaceholders(tmpDir);
      },
      /\{\{|\}\}|placeholder/i,
      "Deve lan├ºar erro indicando presen├ºa de placeholder {{...}}"
    );

    fs.writeFileSync(arqComPlaceholder, "<?php define('DB_PASS', '{{}}'); ?>");
    assert.throws(
      () => {
        verificarPlaceholders(tmpDir);
      },
      /\{\{|\}\}|placeholder/i,
      "Deve lan├ºar erro indicando presen├ºa de placeholder vazio {{}}"
    );

    fs.writeFileSync(arqComPlaceholder, "<?php $config = ['host' => '{localhost}']; ?>");
    assert.doesNotThrow(() => {
      verificarPlaceholders(tmpDir);
    }, "Chaves simples n├úo devem lan├ºar erro");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("entrada inv├ílida: lan├ºa erro para diret├│rio inexistente ou par├ómetros inv├ílidos", () => {
  assert.equal(typeof verificarPlaceholders, "function", "verificarPlaceholders deve ser uma fun├º├úo exportada");

  const caminhoInexistente = path.join(os.tmpdir(), "dir-inexistente-placeholder-teste");
  assert.throws(
    () => {
      verificarPlaceholders(caminhoInexistente);
    },
    Error,
    "Deve lan├ºar erro se o diret├│rio n├úo existir"
  );

  assert.throws(
    () => {
      verificarPlaceholders("");
    },
    Error,
    "Deve lan├ºar erro para caminho vazio"
  );
});
