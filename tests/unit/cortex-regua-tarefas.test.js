'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const PASTA_TAREFAS = path.resolve(__dirname, '../../nexia-ai/contrato/regua/tarefas');
const PASTA_SOLUCOES = path.resolve(__dirname, '../../nexia-ai/contrato/regua/solucoes');

function rodar(cmd, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  try {
    const s = execFileSync(process.execPath, cmd.split(' ').slice(1), {
      cwd,
      stdio: 'pipe',
      timeout: 60000,
      env,
      encoding: 'utf8',
    });
    return { ok: true, saida: s };
  } catch (e) {
    const s = String(e.stdout || '') + String(e.stderr || '');
    return { ok: false, saida: s };
  }
}

test('Verifica estrutura de arquivos das tarefas da régua do Cortex', () => {
  assert.ok(fs.existsSync(PASTA_TAREFAS), 'Diretório de tarefas da régua deve existir');
  const tarefas = fs.readdirNames ? fs.readdirSync(PASTA_TAREFAS) : fs.readdirSync(PASTA_TAREFAS);
  const validas = tarefas.filter((n) => {
    const p = path.join(PASTA_TAREFAS, n);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'pedido.md'));
  });

  assert.ok(validas.length >= 5, 'Deve haver pelo menos 5 tarefas na régua');

  for (const id of validas) {
    const dir = path.join(PASTA_TAREFAS, id);
    assert.ok(fs.existsSync(path.join(dir, 'pedido.md')), `Tarefa ${id} deve ter pedido.md`);
    
    // Procura arquivos visíveis de teste
    const arquivos = fs.readdirSync(dir);
    const temVisivel = arquivos.some((f) => f.endsWith('.test.js') && f !== 'oculto');
    assert.ok(temVisivel, `Tarefa ${id} deve ter pelo menos um arquivo de teste visível (*.test.js)`);

    const ocultoDir = path.join(dir, 'oculto');
    if (fs.existsSync(ocultoDir)) {
      const ocultos = fs.readdirSync(ocultoDir).filter((f) => f.endsWith('.test.js'));
      assert.ok(ocultos.length > 0, `Tarefa ${id} com diretório oculto deve ter pelo menos um teste oculto`);
    }
  }
});

test('Testa execução sem e com solução para as tarefas da régua', () => {
  if (!fs.existsSync(PASTA_TAREFAS)) return;
  const tarefas = fs.readdirSync(PASTA_TAREFAS).filter((n) => {
    const p = path.join(PASTA_TAREFAS, n);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'pedido.md'));
  });

  for (const id of tarefas) {
    const dirTarefa = path.join(PASTA_TAREFAS, id);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `regua-unit-${id}-`));

    // Copia arquivos iniciais (exceto oculto e pedido.md)
    for (const n of fs.readdirSync(dirTarefa)) {
      if (n === 'oculto' || n === 'pedido.md') continue;
      const a = path.join(dirTarefa, n), b = path.join(tmp, n);
      if (fs.statSync(a).isDirectory()) {
        fs.mkdirSync(b, { recursive: true });
        // Cópia simples recursiva se necessário
        const copiarDir = (src, dest) => {
          fs.mkdirSync(dest, { recursive: true });
          for (const item of fs.readdirSync(src)) {
            const sPath = path.join(src, item);
            const dPath = path.join(dest, item);
            if (fs.statSync(sPath).isDirectory()) copiarDir(sPath, dPath);
            else fs.copyFileSync(sPath, dPath);
          }
        };
        copiarDir(a, b);
      } else {
        fs.copyFileSync(a, b);
      }
    }

    const arquivosTeste = fs.readdirSync(dirTarefa).filter((f) => f.endsWith('.test.js'));
    if (arquivosTeste.length === 0) continue;

    const cmdTeste = `node --test ${arquivosTeste.join(' ')}`;
    
    // Sem solução, o teste visível deve falhar (ou pelo menos rodar)
    const resSemSolucao = rodar(cmdTeste, tmp);
    
    // Aplica solução se existir em nexia-ai/contrato/regua/solucoes/<id>/ ou similar
    const solucaoDir = path.join(PASTA_SOLUCOES, id);
    if (fs.existsSync(solucaoDir)) {
      for (const n of fs.readdirSync(solucaoDir)) {
        const dest = path.join(tmp, n.split('__').join('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(solucaoDir, n), dest);
      }
      const resComSolucao = rodar(cmdTeste, tmp);
      assert.strictEqual(resComSolucao.ok, true, `Com solução, os testes visíveis da tarefa ${id} devem passar`);
    }
  }
});
