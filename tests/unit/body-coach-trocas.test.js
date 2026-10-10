// Troca de alimento compatível (apps/body-coach/src/lib/trocas.ts) e cardápio sem os alimentos que o aluno tirou.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-trocas-'));
  for (const nome of ['dietPlan', 'trocas']) {
    const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    fs.writeFileSync(path.join(dir, `${nome}.mjs`), out.replace("from './dietPlan'", "from './dietPlan.mjs'"));
  }
  return {
    ...(await import(pathToFileURL(path.join(dir, 'dietPlan.mjs')).href)),
    ...(await import(pathToFileURL(path.join(dir, 'trocas.mjs')).href)),
  };
}

test('troca só por alimento do mesmo grupo, com porção equivalente', async () => {
  const { equivalentes } = await carregar();
  const frango = equivalentes('frango', 150);
  assert.ok(frango.length >= 3);
  for (const a of frango) {
    assert.ok(['patinho', 'alcatra', 'peixe', 'atum', 'sardinha', 'ovo', 'peru', 'tofu'].includes(a.id), a.id);
    assert.ok(a.p >= 24 && a.p <= 72, `${a.nome} ${a.p} g de proteína`);
  }
  const arroz = equivalentes('arroz', 400);
  assert.ok(arroz.every((a) => ['arrozintegral', 'batatadoce', 'batata', 'inhame', 'mandioca', 'macarrao', 'cuscuz'].includes(a.id)));
  const batata = arroz.find((a) => a.id === 'batatadoce');
  assert.ok(batata && batata.qtd % 5 === 0 && batata.qtd > 400, `batata-doce ${batata && batata.porcao}`);
  const ovo = equivalentes('iogurte', 680);
  assert.ok(ovo.every((a) => !['arroz', 'banana'].includes(a.id)));
  const ovos = equivalentes('frango', 150).find((a) => a.id === 'ovo');
  if (ovos) assert.ok(Number.isInteger(ovos.qtd));
});

test('respeita restrições e o que o aluno tirou', async () => {
  const { equivalentes, restricoes, montarCardapio } = await carregar();
  const proibidas = restricoes({ restrictions: 'intolerância à lactose' });
  assert.ok(equivalentes('ovo', 3, { proibidas }).every((a) => !['iogurte', 'queijo', 'whey', 'leite'].includes(a.id)));
  assert.ok(equivalentes('frango', 150, { evitar: ['atum'] }).every((a) => a.id !== 'atum'));
  const metas = { kcal: 2400, proteina: 160, carbo: 260, gordura: 70 };
  for (let dia = 0; dia < 7; dia++) {
    const c = montarCardapio({ meals: 4 }, metas, dia, ['tapioca', 'frango']);
    assert.ok(c.flatMap((r) => r.itens).every((i) => i.id !== 'tapioca' && i.id !== 'frango'));
    assert.ok(c.flatMap((r) => r.itens).every((i) => i.id && i.qtd > 0));
  }
});

test('reconhece itens do plano do nutricionista', async () => {
  const { identificar, quantidadeDoTexto, trocasDoNutri, equivalentes } = await carregar();
  assert.equal(identificar('Filé de frango grelhado').id, 'frango');
  assert.equal(identificar('Pão integral').id, 'paointegral');
  assert.equal(identificar('Arroz integral').id, 'arrozintegral');
  assert.equal(identificar('Ovo').id, 'ovo');
  assert.equal(identificar('Cafeína'), null);
  const pao = identificar('Pão integral');
  assert.equal(quantidadeDoTexto('2 fatia(s) (50g)', pao), 50);
  assert.equal(quantidadeDoTexto('2 Unidade(s) (100g)', identificar('Ovo')), 2);
  assert.equal(quantidadeDoTexto('2 fatias', pao), null);
  assert.ok(equivalentes('paointegral', 50).length > 0);
  const trocas = [{ de: 'Pão integral', por: ['Tapioca - 40g', 'Cuscuz - 100g'] }];
  assert.deepEqual(trocasDoNutri('Pão Integral', trocas), ['Tapioca - 40g', 'Cuscuz - 100g']);
  assert.deepEqual(trocasDoNutri('Arroz', trocas), []);
});

async function carregarTs(nome) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-ts-'));
  const src = fs.readFileSync(path.join(__dirname, `../../apps/body-coach/src/lib/${nome}.ts`), 'utf8');
  fs.writeFileSync(path.join(dir, `${nome}.mjs`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return import(pathToFileURL(path.join(dir, `${nome}.mjs`)).href);
}

test('lembretes das refeições: um evento diário por refeição, água opcional, link do Google Agenda', async () => {
  const { gerarIcsRefeicoes, linkGoogleAgenda } = await carregarTs('lembretes');
  const agora = new Date(2026, 9, 10, 6, 0);
  const ics = gerarIcsRefeicoes([{ nome: 'Café da manhã', hora: '07:30' }, { nome: 'Almoço', hora: '12:30' }], { agora, antecedenciaMin: 10 });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART:20261010T073000/);
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /TRIGGER:-PT10M/);
  const comAgua = gerarIcsRefeicoes([{ nome: 'Almoço', hora: '12:30' }], { agua: true, agora });
  assert.equal((comAgua.match(/BEGIN:VEVENT/g) || []).length, 6);
  const link = new URL(linkGoogleAgenda('Almoço: hora de comer', '12:30', '', agora));
  assert.equal(link.hostname, 'calendar.google.com');
  assert.equal(link.searchParams.get('recur'), 'RRULE:FREQ=DAILY');
  assert.equal(link.searchParams.get('dates'), '20261010T123000/20261010T125000');
});

test('música: aceita só link de app de música e monta a busca de treino', async () => {
  const { linkPlaylist, buscaTreino } = await carregarTs('musica');
  assert.deepEqual(linkPlaylist('olha https://open.spotify.com/playlist/abc?si=1'), { url: 'https://open.spotify.com/playlist/abc?si=1', app: 'spotify' });
  assert.equal(linkPlaylist('https://www.deezer.com/br/playlist/123').app, 'deezer');
  assert.equal(linkPlaylist('https://site-estranho.com/playlist'), null);
  assert.equal(linkPlaylist('javascript:alert(1)'), null);
  assert.equal(buscaTreino('deezer', 'Funk'), 'https://www.deezer.com/br/search/treino%20funk/playlist');
  assert.equal(buscaTreino('spotify', 'Academia'), 'https://open.spotify.com/search/treino%20academia/playlists');
});
