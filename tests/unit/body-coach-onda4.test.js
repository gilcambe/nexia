// Onda 4: dieta do nutricionista por IA (PDF/foto/texto), receitas prontas, bebida e ferramentas ligadas.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const LIB = path.join(__dirname, '../../apps/body-coach/src/lib');
async function carregar(nomes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onda4-'));
  for (const f of nomes) {
    const src = fs.readFileSync(path.join(LIB, `${f}.ts`), 'utf8').replace(/from '\.\/([a-zA-Z]+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, `${f}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  return import(pathToFileURL(path.join(dir, `${nomes[nomes.length - 1]}.mjs`)).href);
}

const RESPOSTA = `Aqui está: {"refeicoes":[
 {"horario":"12h","nome":"Almoço","itens":[{"nome":"Arroz branco","qtd":"100 g"},{"nome":"Peito de frango grelhado","qtd":"120 g"}],"trocas":[{"de":"Arroz branco","por":["Batata doce 150 g"]}],"obs":"Salada à vontade"},
 {"horario":"07:30","nome":"Café da manhã","itens":[{"nome":"Ovo","qtd":"2 unidades"},{"nome":"Pão integral","qtd":"2 fatias (50 g)"}]},
 {"nome":"Vazia","itens":[]}
],"totais":{"kcal":0},"orientacoes":["Beber 3 L de água"]}`;

test('dieta lida pela IA vira plano: ordena por horário, trocas, obs e orientações', async () => {
  const { planoDoJson } = await carregar(['dietPlan', 'trocas', 'dietaDoJson']);
  const p = planoDoJson(RESPOSTA, 'Dieta da Ana', '2026-11-24T00:00:00.000Z');
  assert.ok(p);
  assert.equal(p.refeicoes.length, 2);
  assert.equal(p.refeicoes[0].nome, 'Café da manhã');
  assert.equal(p.refeicoes[0].horario, '07:30');
  assert.equal(p.refeicoes[1].horario, '12:00');
  assert.deepEqual(p.refeicoes[1].trocas, [{ de: 'Arroz branco', por: ['Batata doce 150 g'] }]);
  assert.deepEqual(p.refeicoes[1].obs, ['Salada à vontade']);
  assert.equal(p.extras[0].texto[0], 'Beber 3 L de água');
  assert.equal(p.arquivo, 'Dieta da Ana');
});

test('calorias calculadas pela tabela quando o nutricionista não escreveu', async () => {
  const { planoDoJson } = await carregar(['dietPlan', 'trocas', 'dietaDoJson']);
  const p = planoDoJson(RESPOSTA);
  const almoco = p.refeicoes.find((r) => r.nome === 'Almoço');
  assert.ok(almoco.macros && almoco.macros.kcal > 250 && almoco.macros.proteina > 30, JSON.stringify(almoco.macros));
  assert.equal(planoDoJson('não achei nada'), null);
  assert.equal(planoDoJson('{"refeicoes":[]}'), null);
});

test('receitas: todas com macros coerentes e ordenadas pelo que falta', async () => {
  const { RECEITAS, receitasParaHoje } = await carregar(['receitas']);
  assert.ok(RECEITAS.length >= 15);
  for (const r of RECEITAS) {
    const calc = r.p * 4 + r.c * 4 + r.g * 9;
    assert.ok(Math.abs(calc - r.kcal) / r.kcal < 0.2, `${r.id}: ${calc} x ${r.kcal}`);
    assert.ok(r.ingredientes.length && r.preparo.length, r.id);
  }
  const ord = receitasParaHoje(RECEITAS, 400, 60);
  assert.ok(ord[0].p / ord[0].kcal > 0.08);
});

test('bebida: soma doses e plano sem jejum', async () => {
  const { somar, planoParaCaber } = await carregar(['bebida']);
  const r = somar([{ id: 'cerveja-lata', qtd: 4 }, { id: 'caipirinha', qtd: 1 }, { id: 'nao-existe', qtd: 3 }]);
  assert.equal(r.doses, 5);
  assert.equal(r.kcal, 890);
  const p = planoParaCaber(r).join(' ');
  assert.match(p, /890 kcal/);
  assert.match(p, /água/);
  assert.doesNotMatch(p, /jejum/);
  assert.deepEqual(planoParaCaber(somar([])), []);
});

test('nutrição: importar por PDF/foto/texto e as 4 ferramentas novas ligadas', () => {
  const app = path.join(__dirname, '../../apps/body-coach/src/pages/nutrition');
  const plano = fs.readFileSync(path.join(app, 'components/PlanoNutricionista.tsx'), 'utf8');
  assert.match(plano, /'dieta'\)/);
  assert.match(plano, /data-testid="colar-dieta"/);
  const pag = fs.readFileSync(path.join(app, 'page.tsx'), 'utf8');
  for (const id of ['receitas', 'trocar', 'fora', 'bebida']) assert.match(pag, new RegExp(`ferramenta === '${id}'`));
  const ia = fs.readFileSync(path.join(__dirname, '../../netlify/functions/body-coach-ai.js'), 'utf8');
  assert.match(ia, /const DIETA = /);
});
