'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ler = (p) => fs.readFileSync(path.join(__dirname, '../../', p), 'utf8');

test('BRANDING-TELAS: marcas visíveis do usuário exibem KERNEX e não NEXIA OS', () => {
  const login = ler('src/pages/login/page.tsx');
  assert.ok(login.includes('KERNEX'), 'Login deve conter KERNEX');
  assert.ok(!login.includes('NEXIA OS'), 'Login não deve conter NEXIA OS');

  const tenant = ler('src/pages/tenant/page.tsx');
  assert.ok(tenant.includes('Voltar ao KERNEX'), 'Tenant deve conter Voltar ao KERNEX');
  assert.ok(!tenant.includes('Voltar ao NEXIA OS'), 'Tenant não deve conter Voltar ao NEXIA OS');

  const robos = ler('src/pages/robos/page.tsx');
  assert.ok(robos.includes('Robôs KERNEX'), 'Robôs deve conter Robôs KERNEX');

  const legal = ler('src/pages/legais/components/LegalLayout.tsx');
  assert.ok(legal.includes('Voltar ao KERNEX'), 'LegalLayout deve conter Voltar ao KERNEX');
  assert.ok(!legal.includes('NEXIA<span className="text-nexia-cyan">OS</span>'), 'LegalLayout não deve conter NEXIA OS em span');

  const footer = ler('src/pages/home/components/Footer.tsx');
  assert.ok(footer.includes('KERNEX</span>'), 'Footer deve conter KERNEX');
});
