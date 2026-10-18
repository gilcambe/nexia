'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = p => fs.readFileSync(path.join(SRC, p), 'utf8');

test('convite com desconto: botão Convidar na Home, link curto com cupom e recado do WhatsApp', () => {
  const home = ler('pages/home/page.tsx');
  assert.match(home, /Convidar\s*<\/button>/);
  assert.match(home, /<ConvidarAmigo/);
  const c = ler('pages/home/components/ConvidarAmigo.tsx');
  assert.match(c, /c\/\$\{codigoCoach \|\| 'amigo'\}\$\{cupom \? `\?cupom=/);
  assert.match(c, /wa\.me\/\?text=/);
  assert.match(c, /verCupom/);
  const conv = ler('pages/chat/Convite.tsx');
  assert.match(conv, /bc_cupom/);
  assert.match(conv, /c !== 'AMIGO'/);
  assert.match(ler('components/feature/PagarPix.tsx'), /localStorage\.getItem\('bc_cupom'\)/);
});

test('Home mais limpa: itens secundários ficam em "Mais" e nenhum foi removido', () => {
  const home = ler('pages/home/page.tsx');
  const mais = home.slice(home.indexOf('<details'));
  for (const n of ['PedirAvaliacao', 'LigarAvisos', 'ConviteTestador']) assert.ok(mais.includes(`<${n} />`), n);
  for (const n of ['AvisoAnamnese', 'AvisoFotos', 'NuncaFalhe', 'TodayCard', 'NutritionCard', 'DailyCheckIn']) assert.ok(home.includes(`<${n} />`), n);
});
