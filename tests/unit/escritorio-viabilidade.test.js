'use strict';
// Regras do dono (13/11/2026): nunca aceitar projeto que o Cortex não dá conta; o que falta vai para o Buscador.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const { analisar } = require('../../nexia-ai/escritorio/viabilidade');
const { consultaGithub, avaliar, pedidoDeBusca, termos } = require('../../nexia-ai/escritorio/buscador');
const { createMural } = require('../../nexia-ai/escritorio/mural');
const { rodar, faltaDe } = require('../../scripts/escritorio-buscador');
const { rota } = require('../../netlify/functions/central/escritorio');

test('VB1. viabilidade: pedido fora do que fazemos é recusado com resposta educada', () => {
  const r = analisar({ ramo: 'loja', precisa: ['site'], descricao: 'quero um app nativo com emissão de nota fiscal' });
  assert.equal(r.nivel, 'nao-fazemos'); assert.equal(r.podeVender, false);
  assert.match(r.resposta, /Hoje não trabalhamos com/);
});

test('VB2. viabilidade: ramo com modelo clonável e nada faltando = pronto (pode vender)', () => {
  const r = analisar({ ramo: 'barbearia', precisa: ['site', 'whatsapp'] });
  assert.ok(['pronto', 'web'].includes(r.nivel), JSON.stringify(r));
  assert.equal(r.podeVender, true);
});

test('VB3. viabilidade: pagamento/financeiro é arriscado (escopo menor, não promete)', () => {
  const r = analisar({ ramo: 'academia', precisa: ['site', 'pagamento recorrente'] });
  assert.equal(r.nivel, 'arriscado'); assert.equal(r.podeVender, false);
  assert.match(r.resposta, /versão menor/);
});

test('VB4. Buscador: traduz para o GitHub, só licença aceita, descarta arquivado/antigo/pouco popular', () => {
  assert.match(termos('cardápio com carrinho'), /restaurant menu.*shopping cart/);
  assert.match(decodeURIComponent(consultaGithub('galeria', 'mit')), /photo gallery javascript license:mit archived:false stars:>=50/);
  assert.throws(() => consultaGithub('galeria', 'gpl-3.0'), /licença não aceita/);
  const agora = new Date('2026-11-13');
  const itens = [
    { full_name: 'a/bom', license: { spdx_id: 'MIT' }, stargazers_count: 900, pushed_at: '2026-01-01', archived: false, description: 'x' },
    { full_name: 'a/gpl', license: { spdx_id: 'GPL-3.0' }, stargazers_count: 9000, pushed_at: '2026-01-01', archived: false },
    { full_name: 'a/velho', license: { spdx_id: 'MIT' }, stargazers_count: 900, pushed_at: '2020-01-01', archived: false },
    { full_name: 'a/arq', license: { spdx_id: 'ISC' }, stargazers_count: 900, pushed_at: '2026-01-01', archived: true },
    { full_name: 'a/pouco', license: { spdx_id: 'Apache-2.0' }, stargazers_count: 3, pushed_at: '2026-01-01', archived: false },
  ];
  assert.deepEqual(avaliar(itens, agora).map((x) => x.repo), ['a/bom']);
  assert.equal(faltaDe(pedidoDeBusca('cupom de desconto').texto), 'cupom de desconto');
});

test('VB5. rota de viabilidade manda o que falta (sem pronto) ao Buscador; a rodada do Buscador põe na Biblioteca e conclui', async () => {
  const mural = createMural({ env: {}, driver: createMemoryDriver() });
  const r = await rota({ acao: 'escritorio-viabilidade', body: { ramo: 'restaurante', precisa: ['site', 'programa de fidelidade com carimbo digital'] } }, { mural });
  assert.equal(r.status, 200);
  assert.ok(r.corpo.nivel);
  const pedidos = (await mural.listar({ tipo: 'pedido' })).filter((x) => x.para === 'buscador');
  assert.equal(pedidos.length, r.corpo.buscando.length);
  if (!pedidos.length) await mural.postar(pedidoDeBusca('fidelidade'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-busc-'));
  const pj = path.join(dir, 'prontos.json');
  fs.writeFileSync(pj, JSON.stringify({ palavras: {}, prontos: [] }));
  const gh = async () => ({ items: [{ full_name: 'x/loyalty-card', license: { spdx_id: 'MIT' }, stargazers_count: 120, pushed_at: '2026-06-01', archived: false, description: 'Loyalty stamp card' }] });
  const res = await rodar({ mural, gh, prontosPath: pj, log: () => {}, agora: new Date('2026-11-13') });
  assert.equal(res.mudou, true);
  const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
  assert.equal(p.prontos[0].repo, 'x/loyalty-card'); assert.equal(p.prontos[0].licenca, 'MIT');
  assert.ok(Object.keys(p.palavras)[0].startsWith('buscado-'));
  assert.equal((await mural.listar({ tipo: 'pedido', status: 'aberto' })).filter((x) => x.para === 'buscador').length, 0, 'pedido concluído');
  assert.ok((await mural.listar({ area: 'producao' })).some((x) => /Já está na Biblioteca/.test(x.texto)));
});
