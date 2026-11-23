'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { lerContrato } = require('../../nexia-ai/contrato/executor');

const TAREFAS_DIR = path.resolve(__dirname, '..', '..', 'nexia-ai', 'contrato', 'regua', 'tarefas');

const OBRIGATORIAS = ['pedido.md', 'visivel.test.js', 'oculto.test.js'];

// Esperadas 8 tarefas (3 originais + 5 novas)
const TAREFAS_ESPERADAS = [
  'await',
  'data-brasilia',
  'idempotencia',
  'merge-objeto',
  'prazo'
  // se houver mais na pasta, vamos listar dinamicamente ou fixar as conhecidas
];

function rodar(cmd, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  try {
    const s = execFileSync(process.execPath, cmd.split(' ').slice(1), { cwd, stdio: 'pipe', timeout: 60000, env, encoding: 'utf8' });
    return { ok: true, saida: s };
  } catch (e) {
    const s = String(e.stdout || '') + String(e.stderr || '');
    return { ok: false, saida: s };
  }
}

test('Verificar existência dos 3 arquivos obrigatórios em todas as tarefas da régua', () => {
  assert.ok(fs.existsSync(TAREFAS_DIR), 'Diretório de tarefas da régua deve existir');
  const tarefas = fs.readdirNames ? fs.readdirSync(TAREFAS_DIR) : fs.readdirSync(TAREFAS_DIR).filter(n => {
    return fs.statSync(path.join(TAREFAS_DIR, n)).isDirectory();
  });

  assert.ok(tarefas.length >= 5, 'Deve haver pelo menos 5 tarefas na régua');

  for (const t of tarefas) {
    const tarefaPath = path.join(TAREFAS_DIR, t);
    if (!fs.statSync(tarefaPath).isDirectory()) continue;
    
    for (const arq of OBRIGATORIAS) {
      const filePath = path.join(tarefaPath, arq);
      assert.ok(fs.existsSync(filePath), `Tarefa ${t} deve conter o arquivo obrigatório ${arq}`);
    }
  }
});

test('Validar contrato e comportamento sem/com solução para as tarefas', () => {
  const tarefas = fs.readdirSync(TAREFAS_DIR).filter(n => {
    return fs.statSync(path.join(TAREFAS_DIR, n)).isDirectory() && fs.existsSync(path.join(TAREFAS_DIR, n, 'pedido.md'));
  });

  for (const id of tarefas) {
    const tarefaPath = path.join(TAREFAS_DIR, id);
    const pedidoCont = fs.readFileSync(path.join(tarefaPath, 'pedido.md'), 'utf8');
    const contrato = lerContrato(pedidoCont);
    assert.ok(contrato, `Contrato da tarefa ${id} deve ser válido`);

    // Prepara ambiente temporário vazio
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(require('node:os').tmpdir()), `regua-test-${id}-`));
    
    // Copia arquivos iniciais (excluindo oculto e pedido.md se existirem na raiz)
    for (const n of fs.readdirSync(tarefaPath)) {
      if (n === 'oculto' || n === 'pedido.md' || n === 'solucao') continue;
      const a = path.join(tarefaPath, n);
      const b = path.join(tmp, n);
      if (fs.statSync(a).isDirectory()) {
        // copiar diretório se houver
      } else {
        fs.copyFileSync(a, b);
      }
    }

    // 1. Sem implementação, o teste visível deve falhar (se há contrato estrito)
    const resSemSolucao = rodar(contrato.teste, tmp);
    // Nota: dependendo da tarefa, sem solução o visível falha.
    assert.strictEqual(resSemSolucao.ok, false, `Tarefa ${id} não deve passar no teste visível sem solução`);

    // 2. Aplicar solução se existir pasta solucao ou arquivos de solução correspondentes
    const solucaoDir = path.join(tarefaPath, 'solucao');
    const solucaoAltDir = path.join(TAREFAS_DIR, '..', 'solucoes', id); // se houver
    let achouSolucao = false;

    const aplicarNaPasta = (dirOrigem) => {
      if (!fs.existsSync(dirOrigem)) return;
      achouSolucao = true;
      for (const n of fs.readdirSync(dirOrigem)) {
        const a = path.join(dirOrigem, n);
        const dest = path.join(tmp, n.split('__').join('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (fs.statSync(a).isDirectory()) {
          // recursivo simples se necessário
        } else {
          fs.copyFileSync(a, dest);
        }
      }
    };

    aplicarNaPasta(solucaoDir);
    aplicarNaPasta(solucaoAltDir);

    if (achouSolucao) {
      const resVisivelCom = rodar(contrato.teste, tmp);
      assert.strictEqual(resVisivelCom.ok, true, `Tarefa ${id} deve passar no teste visível com a solução`);

      // Testar oculto se existir
      const ocultoDir = path.join(tarefaPath, 'oculto');
      if (fs.existsSync(ocultoDir)) {
        const ocultoTmp = path.join(tmp, 'oculto');
        fs.mkdirSync(ocultoTmp, { recursive: true });
        for (const n of fs.readdirSync(ocultoDir)) {
          fs.copyFileSync(path.join(ocultoDir, n), path.join(ocultoTmp, n));
        }
        const testesOcultos = fs.readdirSync(ocultoDir).filter(n => n.endsWith('.test.js')).map(n => `oculto/${n}`);
        if (testesOcultos.length > 0) {
          const resOculto = rodar(`node --test ${testesOcultos.join(' ')}`, tmp);
          assert.strictEqual(resOculto.ok, true, `Tarefa ${id} deve passar nos testes ocultos com a solução`);
        }
      }
    }
  }
});
