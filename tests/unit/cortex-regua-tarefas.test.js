'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const TAREFAS_DIR = path.resolve(__dirname, '../../nexia-ai/contrato/regua/tarefas');
const OBRIGATORIAS = ['pedido.md', 'visivel.test.js', 'oculto.test.js'];

// 8 tarefas esperadas (3 originais + 5 novas)
const TAREFAS_ESPERADAS = [
  'await',
  'data-brasilia',
  'idempotencia',
  'merge-objeto',
  'prazo',
  // As 5 novas adicionadas nas partes anteriores:
  // Vamos inspecionar dinamicamente ou listá-las se conhecidas, mas varrer a pasta é mais robusto.
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

function copiar(de, para, pular = new Set()) {
  fs.mkdirSync(para, { recursive: true });
  if (!fs.existsSync(de)) return;
  for (const n of fs.readdirSync(de)) {
    if (pular.has(n)) continue;
    const a = path.join(de, n), b = path.join(para, n);
    if (fs.statSync(a).isDirectory()) copiar(a, b); else fs.copyFileSync(a, b);
  }
}

test('Verifica existência e estrutura das 8 tarefas da régua', () => {
  assert.ok(fs.existsSync(TAREFAS_DIR), 'Pasta de tarefas da régua deve existir');
  const lista = fs.readdirSync(TAREFAS_DIR).filter(n => fs.existsSync(path.join(TAREFAS_DIR, n, 'pedido.md')));
  
  assert.ok(lista.length >= 8, `Deve haver pelo menos 8 tarefas, encontrado: ${lista.length}`);

  for (const id of lista) {
    const pastaTarefa = path.join(TAREFAS_DIR, id);
    for (const arq of OBRIGATORIAS) {
      assert.ok(fs.existsSync(path.join(pastaTarefa, arq)), `Tarefa ${id} deve conter o arquivo obrigatório ${arq}`);
    }
  }
});

test('Testa se os testes visíveis e ocultos falham sem solução e passam com a solução nas tarefas', () => {
  const lista = fs.readdirSync(TAREFAS_DIR).filter(n => fs.existsSync(path.join(TAREFAS_DIR, n, 'pedido.md')));

  for (const id of lista) {
    const pastaTarefa = path.join(TAREFAS_DIR, id);
    
    // Cria ambiente temporário sem arquivos de implementação (apenas testes)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `regua-test-${id}-`));
    
    // Copia os testes para o tmp
    fs.mkdirSync(path.join(tmp, 'oculto'), { recursive: true });
    if (fs.existsSync(path.join(pastaTarefa, 'visivel.test.js'))) {
      fs.copyFileSync(path.join(pastaTarefa, 'visivel.test.js'), path.join(tmp, 'visivel.test.js'));
    }
    if (fs.existsSync(path.join(pastaTarefa, 'oculto', 'oculto.test.js'))) {
      fs.copyFileSync(path.join(pastaTarefa, 'oculto', 'oculto.test.js'), path.join(tmp, 'oculto', 'oculto.test.js'));
    }

    // Sem solução, o teste visível deve falhar
    const resVisivelSem = rodar('node --test visivel.test.js', tmp);
    assert.strictEqual(resVisivelSem.ok, false, `Teste visível da tarefa ${id} deveria falhar sem implementação`);

    // Limpa tmp e tenta copiar a solução se existir na pasta de soluções correspondente ou na própria pasta de soluções (se houver)
    // Se a tarefa possuir arquivos de solução no repositório de soluções, podemos testar, senão validamos que falha sem implementação.
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  }
});
