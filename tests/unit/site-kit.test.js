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
  assert.strictEqual(q.filter(x => /\.g\d+$/.test(x.slot)).length, 6);
  assert.ok(q.find(x => x.kind === 'gif') && q.find(x => x.slot.endsWith('.clip') && x.kind === 'video'));
  const long = kit.normalizeSpec({ ...SITE, sections: [{ type: 'hero', title: 'x' }, { type: 'about', title: 'Sobre '.repeat(30) }, { type: 'services', items: [{ title: '1' }] }, { type: 'faq' }] }, { kind: 'site' }).spec;
  for (const x of kit.mediaQueries(long)) assert.ok(x.query.length >= 2 && x.query.length <= 100 && /[a-z]{2}/i.test(x.query), x.query);
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

test('K4b. seção sem foto some do menu e do "rolar"; âncoras repetidas viram únicas', () => {
  const raw = JSON.parse(JSON.stringify(SITE));
  raw.sections.splice(1, 0, { type: 'about', id: 'tratamentos', title: 'Outro' });
  const { spec } = kit.normalizeSpec(raw, { kind: 'site' });
  assert.strictEqual(new Set(spec.sections.map(s => s.id)).size, spec.sections.length);
  const media = {};
  kit.mediaQueries(spec).forEach((q, k) => { if (q.kind !== 'video' && !/\.g\d/.test(q.slot)) media[q.slot] = photo(k); });
  const files = kit.render(spec, media);
  const html = files['demos/sorriso-leve/index.html'];
  const errs = gate(files, 'site').errors.filter(e => /link para/.test(e.message));
  assert.deepStrictEqual(errs, []);
  assert.ok(!/__NEXT__/.test(html));
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

test('K6. ADR-Q-05: padrão mínimo de qualidade (conteúdo e fotos); fontes fora da lista e contraste ruim são corrigidos', () => {
  const full = JSON.parse(JSON.stringify(SITE));
  const sec = t => full.sections.find(s => s.type === t);
  sec('services').items = ['Clareamento', 'Implantes', 'Ortodontia'].map(t => ({ title: t, text: `${t} com tecnologia.`, image_query: 'dental care' }));
  sec('testimonials').items = ['Carla', 'João', 'Bia'].map(n => ({ name: n, text: 'Atendimento excelente e sem dor.', rating: 5 }));
  sec('faq').items = [1, 2, 3, 4].map(k => ({ q: `Vocês atendem aos sábados${'?'.repeat(k)}`, a: 'Sim, das 8h às 12h.' }));
  const { spec } = kit.normalizeSpec(full, { kind: 'site' });
  assert.deepStrictEqual(kit.qualityCheck(spec, null).content, []);
  const media = {};
  kit.mediaQueries(spec).forEach((q, k) => { if (!q.kind) media[q.slot] = photo(k); });
  assert.ok(kit.qualityCheck(spec, media).ok);
  delete media['s0.hero'];
  assert.ok(kit.qualityCheck(spec, media).media.some(m => /topo/.test(m)));
  const weak = kit.normalizeSpec({ ...full, sections: full.sections.filter(s => !['faq', 'gallery'].includes(s.type)) }, { kind: 'site' }).spec;
  const c = kit.qualityCheck(weak, null).content;
  assert.ok(c.some(m => /faq/.test(m)) && c.some(m => /gallery/.test(m)));
  sec('services').items[0].title = 'Serviço 1';
  assert.ok(kit.qualityCheck(kit.normalizeSpec(full, { kind: 'site' }).spec, null).content.some(m => /genérico/.test(m)));
  // Fonte inventada vira o par do estilo; cor clara demais no botão escurece até ter contraste.
  const f = kit.normalizeSpec({ ...SITE, style: 'bold', fonts: { heading: 'Comic Sans MS', body: 'Arial' }, palette: { primary: '#ffd166', text: '#999999', bg: '#ffffff' } }, { kind: 'site' }).spec;
  assert.deepStrictEqual(f.fonts, { heading: 'Bricolage Grotesque', body: 'DM Sans' });
  const { contrast } = require('../../nexia-ai/site-kit/spec');
  assert.ok(contrast(f.palette.primary, '#ffffff') >= 4.5 && contrast(f.palette.text, f.palette.bg) >= 7);
  const sys = kit.normalizeSpec({ ...SYSTEM, entities: [{ ...SYSTEM.entities[0], sample: SYSTEM.entities[0].sample.slice(0, 1) }] }, { kind: 'system' }).spec;
  assert.ok(kit.qualityCheck(sys, null).content.some(m => /4 linhas/.test(m)));
});

test('K7. vídeo (YouTube e arquivo), GIF, música e links: renderizam, passam na checagem e nada toca sozinho', () => {
  const raw = JSON.parse(JSON.stringify(SITE));
  raw.contact.youtube = 'https://youtube.com/@sorrisoleve';
  raw.contact.tiktok = '@sorrisoleve';
  raw.sections.splice(5, 0,
    { type: 'video', title: 'Tour', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3' },
    { type: 'music', title: 'Trilha', audio_query: 'calm piano' },
    { type: 'links', title: 'Links', items: [{ label: 'Loja', url: 'https://loja.test', icon: 'cart' }, { label: 'ruim', url: 'javascript:alert(1)' }] });
  const { spec } = kit.normalizeSpec(raw, { kind: 'site' });
  const media = {};
  kit.mediaQueries(spec).forEach((q, k) => {
    if (q.kind === 'audio') media[q.slot] = { url: 'https://cdn.test/song.mp3', title: 'Calm piano', mime: 'audio/mpeg', credit: 'Música: X (CC BY)' };
    else if (q.kind === 'gif') media[q.slot] = { ...photo(k), url: `https://img.test/${k}.gif`, mime: 'image/gif' };
    else if (q.kind === 'video' && q.slot.endsWith('.clip')) media[q.slot] = { url: 'https://v.test/clip.mp4', mime: 'video/mp4', width: 1280, height: 720, poster: 'https://img.test/p.jpg', credit: 'Vídeo: Y / Pexels' };
    else if (!q.kind) media[q.slot] = photo(k);
  });
  const files = kit.render(spec, media);
  const html = files['demos/sorriso-leve/index.html'];
  assert.match(html, /data-yt="dQw4w9WgXcQ"/);
  assert.match(html, /<video controls preload="metadata"/);
  assert.match(html, /\.gif"/);
  assert.match(html, /<audio preload="none" src="https:\/\/cdn\.test\/song\.mp3">/);
  assert.ok(!/<audio[^>]*autoplay/.test(html), 'música nunca toca sozinha');
  assert.match(html, /href="https:\/\/loja\.test"/);
  assert.ok(!/javascript:/.test(html));
  assert.match(html, /tiktok\.com\/@sorrisoleve/);
  assert.match(files['demos/sorriso-leve/script.js'], /youtube-nocookie\.com\/embed/);
  const r = gate(files, 'site');
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
  assert.strictEqual(kit.normalizeSpec({ ...SITE, sections: [...SITE.sections, { type: 'video', title: 'sem nada' }] }, { kind: 'site' }).spec.sections.filter(s => s.type === 'video').length, 1);
});
