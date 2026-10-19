'use strict';
// Site da Kernex (#1009 SEO, #1011 privacidade/termos, #1018 página por produto, #1019 indicação).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderizar } = require('../../scripts/renderizar-site');
const { paginasExtras, depoimentosHtml } = require('../../clientes/kernex/paginas');
const { cleanLead } = require('../../netlify/functions/leads');
const { leads } = require('../../netlify/functions/central/empresa');

const base = path.join(__dirname, '../../clientes/kernex');
function gerar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernex-'));
  const raw = JSON.parse(fs.readFileSync(path.join(base, 'site.json'), 'utf8'));
  const media = JSON.parse(fs.readFileSync(path.join(base, 'midia.json'), 'utf8'));
  const r = renderizar(raw, dir, media, { base });
  const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');
  return { ...r, dir, ler };
}

test('KX-SEO: JSON-LD Organization, canonical, og:image, sitemap e robots (#1009)', () => {
  const { ler, escritos } = gerar();
  const html = ler('index.html');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'Organization');
  assert.equal(ld.name, 'Kernex');
  assert.equal(ld.url, 'https://kernex.com.br');
  assert.equal(ld.email, 'contato@kernex.com.br');
  assert.equal(ld.slogan, 'Inteligência que resolve.');
  assert.match(html, /<link rel="canonical" href="https:\/\/kernex\.com\.br\/">/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/kernex\.com\.br\/assets\/logo-fundo-claro\.png">/);
  assert.equal((html.match(/og:image/g) || []).length, 1);
  assert.ok(escritos.includes('assets/logo-fundo-claro.png'));
  const sm = ler('sitemap.xml');
  assert.match(sm, /<loc>https:\/\/kernex\.com\.br\/<\/loc>/);
  for (const p of ['body-coach.html', 'sites.html', 'privacidade.html', 'termos.html']) assert.ok(sm.includes(`https://kernex.com.br/${p}`), p);
  assert.match(ler('robots.txt'), /Sitemap: https:\/\/kernex\.com\.br\/sitemap\.xml/);
});

test('KX-LGPD: privacidade e termos existem, citam LGPD e contato@kernex.com.br, e o rodapé tem os links (#1011)', () => {
  const { ler } = gerar();
  for (const f of ['privacidade.html', 'termos.html']) {
    const s = ler(f);
    assert.match(s, /LGPD/, f);
    assert.match(s, /contato@kernex\.com\.br/, f);
  }
  const priv = ler('privacidade.html');
  for (const t of ['Gildivan Camilo Bezerra', 'Body Coach', 'Sites de clientes', 'Achados', 'art. 18', 'Firebase', 'Cloudflare', '15 dias', 'Cookies']) assert.ok(priv.includes(t), t);
  const termos = ler('termos.html');
  for (const t of ['grátis', 'Pix', 'Cancelamento', 'art. 49', '7 dias']) assert.ok(termos.includes(t), t);
  const idx = ler('index.html');
  assert.match(idx, /<a href="privacidade\.html">Privacidade<\/a> · <a href="termos\.html">Termos<\/a>/);
});

test('KX-PRODUTOS: body-coach.html e sites.html com preço, 6 perguntas e botão certo; sem depoimento inventado (#1018)', () => {
  const { ler } = gerar();
  const bc = ler('body-coach.html');
  assert.match(bc, /R\$ 19,90/);
  assert.match(bc, /14 dias grátis/);
  assert.match(bc, /href="https:\/\/nexiabodycoach\.pages\.dev"[^>]*>Testar grátis</);
  assert.equal((bc.match(/<details>/g) || []).length, 6);
  const st = ler('sites.html');
  assert.match(st, /Sob consulta/);
  assert.match(st, /href="https:\/\/wa\.me\/5511944037259[^"]*"[^>]*>Falar no WhatsApp</);
  assert.equal((st.match(/<details>/g) || []).length, 6);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(base, 'depoimentos.json'), 'utf8')), []);
  for (const s of [bc, st]) assert.doesNotMatch(s, /Depoimentos/);
  assert.equal(depoimentosHtml([], 'body-coach'), '');
  assert.match(depoimentosHtml([{ nome: 'Ana', texto: 'Bom', produto: 'body-coach' }], 'body-coach'), /Depoimentos/);
  assert.match(ler('index.html'), /href="body-coach\.html"/);
});

test('KX-INDIQUE: formulário de indicação manda origem indicacao e indicadoPor; o servidor guarda e a Central mostra (#1019)', async () => {
  const { ler } = gerar();
  const html = ler('index.html');
  assert.match(html, /Indique um negócio e ganhe 1 mês grátis/);
  assert.match(html, /origem: 'indicacao'/);
  assert.match(html, /indicadoPor:/);
  // o formulário de contato do Site Kit continua sendo o primeiro .form (o de indicação não usa a classe form)
  assert.ok(html.indexOf('class="form') > html.indexOf('id="form-indique"'));
  assert.doesNotMatch(html, /<form class="form" id="form-indique"/);
  const { lead } = cleanLead({ nome: 'Padaria Sol', whatsapp: '11999990000', consentimento: true, origem: 'indicacao', indicadoPor: 'Maria (11988887777)' });
  assert.equal(lead.origem, 'indicacao');
  assert.equal(lead.indicadoPor, 'Maria (11988887777)');
  assert.equal(cleanLead({ nome: 'Ana', whatsapp: '11999990000', consentimento: true }).lead.indicadoPor, undefined);
  const docs = [{ id: 'a', data: () => ({ nome: 'Padaria Sol', criado_em: '2026-10-19T10:00:00Z', status: 'novo', origem: 'indicacao', indicadoPor: 'Maria' }) }, { id: 'b', data: () => ({ nome: 'B', criado_em: '2026-10-18T10:00:00Z' }) }];
  const db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs }) }) }) }) };
  const r = await leads(db);
  assert.equal(r.ultimos[0].indicadoPor, 'Maria');
  assert.equal('indicadoPor' in r.ultimos[1], false);
  assert.match(fs.readFileSync(path.join(__dirname, '../../src/pages/central/Clientes.tsx'), 'utf8'), /Indicado por: \{l\.indicadoPor\}/);
});

test('KX-EXTRAS: paginasExtras não duplica o JSON-LD se rodar de novo', () => {
  const a = paginasExtras({ indexHtml: '<html><head></head><body><section class="section" id="contato"></section><a class="selo-nexia" href="#">x</a></body></html>', base });
  const b = paginasExtras({ indexHtml: a.arquivos['index.html'], base });
  assert.equal((b.arquivos['index.html'].match(/application\/ld\+json/g) || []).length, 1);
});
