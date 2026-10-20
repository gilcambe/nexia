'use strict';
// Body Coach B12: página de vendas /planos com prova social honesta, dúvidas e botão do Pix.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

test('B12: rota pública /planos fora do app logado', () => {
  const r = ler('router/config.tsx');
  assert.match(r, /const Planos = carregar\(\(\) => import\("\.\.\/pages\/planos\/page"\)\)/);
  const topo = r.split('path: "/",')[0];
  assert.match(topo, /path: "\/planos",\s*element: <Planos \/>/);
  assert.match(ler('pages/conheca/page.tsx'), /comRef\('\/planos'\)/);
});

test('B12: preços vêm da mesma fonte do Pix (sem número escrito à mão)', () => {
  const p = ler('pages/planos/page.tsx');
  assert.match(p, /import \{ PLANOS_PREMIUM, ECONOMIA_ANUAL, PRECOS \} from '@\/lib\/acesso'/);
  assert.match(p, /reais\(PLANOS_PREMIUM\.mensal\.valor\)/);
  assert.match(p, /reais\(PLANOS_PREMIUM\.anual\.valor\)/);
  assert.match(p, /PRECOS\.faixas\.map/);
  assert.doesNotMatch(p, /19,90|R\$ 179|R\$ 49/);
});

test('B12: botão do Pix leva para "Minha assinatura" (logado) ou cria a conta e volta para lá', () => {
  const p = ler('pages/planos/page.tsx');
  assert.match(p, /<Link to="\/acesso"[^>]*>.*Pagar com Pix/);
  assert.match(p, /state=\{\{ from: '\/acesso' \}\}/);
});

test('B12: FAQ de objeções e prova social sem depoimento inventado', () => {
  const p = ler('pages/planos/page.tsx');
  for (const q of ['Como eu pago?', 'cobrado todo mês', 'cancelar quando quiser', 'grátis para o Premium', 'cupom ou convite', 'Sou personal']) assert.ok(p.includes(q), q);
  assert.match(p, /Por que dá para confiar/);
  assert.doesNotMatch(p, /depoimento\s*[:=]|estrelas|★|\d+\s*mil (alunos|usuários)/i);
});
