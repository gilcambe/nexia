'use strict';
// ADR-Q-04: NEXIA Site Kit. O spec (JSON da IA) é lido com tolerância e validado; o código gerado
// passa na checagem visual e estática (ADR-Q-02/03) sem nenhum erro, para site e para sistema.
const test = require('node:test');
const assert = require('node:assert');
const kit = require('../../nexia-ai/site-kit');
const { checkWebFiles } = require('../../nexia-ai/orchestrator/web-check');

const SITE = kit.SITE_EXAMPLE || require('../../nexia-ai/site-kit/prompt').SITE_EXAMPLE;
const SYSTEM = require('../../nexia-ai/site-kit/prompt').SYSTEM_EXAMPLE;
const photo = k => ({ url: `https://img.test/${k}.jpg`, width: 1600, height: 1067, alt: `foto ${k}`, credit: `Foto ${k} (CC BY)`, provider: 'openverse' });
const gate = (files, kind) => {
  const list = Object.entries(files).map(([path, content]) => ({ path, content }));
  return checkWebFiles(list, { design: kind, added: new Set(list.map(f => f.path)) });
};

test('K1. extractJson aceita texto em volta, ```json e vírgula sobrando', () => {
  assert.deepStrictEqual(kit.extractJson('Aqui está:\n```json\n{"a": [1, 2,], "b": "x}y",}\n```\nPronto.'), { a: [1, 2], b: 'x}y' });
  assert.strictEqual(kit.extractJson('sem json'), null);
  assert.strictEqual(kit.extractJson('{"a": }'), null);
});

test('K2. normalizeSpec valida, completa padrões e protege a pasta', () => {
  const bad = kit.normalizeSpec({ sections: [{ type: 'about' }] }, { kind: 'site' });
  assert.ok(!bad.spec);
  assert.ok(bad.errors.some(e => /name/.test(e)) && bad.errors.some(e => /hero/.test(e)));
  const { spec, errors } = kit.normalizeSpec({ ...SITE, folder: '../.github/workflows', fonts: { heading: 'x<script>' }, palette: { primary: 'red' } }, { kind: 'site', request: 'crie um site na pasta nova demos/clinica' });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(spec.folder, 'demos/clinica', 'pasta inválida cai na pasta do pedido');
  assert.strictEqual(spec.fonts.heading, 'Fraunces');
  assert.strictEqual(spec.palette.primary, '#1f6f5c');
  assert.ok(spec.sections.some(s => s.type === 'contact'));
  const sys = kit.normalizeSpec({ name: 'X', entities: [{ label: 'Vazia', fields: [] }] }, { kind: 'system' });
  assert.ok(sys.errors.some(e => /entidade/.test(e)));
});

test('K3. mediaQueries: uma busca por foto do site; sistema não busca', () => {
  const { spec } = kit.normalizeSpec(SITE, { kind: 'site' });
  const q = kit.mediaQueries(spec);
  assert.ok(q.find(x => x.slot === 's0.hero'));
  assert.ok(q.find(x => x.slot === 's0.video' && x.kind === 'video'));
  assert.ok(q.filter(x => /\.g\d/.test(x.slot)).length === 4);
  assert.deepStrictEqual(kit.mediaQueries(kit.normalizeSpec(SYSTEM, { kind: 'system' }).spec), []);
});

test('K4. site gerado passa na checagem visual e estática sem erro nem aviso; textos escapados', () => {
  const raw = JSON.parse(JSON.stringify(SITE));
  raw.sections[0].title = 'Sorriso <script>alert(1)</script> "leve"';
  const { spec } = kit.normalizeSpec(raw, { kind: 'site' });
  const media = {};
  kit.mediaQueries(spec).forEach((q, k) => { if (q.kind !== 'video') media[q.slot] = photo(k); });
  const files = kit.render(spec, media);
  assert.deepStrictEqual(Object.keys(files).sort(), ['demos/sorriso-leve/index.html', 'demos/sorriso-leve/script.js', 'demos/sorriso-leve/styles.css']);
  const r = gate(files, 'site');
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
  assert.deepStrictEqual(r.missingCandidates, []);
  const html = files['demos/sorriso-leve/index.html'];
  assert.ok(!html.includes('<script>alert'), 'texto da IA é escapado');
  assert.match(html, /fonts\.googleapis\.com/);
  assert.match(html, /wa\.me\/5511999998888/);
  assert.match(html, /Créditos das imagens/);
});

test('K5. sistema gerado passa na checagem (menu, fontes, responsivo, animação) e embute a config com segurança', () => {
  const raw = JSON.parse(JSON.stringify(SYSTEM));
  raw.entities[0].sample[0].paciente = '</script><img src=x onerror=alert(1)>';
  const { spec } = kit.normalizeSpec(raw, { kind: 'system' });
  const files = kit.render(spec);
  const r = gate(files, 'system');
  assert.deepStrictEqual(r.errors, []);
  const html = files['demos/agenda-clinica/index.html'];
  assert.ok(!/<\/script><img/.test(html), 'dado de exemplo não fecha a tag do JSON');
  const cfg = JSON.parse(/<script type="application\/json" id="app-config">([^<]*)<\/script>/.exec(html)[1]);
  assert.strictEqual(cfg.entities[0].sample[0].paciente, '</script><img src=x onerror=alert(1)>');
  assert.doesNotThrow(() => new Function(files['demos/agenda-clinica/app.js']));
});
