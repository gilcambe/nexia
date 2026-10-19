'use strict';
// Body Coach (#1010 SEO, #1012 privacidade Kernex e "apagar minha conta" com 2 confirmações).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

test('BC-SEO: index.html tem JSON-LD SoftwareApplication com publisher Kernex e prévia (og:image do próprio app)', () => {
  const html = R('apps/body-coach/index.html');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'SoftwareApplication');
  assert.equal(ld.name, 'Body Coach');
  assert.equal(ld.applicationCategory, 'HealthApplication');
  assert.equal(ld.operatingSystem, 'Android, Web');
  assert.equal(ld.offers.priceCurrency, 'BRL');
  assert.deepStrictEqual(ld.publisher, { '@type': 'Organization', name: 'Kernex', url: 'https://kernex.com.br' });
  assert.match(html, /<meta property="og:image" content="https:\/\/nexiabodycoach\.pages\.dev\/body-coach\/og-image\.png"/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  // o plano mais barato existe no app (Básico grátis) e o Premium bate com o preço do app
  assert.match(R('apps/body-coach/src/lib/acesso.ts'), /premium: 'R\$ 19,90 por mês ou R\$ 179 por ano'/);
  assert.match(ld.offers.description, /R\$ 19,90/);
});

test('BC-PRIV: perfil tem o link da privacidade Kernex, mantém o antigo, e pede 2 confirmações antes de apagar', () => {
  const s = R('apps/body-coach/src/pages/profile/page.tsx');
  assert.match(s, /to="\/privacidade"/);
  assert.match(s, /PRIVACIDADE_KERNEX = 'https:\/\/kernex\.pages\.dev\/privacidade\.html'/);
  assert.match(s, /Privacidade e termos \(Kernex\)/);
  const fn = s.slice(s.indexOf('const deleteAccount'), s.indexOf('deleteAllUserData(user.id)'));
  assert.equal((fn.match(/await confirmar\(/g) || []).length, 2, 'duas confirmações antes de apagar');
  assert.ok(fn.indexOf('setDeleting(true)') > fn.lastIndexOf('await confirmar('), 'nada acontece antes das confirmações');
  assert.match(s, /Excluir minha conta/);
});
