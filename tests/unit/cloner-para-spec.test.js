'use strict';
// nexia-ai/cloner/para-spec.js: site.json do cliente + design.json de referência = spec válido (#2133).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { montarSpec } = require('../../nexia-ai/cloner/para-spec');

const ROOT = path.join(__dirname, '../..');
const exemplo = JSON.parse(fs.readFileSync(path.join(ROOT, 'clientes/exemplo/site.json'), 'utf8'));
const design = fs.readFileSync(path.join(ROOT, 'tests/fixtures/design-referencia.json'), 'utf8');

function raizTemp(slug, { site = exemplo, designTxt } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'para-spec-'));
  const dir = path.join(raiz, 'clientes', slug);
  fs.mkdirSync(dir, { recursive: true });
  if (site !== null) fs.writeFileSync(path.join(dir, 'site.json'), typeof site === 'string' ? site : JSON.stringify(site));
  if (designTxt !== undefined) fs.writeFileSync(path.join(dir, 'design.json'), designTxt);
  return raiz;
}

test('PS1. sem design.json devolve o spec normalizado do cliente', async () => {
  const spec = await montarSpec({ slug: 'cliente-a', raiz: raizTemp('cliente-a') });
  assert.strictEqual(spec.name, exemplo.name);
  assert.ok(spec.sections.some(s => s.type === 'hero'));
});

test('PS2. com design.json: estilo, fontes e cores vêm do site de referência', async () => {
  const spec = await montarSpec({ slug: 'cliente-b', raiz: raizTemp('cliente-b', { designTxt: design }) });
  assert.strictEqual(spec.style, 'bold');
  assert.strictEqual(spec.fonts.heading, 'Poppins');
  assert.strictEqual(spec.palette.primary, '#0a7d3b');
});

test('PS3. a ordem das seções segue o site de referência (faq antes de services)', async () => {
  const spec = await montarSpec({ slug: 'cliente-c', raiz: raizTemp('cliente-c', { designTxt: design }) });
  const tipos = spec.sections.map(s => s.type);
  if (tipos.includes('faq') && tipos.includes('services')) assert.ok(tipos.indexOf('faq') < tipos.indexOf('services'), tipos.join(','));
  assert.strictEqual(tipos[0], 'hero');
});

test('PS4. nenhum texto do site de origem entra no spec; o conteúdo é do cliente', async () => {
  const spec = await montarSpec({ slug: 'cliente-d', raiz: raizTemp('cliente-d', { designTxt: design }) });
  const tudo = JSON.stringify(spec);
  assert.ok(!tudo.includes('TEXTO DO SITE DE ORIGEM'), 'texto da referência vazou');
  assert.ok(!tudo.includes('exemplo-de-referencia.test'), 'host da referência vazou');
  assert.strictEqual(spec.name, exemplo.name);
});

test('PS5. slug inválido, site.json ausente, design corrompido e spec inválido dão erro claro', async () => {
  await assert.rejects(montarSpec({ slug: '../x', raiz: raizTemp('cliente-e') }), /slug inválido/);
  await assert.rejects(montarSpec({}), /slug inválido/);
  await assert.rejects(montarSpec({ slug: 'cliente-f', raiz: raizTemp('cliente-f', { site: null }) }), /falta clientes\/cliente-f\/site\.json/);
  await assert.rejects(montarSpec({ slug: 'cliente-g', raiz: raizTemp('cliente-g', { designTxt: '{quebrado' }) }), /design\.json não é um JSON válido/);
  await assert.rejects(montarSpec({ slug: 'cliente-h', raiz: raizTemp('cliente-h', { site: { name: '' } }) }), /spec inválido/);
});
