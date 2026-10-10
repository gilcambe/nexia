// Avaliação física do Body Coach: cálculos e importação de arquivos (apps/body-coach/src/lib/avaliacao).
// Os módulos são TypeScript: o teste transpila com o typescript da raiz para uma pasta temporária.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const SRC = path.join(__dirname, '../../apps/body-coach/src/lib/avaliacao');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-aval-'));
  for (const f of ['campos.ts', 'calculos.ts', 'importar.ts']) {
    const out = ts.transpileModule(fs.readFileSync(path.join(SRC, f), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from '\.\/(\w+)\.ts'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, f.replace(/\.ts$/, '.mjs')), out);
  }
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href);
  return { campos: await imp('campos.mjs'), calc: await imp('calculos.mjs'), imp: await imp('importar.mjs') };
}

const mods = carregar();

test('7 dobras (Jackson & Pollock + Brozek) batem com um laudo real', async () => {
  const { calc } = await mods;
  const av = {
    data: '2026-09-12', sexo: 'M',
    valores: { peso: 84.7, altura: 168, idade: 40, tricipital: 6, abdominal: 5, subescapular: 10, axilar_media: 3, coxa: 13, peitoral: 2, suprailiaca: 3, cintura: 78, quadril: 106, braco_relaxado: 36 },
  };
  const r = calc.calcular(av);
  assert.equal(r.protocolo, 'jp7');
  assert.equal(r.somaDobras, 42);
  assert.equal(r.densidade, 1.083);
  assert.equal(r.gordura, 7.7);
  assert.equal(r.gorduraClasse, 'Baixa');
  assert.equal(r.massaGorda, 6.5);
  assert.equal(r.mlg, 78.2);
  assert.equal(r.massaResidual, 20.4);
  assert.equal(r.imc, 30);
  assert.equal(r.imcClasse, 'Obesidade grau 1');
  assert.equal(r.rcq, 0.74);
  assert.equal(r.rcqRisco, 'Baixo');
  assert.equal(r.cmb, 34.1);
  assert.equal(r.cmbClasse, 'Adequado');
});

test('outra data do mesmo laudo: 63 mm → 10,8% Excelente', async () => {
  const { calc } = await mods;
  const r = calc.calcular({ data: '2026-01-10', sexo: 'M', valores: { peso: 85.4, altura: 168, idade: 40, tricipital: 7, abdominal: 12, subescapular: 13, axilar_media: 7, coxa: 15, peitoral: 3, suprailiaca: 6 } });
  assert.equal(r.somaDobras, 63);
  assert.equal(r.densidade, 1.075);
  assert.equal(r.gordura, 10.8);
  assert.equal(r.gorduraClasse, 'Excelente');
});

test('rótulos vão para o campo certo', async () => {
  const { campos } = await mods;
  const k = (t, s) => campos.campoDoRotulo(t, s)?.key ?? null;
  assert.equal(k('Peso atual (Kg)'), 'peso');
  assert.equal(k('Dobra da Coxa (mm)'), 'coxa');
  assert.equal(k('Circunf. Medial da Coxa (cm)'), 'coxa_medial');
  assert.equal(k('Circunf. do Braço Dir. Contraído (cm)'), 'braco_contraido_d');
  assert.equal(k('Circunf. do Braço Relaxado (cm)'), 'braco_relaxado');
  assert.equal(k('Dobra Torácica (mm)'), 'peitoral');
  assert.equal(k('Massa não adiposa'), 'mlg');
  assert.equal(k('Nível de Gordura Visceral'), 'visceral');
  assert.equal(k('Skeletal Muscle Mass'), 'smm');
  assert.equal(k('Relação da Cintura/Quadril (RCQ)'), null);
  assert.equal(k('Classif. do % de Gordura'), null);
  assert.equal(k('Circ. Musc. do Braço (CMB) (cm)'), null);
  assert.equal(k('Altura sentado (cm)'), null);
  assert.equal(k('Percentual de Massa muscular (%)'), null);
});

// Relatório de evolução (formato de sistemas de nutricionista): uma coluna por data.
const HTML = `<html><body><table>
<tr><th>Parâmetro</th><th>10/01/2026</th><th>03/03/2026</th><th>12/09/2026</th></tr>
<tr><td>Peso atual (Kg)</td><td>85.4</td><td>84.4 ↓ (-1)</td><td>84.7 ↑ (+0.3)</td></tr>
<tr><td>Altura atual (cm)</td><td>168</td><td>168</td><td>168</td></tr>
<tr><td>Relação da Cintura/Quadril (RCQ)</td><td>0.79</td><td>-</td><td>0.74</td></tr>
<tr><td>Percentual de Gordura (%)</td><td>10.8</td><td>-</td><td>7.7</td></tr>
<tr><td>Dobra Tricipital (mm)</td><td>7</td><td>-</td><td>6 ↓ (-1)</td></tr>
<tr><td>Circunferência da Cintura (cm)</td><td>84</td><td>-</td><td>78 ↓ (-6)</td></tr>
<tr><td>Circunf. da Panturrilha (cm)</td><td>37</td><td>-</td><td>37</td></tr>
<tr><td colspan="4">Análises por bioimpedância</td></tr>
<tr><td>Percentual de Gordura (%)</td><td>-</td><td>-</td><td>21.7</td></tr>
</table></body></html>`;

test('relatório HTML com várias datas vira uma avaliação por data', async () => {
  const { imp } = await mods;
  const r = imp.lerHtml(HTML);
  assert.equal(r.avaliacoes.length, 3);
  const [a, b, c] = r.avaliacoes;
  assert.equal(a.data, '2026-01-10');
  assert.equal(a.valores.peso, 85.4);
  assert.equal(a.valores.tricipital, 7);
  assert.equal(a.valores.cintura, 84);
  assert.equal(b.valores.peso, 84.4);
  assert.equal(b.valores.tricipital, undefined);
  assert.equal(c.valores.panturrilha, 37);
  assert.equal(c.valores.gordura_pct, 21.7, 'a seção de bioimpedância desempata o rótulo repetido');
  assert.equal(c.valores.gordura_pct_laudo, 7.7);
});

test('MHT (página salva) é aberto e lido', async () => {
  const { imp } = await mods;
  const mht = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="----B"\r\n\r\n------B\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${HTML.replace(/=/g, '=3D').replace(/Parâmetro/, 'Par=C3=A2metro')}\r\n------B--`;
  const r = imp.lerHtml(imp.htmlDoMht(mht));
  assert.equal(r.avaliacoes.length, 3);
});

// Itens de texto com posição, como o pdf.js entrega um laudo de balança Tanita (dados fictícios).
const it = (x, y, str) => ({ x, y, str });
const TANITA = [
  it(48, 81, 'Data'), it(49, 95, '12/09/2026 11:18'), it(270, 88, 'Idade'), it(377, 88, '40'), it(410, 89, 'X'), it(449, 88, 'Normal'), it(531, 88, 'Atlético'),
  it(270, 112, 'Altura'), it(362, 112, '168,0'), it(410, 113, 'X'), it(449, 112, 'Masculino'), it(531, 112, 'Feminino'),
  it(49, 141, 'Aluno Teste'), it(270, 137, 'Peso do vestuário (PT)'), it(482, 798, '© by TANITA Corporation'),
  it(83, 193, 'Peso'), it(151, 195, '84,7'), it(201, 195, '59,3-73,4'),
  it(78, 210, 'Gordura'), it(151, 212, '21,7'), it(67, 227, 'Massa adiposa'), it(151, 229, '18,4'),
  it(60, 245, 'Massa não adiposa'), it(151, 246, '66,3'), it(65, 262, 'Massa muscular'), it(151, 264, '63,1'),
  it(356, 263, 'Gordura'), it(70, 279, 'Massa óssea'), it(157, 281, '3,3'), it(85, 296, 'IMC'), it(151, 298, '30,0'),
  it(84, 313, 'SMM'), it(151, 315, '37,5'), it(64, 330, 'Idade Metabólica'), it(160, 332, '41'),
  it(70, 374, 'TBW'), it(118, 373, '48,1'), it(330, 374, 'BMR'), it(382, 374, '8103'),
  it(49, 387, 'Total Body Water'), it(118, 388, '56,8'), it(306, 387, 'Basal Metabolic Rate'), it(382, 388, '1935'),
  it(326, 407, 'Nivel de'), it(326, 416, 'gordura'), it(326, 425, 'visceral'), it(397, 419, '9'),
  it(52, 448, 'Análise segmental'), it(77, 471, 'Massa muscular'), it(341, 471, 'Gordura'),
  it(155, 501, '34,6kg'), it(87, 547, '4,0kg'), it(230, 547, '3,8kg'), it(81, 614, '10,4kg'), it(230, 614, '10,3kg'),
  it(421, 490, '21,9%'), it(419, 502, '10,1kg'), it(347, 539, '17,9%'), it(350, 550, '0,9kg'), it(495, 539, '18,7%'), it(495, 550, '0,9kg'),
  it(347, 609, '21,7%'), it(350, 621, '3,1kg'), it(495, 609, '23,3%'), it(495, 621, '3,3kg'),
  it(52, 663, 'Equilíbrio'), it(349, 791, 'Idade'), it(225, 787, '87'),
];

test('laudo de balança (PDF) preenche bioimpedância e segmentos', async () => {
  const { imp } = await mods;
  const r = imp.lerItens([{ itens: TANITA, largura: 595 }]);
  assert.equal(r.formato, 'Balança Tanita');
  assert.equal(r.avaliacoes.length, 1);
  const a = r.avaliacoes[0];
  assert.equal(a.data, '2026-09-12');
  assert.equal(a.hora, '11:18');
  assert.equal(a.sexo, 'M');
  const v = a.valores;
  assert.deepEqual(
    { peso: v.peso, altura: v.altura, idade: v.idade, gordura_pct: v.gordura_pct, massa_gorda: v.massa_gorda, mlg: v.mlg, massa_muscular: v.massa_muscular, massa_ossea: v.massa_ossea, imc: v.imc_aparelho, smm: v.smm, idade_metabolica: v.idade_metabolica, agua_kg: v.agua_kg, tmb: v.tmb, visceral: v.visceral },
    { peso: 84.7, altura: 168, idade: 40, gordura_pct: 21.7, massa_gorda: 18.4, mlg: 66.3, massa_muscular: 63.1, massa_ossea: 3.3, imc: 30, smm: 37.5, idade_metabolica: 41, agua_kg: 48.1, tmb: 1935, visceral: 9 },
  );
  assert.deepEqual(a.segmental.musculo_kg, { tronco: 34.6, braco_e: 4, braco_d: 3.8, perna_e: 10.4, perna_d: 10.3 });
  assert.deepEqual(a.segmental.gordura_pct, { tronco: 21.9, braco_e: 17.9, braco_d: 18.7, perna_e: 21.7, perna_d: 23.3 });
});

test('texto lido de foto (OCR) e planilha CSV', async () => {
  const { imp } = await mods;
  const t = imp.lerTextoLivre('InBody 270\nData: 05/10/2026\nPeso 80,2 kg  PGC 18,5 %\nMassa Muscular Esquelética 35,1 kg\nTaxa Metabólica Basal 1720 kcal\nNível de Gordura Visceral 7');
  assert.equal(t.formato, 'InBody');
  assert.deepEqual(t.avaliacoes[0].valores, { peso: 80.2, gordura_pct: 18.5, smm: 35.1, tmb: 1720, visceral: 7 });
  const c = imp.lerCsv('Data;Peso (kg);Gordura (%);Cintura (cm)\n01/08/2026;82,0;20,1;88\n01/09/2026;81,0;19,0;86');
  assert.equal(c.avaliacoes.length, 2);
  assert.deepEqual(c.avaliacoes[1], { data: '2026-09-01', sexo: null, valores: { peso: 81, gordura_pct: 19, cintura: 86 }, fonte: 'Planilha' });
});

test('mesma data em dois arquivos vira uma avaliação só', async () => {
  const { imp } = await mods;
  const u = imp.unirPorData([
    { data: '2026-09-12', valores: { peso: 84.7, gordura_pct: 21.7 }, fonte: 'Balança Tanita' },
    { data: '2026-09-12', valores: { peso: 84.7, tricipital: 6 }, fonte: 'Relatório paciente.me' },
  ]);
  assert.equal(u.length, 1);
  assert.deepEqual(u[0].valores, { peso: 84.7, gordura_pct: 21.7, tricipital: 6 });
  assert.equal(u[0].fonte, 'Balança Tanita + Relatório paciente.me');
});

test('previsão, recordes e alertas', async () => {
  const { calc } = await mods;
  const p = calc.prever([{ data: '2026-01-01', valor: 20 }, { data: '2026-01-29', valor: 18 }], 15);
  assert.equal(p.porSemana, -0.5);
  assert.equal(p.semanas, 6);
  const serie = [
    { data: '2026-01-01', m: { peso: 90, mlg: 70, massaGorda: 20, cintura: 95 } },
    { data: '2026-02-01', m: { peso: 84, mlg: 67, massaGorda: 17, cintura: 90 } },
  ];
  const al = calc.alertas(serie).map((a) => a.texto);
  assert.ok(al.some((t) => t.startsWith('Perda de massa magra')));
  assert.ok(al.some((t) => t.startsWith('Peso caindo')));
  const rec = calc.recordes(serie);
  assert.ok(rec.find((r) => r.key === 'cintura' && r.valor === 90 && r.novo));
});

test('simetria entre os lados', async () => {
  const { calc } = await mods;
  const s = calc.simetria({ braco_contraido: 38, braco_contraido_d: 39.5, coxa_medial: 58, coxa_medial_d: 58.4, panturrilha: 37 }, { musculo_kg: { perna_e: 10, perna_d: 10.6 } });
  assert.deepEqual(s.map((x) => [x.label, x.diferenca, x.atencao, x.menor]), [
    ['Braço contraído', 1.5, true, 'esquerdo'],
    ['Coxa medial', 0.4, false, 'esquerdo'],
    ['Músculo da perna', 0.6, true, 'esquerdo'],
  ]);
});
