// Plano alimentar do nutricionista (apps/body-coach/src/lib/planoAlimentar.ts): leitura do PDF já
// quebrado em pedaços de texto com posição, como o pdf.js entrega. Dados fictícios.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-plano-'));
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/planoAlimentar.ts'), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(dir, 'plano.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'plano.mjs')).href);
}

// Cada linha: [y, [x, texto], [x, texto], ...]
const pagina = (linhas) => ({ largura: 595, itens: linhas.flatMap(([y, ...cs]) => cs.map(([x, str]) => ({ str, x, y }))) });

test('lê refeições, quantidades, trocas, observações, nutrientes e extras', async () => {
  const { lerPlano, metasDoPlano } = await carregar();
  const p = lerPlano([
    pagina([[133, [246, 'Todos os dias']], [206, [200, '07:00 - Café da manhã']], [242, [47, 'Pão integral'], [283, '2 fatia(s) (50g)']], [261, [47, 'Ovo'], [283, '2 Unidade(s) (100g)']],
      [313, [43, '• Opcões de substituição para Pão integral:']], [337, [43, 'Tapioca - 40g'], [182, '- ou -'], [211, 'Cuscuz - 100g'], [380, '- ou -']], [349, [43, 'Pão francês -']], [361, [43, '1 unidade (50g)']],
      [400, [43, 'Observações:']], [420, [43, 'Café sem açúcar']],
      [500, [230, 'Horário do treino']], [530, [47, 'Cafeína'], [269, '1 Cápsula(s)']]]),
    pagina([[100, [220, '12:30 - Almoço']], [130, [47, 'Arroz'], [283, '150g']]]),
    pagina([[100, [250, 'Suplementação']], [130, [43, '•Creatina - 5g']]]),
    pagina([[90, [220, 'Relatório de nutrientes']], [120, [43, 'Refeição'], [200, 'Proteínas'], [300, 'Lipídeos'], [380, 'Carboidratos'], [460, 'Calorias']],
      [140, [43, 'Café da manhã'], [200, '20.0g'], [300, '12.0g'], [380, '30.0g'], [460, '310 Kcal']],
      [160, [43, 'Horário do treino'], [200, '0.0g'], [300, '0.0g'], [380, '0.0g'], [460, '0 Kcal']],
      [180, [43, 'Almoço'], [200, '5.0g'], [300, '0.5g'], [380, '40.0g'], [460, '190 Kcal']],
      [200, [43, 'Total das refeições'], [200, '25.0g'], [300, '12.5g'], [380, '70.0g'], [460, '500 Kcal']]]),
    pagina([[100, [220, 'Lista de compras']], [130, [43, 'Arroz']]]),
  ], 'plano.pdf', '2026-10-10T00:00:00Z');

  assert.deepEqual(p.refeicoes.map((r) => [r.horario, r.nome, r.itens.length]), [['07:00', 'Café da manhã', 2], [null, 'Horário do treino', 1], ['12:30', 'Almoço', 1]]);
  assert.deepEqual(p.refeicoes[0].itens[0], { nome: 'Pão integral', qtd: '2 fatia(s) (50g)' });
  assert.deepEqual(p.refeicoes[0].trocas, [{ de: 'Pão integral', por: ['Tapioca - 40g', 'Cuscuz - 100g', 'Pão francês - 1 unidade (50g)'] }]);
  assert.deepEqual(p.refeicoes[0].obs, ['Café sem açúcar']);
  assert.deepEqual(p.refeicoes[2].macros, { proteina: 5, gordura: 0.5, carbo: 40, kcal: 190 });
  assert.deepEqual(p.totais, { proteina: 25, gordura: 12.5, carbo: 70, kcal: 500 });
  assert.deepEqual(p.extras, [{ titulo: 'Suplementação', texto: ['•Creatina - 5g'] }]);
  assert.deepEqual(metasDoPlano(p), { calories: 500, protein: 25, carbs: 70, fat: 13 });
  assert.equal(metasDoPlano(null), null);
});
