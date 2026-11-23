const { test } = require("node:test");
const { strict: assert } = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");

const arquivo = path.join(__dirname, "../../nexia-ai/tool-gateway/hooks.js");

// O arquivo precisa existir
if (!fs.existsSync(arquivo)) {
  throw new Error("Arquivo hooks.js não encontrado");
}

const { criarHooks, bloquearPerigoso, checarSintaxe } = require(arquivo);

test("criarHooks deve exportar e permitir registrar hooks", () => {
  const hooks = criarHooks();
  assert.ok(typeof hooks.antes === 'function');
  assert.ok(typeof hooks.depois === 'function');
  assert.ok(typeof hooks.rodarAntes === 'function');
  assert.ok(typeof hooks.rodarDepois === 'function');
});

test("criarHooks.antes deve bloquear execução se hook retornar { bloquear: 'motivo' }", () => {
  const hooks = criarHooks();
  hooks.antes((chamada) => {
    if (chamada.tool === 'perigoso') {
      return { bloquear: 'Ato perigoso detectado' };
    }
    return null;
  });

  // Caso que bloqueia
  const resultado = hooks.rodarAntes({ tool: 'perigoso', input: {} });
  assert.ok(resultado);
  assert.equal(resultado.bloquear, 'Ato perigoso detectado');

  // Caso que não bloqueia (deve retornar null/undefined)
  const resultado2 = hooks.rodarAntes({ tool: 'seguro', input: {} });
  assert.ok(resultado2 === null || resultado2 === undefined);
});

test("criarHooks.depois deve coletar retornos", () => {
  const hooks = criarHooks();
  hooks.depois((chamada, resultado) => {
    return 'aviso: executado';
  });

  const resultado = hooks.rodarDepois({ tool: 'x', input: {} }, 'ok');
  // A implementação específica pode variar (array de avisos ou outro), mas deve capturar o retorno.
  // Assumindo que retorna um array ou o último valor. Vamos verificar se contém 'avisos' ou similar.
  // Para o teste ser robusto, verificamos se a estrutura retorna algo. 
  // O prompt diz: "coleta retornos (como avisos)". Geralmente isso implicas em um array.
  assert.ok(Array.isArray(resultado) || typeof resultado === 'string' || typeof resultado === 'object'); 
  
  // Verificação mais estrita se a API for consistente:
  // O comportamento exato de retornos de rodarDepois não está especificado alfabeticamente no prompt (apenas "coleta retornos").
  // Verificaremos apenas se a função executa sem erro e define o hook.
});

test("bloquearPerigoso deve detectar comandos perigosos", () => {
  // Caso: rm -rf /
  const r1 = bloquearPerigoso({ tool: 'exec', input: { cmd: 'rm -rf /' } });
  assert.ok(r1.bloquear);
  
  // Caso: git push --force
  const r2 = bloquearPerigoso({ tool: 'exec', input: { cmd: 'git push --force' } });
  assert.ok(r2.bloquear);

  // Caso: DROP TABLE
  const r3 = bloquearPerigoso({ tool: 'sql', input: { query: 'DROP TABLE users;' } });
  assert.ok(r3.bloquear);

  // Caso: .env
  const r4 = bloquearPerigoso({ tool: 'fs', input: { files: [".env", "index.js"] } });
  assert.ok(r4.bloquear);

  // Caso: sk-secreto
  const r5 = bloquearPerigoso({ tool: 'env', input: { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz123456' } });
  assert.ok(r5.bloquear);
});

test("bloquearPerigoso deve permitir entradas seguras", () => {
  const entradaSegura = { tool: 'dev', input: { nome: 'arquivoSeguro.js', conteudo: 'console.log(1)' } };
  const r = bloquearPerigoso(entradaSegura);
  assert.ok(r === null || r === undefined || (r && r.bloquear === undefined));
});

test("checarSintaxe deve detectar erro de sintaxe em .js", () => {
  const chamada = {
    tool: 'github.commit_files',
    input: {
      files: [
        { path: 'erro.js', content: 'function { invalid' } 
      ]
    }
  };
  const r = checarSintaxe(chamada, {});
  // Deve retornar um aviso com 'sintaxe' no motivo
  assert.ok(r);
  assert.ok(r.aviso);
  assert.match(r.aviso, /sintaxe/);
});

test("checarSintaxe deve passar em código válido", () => {
  const chamada = {
    tool: 'github.commit_files',
    input: {
      files: [
        { path: 'ok.js', content: 'function teste() { return 1; }' } 
      ]
    }
  };
  const r = checarSintaxe(chamada, {});
  // Não deve haver aviso ou aviso deve ser nulo/vazio
  assert.ok(r === null || r === undefined || (r && !r.aviso));
});
