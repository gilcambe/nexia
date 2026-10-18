'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { arquivosDiretos, processarDiretos } = require('../../scripts/cortex-literal-direto.js');

const corpo = (caminho, code, extra = '') => `Copie EXATAMENTE. Só 1 arquivo novo: \`${caminho}\` com este conteúdo:\n\n\`\`\`js\n${code}\n\`\`\`\n${extra}`;
const issue = (n, body, labels = ['cortex-fila']) => ({ number: n, body, labels: labels.map(name => ({ name })) });

function ambiente(arquivos = {}) {
  const log = [];
  return {
    log,
    deps: {
      abertosPRs: [],
      lerArquivo: async p => (arquivos[p] === undefined ? null : { sha: 's1', content: arquivos[p] }),
      gravar: async (ramo, arqs) => log.push(['gravar', ramo, arqs.map(a => a.path)]),
      abrirPR: async () => { log.push(['pr']); return 9; },
      concluir: async n => log.push(['concluir', n]),
      comentar: async n => log.push(['comentar', n]),
    },
  };
}

test('DIR1. só cópia 100% literal e fora de .github vai direto', () => {
  assert.strictEqual(arquivosDiretos(issue(1, corpo('a/b.js', 'x'))).length, 1);
  assert.strictEqual(arquivosDiretos(issue(2, corpo('.github/workflows/x.yml', 'x'))).length, 0);
  assert.strictEqual(arquivosDiretos(issue(3, corpo('a/b.js', 'x', 'E troque uma linha em src/router.tsx'))).length, 0);
  assert.strictEqual(arquivosDiretos(issue(4, 'Crie um botão bonito')).length, 0);
});

test('DIR2. arquivo novo vira ramo + PR e a tarefa não é despachada', async () => {
  const { log, deps } = ambiente();
  const tratados = await processarDiretos({ issues: [issue(5, corpo('a/b.js', 'x'))], ...deps });
  assert.ok(tratados.has(5));
  assert.deepStrictEqual(log.map(l => l[0]), ['gravar', 'pr', 'comentar']);
});

test('DIR3. arquivo já idêntico na develop conclui a tarefa, sem PR novo', async () => {
  const { log, deps } = ambiente({ 'a/b.js': 'x\n' });
  await processarDiretos({ issues: [issue(6, corpo('a/b.js', 'x'))], ...deps });
  assert.deepStrictEqual(log, [['concluir', 6]]);
});

test('DIR4. PR direto já aberto não repete', async () => {
  const { log, deps } = ambiente();
  deps.abertosPRs = [{ head: { ref: 'nexia/direto-7-abc' } }];
  await processarDiretos({ issues: [issue(7, corpo('a/b.js', 'x'))], ...deps });
  assert.deepStrictEqual(log, []);
});
