'use strict';
// M5 (PC 2): regras puras das telas da Fábrica na Central nova (src/pages/central/kernex/fabricaRegras.ts).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const PASTA = path.join(__dirname, '../../src/pages/central/kernex');

async function fabrica() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'fabricaRegras.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-fab-'));
  fs.writeFileSync(path.join(dir, 'fabrica.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'fabrica.mjs')).href);
}

const CAT = {
  modulos: [
    { id: 'agenda', nome: 'Agenda online com painel', faz: 'cliente marca horário', nichos: ['estetica', 'dentista'], nivel: 1, pronto: true, origem: 'studiolima', testes: 12 },
    { id: 'area-viajante', nome: 'Área do viajante', faz: 'passageiro vê a viagem', nichos: ['viagens'], nivel: 2, pronto: true, origem: 'viajante-pro', testes: 26 },
  ],
  modelos: [
    { id: 'studiolima', nome: 'Estética com agenda', nichos: ['estetica', 'dentista'], modulos: ['agenda'], clonavel: true, previa: '' },
    { id: 'viajantepro', nome: 'Agência de viagens', nichos: ['viagens', 'turismo'], modulos: ['area-viajante'], clonavel: true, previa: '' },
    { id: 'body-coach', nome: 'Personal', nichos: ['fitness'], modulos: [], clonavel: false, previa: '' },
  ],
};
const FICHA = { nome: 'Clínica Sorriso', ramo: 'dentista', cidade: 'Recife', whatsapp: '5581999999999', precisa: ['agenda'] };

test('FAB1. Biblioteca acha por ramo sem acento e por nome', async () => {
  const { filtrarBiblioteca } = await fabrica();
  assert.deepEqual(filtrarBiblioteca(CAT, 'DENTISTA').modulos.map((m) => m.id), ['agenda']);
  assert.deepEqual(filtrarBiblioteca(CAT, 'area do viajante').modulos.map((m) => m.id), ['area-viajante']);
  assert.deepEqual(filtrarBiblioteca(CAT, 'turismo').modelos.map((m) => m.id), ['viajantepro']);
});

test('FAB2. Biblioteca: busca vazia devolve tudo; sem catálogo devolve listas vazias', async () => {
  const { filtrarBiblioteca } = await fabrica();
  assert.equal(filtrarBiblioteca(CAT, '  ').modulos.length, 2);
  assert.deepEqual(filtrarBiblioteca(null, 'x'), { modulos: [], modelos: [] });
});

test('FAB3. ficha certa não tem erro', async () => {
  const { errosDaFicha } = await fabrica();
  assert.deepEqual(errosDaFicha(FICHA), []);
});

test('FAB4. ficha: nome, ramo, WhatsApp (12 ou 13 dígitos) e "precisa" são cobrados um a um', async () => {
  const { errosDaFicha } = await fabrica();
  assert.equal(errosDaFicha({ ...FICHA, nome: ' ' }).length, 1);
  assert.equal(errosDaFicha({ ...FICHA, ramo: '' }).length, 1);
  assert.equal(errosDaFicha({ ...FICHA, whatsapp: '81999999999' }).length, 1);
  assert.equal(errosDaFicha({ ...FICHA, whatsapp: '+55 (81) 99999-9999' }).length, 0);
  assert.equal(errosDaFicha({ ...FICHA, precisa: [] }).length, 1);
});

test('FAB5. limparFicha: tira espaços, deixa WhatsApp só com números e tira repetidos', async () => {
  const { limparFicha } = await fabrica();
  assert.deepEqual(limparFicha({ nome: ' A ', ramo: ' b ', cidade: undefined, whatsapp: '+55 (81) 9999-99999', precisa: ['site', 'site', 'agenda'] }),
    { nome: 'A', ramo: 'b', cidade: '', whatsapp: '5581999999999', precisa: ['site', 'agenda'] });
});

test('FAB6. grupos conta pronto / adaptar / criar; sem consulta é tudo zero', async () => {
  const { grupos } = await fabrica();
  assert.deepEqual(grupos({ modelo: null, prontos: [{ id: 'a', nome: 'A' }], parecidos: [], faltam: ['x', 'y'], nivel: 1, minutos: 3, erros: [] }), { prontos: 1, adaptar: 0, criar: 2 });
  assert.deepEqual(grupos(null), { prontos: 0, adaptar: 0, criar: 0 });
});

test('FAB7. tempo em texto simples', async () => {
  const { textoTempo } = await fabrica();
  assert.equal(textoTempo(0.5), 'menos de 1 minuto');
  assert.equal(textoTempo(3), 'cerca de 3 min');
  assert.equal(textoTempo(60), 'cerca de 1 h');
  assert.equal(textoTempo(95), 'cerca de 1 h 35 min');
  assert.equal(textoTempo(null), 'sem estimativa');
});

test('FAB8. clonar: só clonáveis, os do mesmo ramo primeiro', async () => {
  const { modelosParaClonar } = await fabrica();
  assert.deepEqual(modelosParaClonar(CAT, 'viagens').map((m) => m.id), ['viajantepro', 'studiolima']);
  assert.deepEqual(modelosParaClonar(CAT, '').map((m) => m.id), ['studiolima', 'viajantepro']);
});

test('FAB9. erro de "parte desconhecida" = Fábrica ainda não ligada (não inventa dado)', async () => {
  const { servidorSemFabrica } = await fabrica();
  assert.equal(servidorSemFabrica('parte desconhecida: fabrica-catalogo'), true);
  assert.equal(servidorSemFabrica('Erro 404'), true);
  assert.equal(servidorSemFabrica('Faça login para continuar.'), false);
});

test('FAB10. menu tem a Fábrica e a tela não fala NEXIA nem prumo', async () => {
  const tela = fs.readFileSync(path.join(PASTA, 'Fabrica.tsx'), 'utf8');
  const casca = fs.readFileSync(path.join(PASTA, 'Casca.tsx'), 'utf8');
  assert.match(casca, /tela === "fabrica" \? <Fabrica \/>/);
  for (const s of tela.match(/"[^"]*"|>[^<{}]+</g) || []) assert.doesNotMatch(s, /nexia|prumo/i, s);
  for (const acao of ['fabrica-consultar', 'fabrica-criar', 'fabrica-publicar']) assert.ok(tela.includes(acao), acao);
  assert.ok(tela.includes('parte=fabrica-catalogo') && tela.includes('parte=fabrica-status'));
  assert.ok(tela.includes('window.confirm'), 'publicar pede confirmação');
});
