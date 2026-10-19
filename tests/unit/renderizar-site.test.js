'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderizar } = require('../../scripts/renderizar-site');
const kit = require('../../nexia-ai/site-kit');
const { checkWebFiles } = require('../../nexia-ai/orchestrator/web-check');

test('RS1. o spec de exemplo dos clientes vira site completo que passa na checagem de qualidade', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../clientes/exemplo/site.json'), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  const { spec: prev } = kit.normalizeSpec(raw, { kind: 'site' });
  const media = {};
  kit.mediaQueries(prev).forEach((q, k) => { if (q.kind !== 'video') media[q.slot] = { url: `https://img.test/${k}.jpg`, width: 1600, height: 1067, alt: `foto ${k}`, credit: `Foto ${k} (CC BY)`, provider: 'openverse' }; });
  const { spec, escritos } = renderizar(raw, dir, media);
  assert.ok(escritos.includes('index.html') && escritos.includes('styles.css'));
  assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(spec.name));
  const files = escritos.map(p => ({ path: `x/${p}`, content: fs.readFileSync(path.join(dir, p), 'utf8') }));
  const r = checkWebFiles(files, { design: 'site', added: new Set(files.map(f => f.path)) });
  assert.deepStrictEqual(r.errors, []);
  assert.ok(kit.qualityCheck);
});

test('RS2. spec inválido não gera nada', () => {
  assert.throws(() => renderizar({ sections: [] }, os.tmpdir()), /inválido/);
});

test('RS3. todo site de cliente leva o selo "Feito com NEXIA" no rodapé', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../clientes/exemplo/site.json'), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  renderizar(raw, dir);
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /class="selo-nexia"[^>]*>Feito com NEXIA</);
});

const gerar = slug => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `site-${slug}-`));
  const base = path.join(__dirname, `../../clientes/${slug}`);
  const raw = JSON.parse(fs.readFileSync(path.join(base, 'site.json'), 'utf8'));
  const media = JSON.parse(fs.readFileSync(path.join(base, 'midia.json'), 'utf8'));
  const r = renderizar(raw, dir, media, { base });
  return { ...r, dir, html: fs.readFileSync(path.join(dir, 'index.html'), 'utf8') };
};

test('RS4. landing do Adriano Blumer (#1022): título, WhatsApp, 3 redes, logo e fotos do próprio cliente, selo Kernex', () => {
  const { html, escritos, dir } = gerar('adriano');
  assert.match(html, /<title>Adriano Blumer/);
  assert.match(html, /href="https:\/\/wa\.me\/5511999994185/);
  assert.match(html, /Falar no WhatsApp/);
  for (const rede of ['https://www.instagram.com/adrianoblumer_nutri', 'https://www.tiktok.com/@adrianoblumer_nutri', 'https://www.youtube.com/@adrianoblumer']) assert.ok(html.includes(`href="${rede}"`), rede);
  assert.match(html, /rel="icon" href="assets\/logo-adriano-icon\.png"/);
  assert.match(html, /class="brand__logo" src="assets\/logo-adriano-full\.png"/);
  assert.match(html, /class="hero__avatar" src="assets\/foto-adriano\.jpg"/);
  assert.match(html, /class="selo-nexia" href="https:\/\/kernex\.com\.br\/\?utm_source=adriano&amp;utm_medium=selo"[^>]*>Feito com Kernex</);
  assert.doesNotMatch(html, /<form|R\$/);
  for (const f of ['assets/logo-adriano-full.png', 'assets/logo-adriano-icon.png', 'assets/foto-adriano.jpg']) {
    assert.ok(escritos.includes(f), f);
    assert.ok(fs.statSync(path.join(dir, f)).size > 1000);
  }
});

test('RS5. site da Kernex (#1008): produtos, clientes, como funciona, contato com formulário que grava origem kernex-site', () => {
  const { html, escritos } = gerar('kernex');
  assert.match(html, /<title>Kernex — Inteligência que resolve\./);
  for (const id of ['produtos', 'clientes', 'como-funciona', 'contato']) assert.match(html, new RegExp(`<section class="section[^"]*" id="${id}"`), id);
  assert.match(html, /<form class="form[^>]*data-leads="https:\/\/nexia\.gcbezerra\.workers\.dev\/api\/leads" data-origem="kernex-site"/);
  assert.match(html, /href="https:\/\/nexiabodycoach\.pages\.dev"/);
  assert.match(html, /href="https:\/\/adrianoblumer\.pages\.dev"/);
  assert.equal((html.match(/class="card__tag">Em breve</g) || []).length, 2);
  assert.match(html, /href="https:\/\/wa\.me\/5511944037259/);
  assert.ok(escritos.includes('assets/logo-fundo-escuro.svg') && escritos.includes('assets/simbolo.svg'));
});

test('RS6. imagem local fora do repositório ou que não é imagem é recusada; sem base nada é copiado', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../clientes/exemplo/site.json'), 'utf8'));
  const base = path.join(__dirname, '../../clientes/exemplo');
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  assert.throws(() => renderizar({ ...raw, logo: '../../../../../../etc/x.png' }, tmp(), {}, { base }), /imagem local/);
  assert.throws(() => renderizar({ ...raw, logo: 'site.json' }, tmp(), {}, { base }), /imagem local/);
  const { escritos } = renderizar({ ...raw, logo: 'assets/x.png' }, tmp());
  assert.ok(!escritos.some(f => f.startsWith('assets/')));
});
