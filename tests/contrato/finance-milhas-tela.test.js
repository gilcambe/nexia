'use strict';
// Contrato: Kernex Finance, milhas. TELAS rodando o código com elementos falsos (clique/arquivo -> chamada da API certa):
// aba Milhas (prumo/pontos.js): saldo por print, valor das milhas e calculadoras; aba Viagens (prumo/viagens.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
const espera = () => new Promise((r) => setTimeout(r, 30));
const campo = (campos, nome) => campos.find((c) => c.nome === nome);

function montar(tela, respostas) {
  const chamadas = []; const forms = []; const avisos = []; const pdfs = []; const html = []; const stubs = {};
  const stub = (sel) => (stubs[sel] = stubs[sel] || { sel, onclick: null, onchange: null, dataset: {}, files: [], value: '', innerHTML: '', click() { this.clicou = true; } });
  const el = { innerHTML: '', insertAdjacentHTML: (_pos, h) => html.push(h), querySelector: stub, querySelectorAll: () => [] };
  const window = { MB: { telas: {} } };
  const MB = window.MB;
  MB.api = async (acao, dados) => { chamadas.push({ acao, dados }); const r = respostas[acao]; return typeof r === 'function' ? r(dados) : (r || { ok: true }); };
  const reduzir = async (f) => `R:${f.name}`;
  MB.ui = { aba() {}, brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s), TIPOS: {}, CATS: {}, hoje: () => '2026-11-17', opcoes: () => '', barra: () => '',
    formulario: (titulo, campos, aoSalvar, aoApagar) => { forms.push({ titulo, campos, aoSalvar, aoApagar }); }, reduzir, recarregar() {}, ok: (m) => { avisos.push(m); } };
  MB.pdf = { MAX: 5, paraImagens: async (arqs, red) => { pdfs.push(arqs); const imagens = []; for (const a of arqs) { if (/\.pdf$/.test(a.name)) imagens.push(`P1:${a.name}`, `P2:${a.name}`); else imagens.push(await red(a)); } return { imagens, cortou: false }; } };
  const document = { createElement: () => ({}), body: { appendChild: (s) => { if (s.onload) setTimeout(s.onload, 0); } } };
  const ctx = { window, document, console, setTimeout, clearTimeout, Promise, confirm: () => true };
  vm.runInNewContext(ler('milhas.js'), ctx);
  vm.runInNewContext(ler(tela), ctx);
  return { MB, el, stub, chamadas, forms, avisos, pdfs, html };
}
const CARTEIRA = [{ id: 'a', programa: 'Smiles', saldo: 50000, valor_milheiro: 16, validade: null }, { id: 'b', programa: 'Livelo', saldo: 8000, valor_milheiro: 20 }];
const PONTOS = { pontos_listar: { itens: CARTEIRA, total_estimado: 960, vencendo: [] }, cartao_listar: { cartoes: [] },
  milhas_visao: { programas: [], lacunas: [], promocoes: [], aviso: 'aviso' } };

test('aba Milhas: saldo por print lê TODOS os arquivos (foto + PDF), confere cada um e salva certo', async () => {
  const t = montar('pontos.js', { ...PONTOS, pontos_print_ler: { lidos: [
    { ok: true, pontos: { programa: 'Smiles', saldo: 45300, validade: '2026-12-31', a_vencer_pontos: 2000 } },
    { ok: true, pontos: { programa: 'TudoAzul', saldo: 1200, validade: null, a_vencer_pontos: null } },
    { ok: false, erro: 'x' }] } });
  await t.MB.telas.pontos(t.el);
  assert.match(t.html.join(''), /Atualizar saldos por print/);
  assert.equal(typeof t.stub('#pp-ler').onclick, 'function');
  t.stub('#pp-ler').onclick();
  assert.equal(t.stub('#pp-arq').clicou, true, 'o botão abre o seletor de arquivos');
  const arq = t.stub('#pp-arq');
  arq.files = [{ name: 'smiles.png' }, { name: 'azul.pdf' }];
  await arq.onchange({ target: arq }); await espera();
  assert.equal(t.pdfs.length, 1); assert.equal(t.pdfs[0].length, 2, 'todos os arquivos juntos');
  const lerCh = t.chamadas.find((c) => c.acao === 'pontos_print_ler');
  assert.deepEqual([...lerCh.dados.imagens], ['R:smiles.png', 'P1:azul.pdf', 'P2:azul.pdf']);
  assert.equal(t.forms.length, 2, 'um formulário de conferência por print lido');
  assert.match(t.forms[0].titulo, /atualizar Smiles/, 'programa existente é atualizado');
  assert.match(t.forms[1].titulo, /novo programa/i, 'TudoAzul ainda não existe');
  assert.equal(campo(t.forms[0].campos, 'saldo').valor, 45300);
  assert.ok(t.avisos.some((m) => /1 print/.test(m)), 'avisa que 1 não deu para ler');
  await t.forms[0].aoSalvar({ programa: 'Smiles', saldo: '45300', a_vencer_pontos: '2000', validade: '2026-12-31' });
  const salvo = t.chamadas.find((c) => c.acao === 'pontos_print_salvar');
  assert.deepEqual({ ...salvo.dados }, { programa: 'Smiles', saldo: 45300, a_vencer_pontos: 2000, validade: '2026-12-31' });
});

test('aba Milhas: mais de 5 arquivos é barrado e nada é enviado', async () => {
  const t = montar('pontos.js', PONTOS);
  await t.MB.telas.pontos(t.el);
  const arq = t.stub('#pp-arq');
  arq.files = Array.from({ length: 6 }, (_, i) => ({ name: `p${i}.png` }));
  await arq.onchange({ target: arq });
  assert.equal(t.chamadas.some((c) => c.acao === 'pontos_print_ler'), false);
  assert.match(t.stub('#pp-res').innerHTML, /no máximo 5/);
});

test('aba Milhas: valor da carteira e calculadoras mostram os resultados certos ao clicar', async () => {
  const t = montar('pontos.js', PONTOS);
  await t.MB.telas.pontos(t.el);
  assert.match(t.html.join(''), /Total: R\$ 960/, '50.000 x 16 + 8.000 x 20 = 800 + 160');
  t.stub('.vc-ref[data-i="0"]').value = '20'; t.stub('.vc-ref[data-i="1"]').value = '20';
  t.stub('#vc-ir').onclick();
  assert.match(t.stub('#vc-res').innerHTML, /Total: R\$ 1160/);
  t.stub('#mc1-preco').value = '300'; t.stub('#mc1-milhas').value = '10000'; t.stub('#mc1-bonus').value = '100';
  t.stub('#mc1-ir').onclick();
  assert.match(t.stub('#mc1-res').innerHTML, /R\$ 15 o milheiro/);
  t.stub('#mc2-pontos').value = '10000'; t.stub('#mc2-bonus').value = '100'; t.stub('#mc2-custo').value = '35';
  t.stub('#mc2-ir').onclick();
  assert.match(t.stub('#mc2-res').innerHTML, /20[.,]000 milhas/); assert.match(t.stub('#mc2-res').innerHTML, /R\$ 17\.5 o milheiro/);
  t.stub('#mc3-mensal').value = '42'; t.stub('#mc3-milhas').value = '2000'; t.stub('#mc3-bonus').value = '100'; t.stub('#mc3-ref').value = '20';
  t.stub('#mc3-ir').onclick();
  assert.match(t.stub('#mc3-res').innerHTML, /Vale assinar/); assert.match(t.stub('#mc3-res').innerHTML, /R\$ 38 por mês/);
  t.stub('#mc3-mensal').value = ''; t.stub('#mc3-ir').onclick();
  assert.match(t.stub('#mc3-res').innerHTML, /Diga a mensalidade/);
});

test('aba Viagens: mostra o que compensa, o alerta de emitir e os links; salva e apaga pela API', async () => {
  const viagem = { id: 'v1', origem: 'GRU', destino: 'LIS', data_ida: '2027-02-10', data_volta: '2027-02-24', programa: 'Smiles', milhas: 30000, taxas: 80, preco_dinheiro: 1200 };
  const t = montar('viagens.js', { viagem_listar: { viagens: [viagem] }, pontos_listar: { itens: CARTEIRA } });
  await t.MB.telas.viagens(t.el);
  const h = t.el.innerHTML;
  assert.match(h, /GRU → LIS/); assert.match(h, /10\/02\/2027/);
  assert.match(h, /Compensa usar milhas/); assert.match(h, /R\$ 640/);
  assert.match(h, /Dá para emitir/);
  for (const u of ['smiles.com.br', 'latamairlines.com', 'voeazul.com.br', 'google.com/travel/flights']) assert.ok(h.includes(u), u);
  assert.doesNotMatch(h, /Prumo|Nexia|Fortune/);
  t.stub('#vg-novo').onclick();
  const f = t.forms[0];
  assert.equal(f.aoApagar, null);
  await f.aoSalvar({ origem: 'GRU', destino: 'MIA', data_ida: '2027-03-01', data_volta: '', programa: 'LATAM Pass', preco_dinheiro: '3000', milhas: '80000', taxas: '' });
  const sv = t.chamadas.find((c) => c.acao === 'viagem_salvar');
  assert.equal(sv.dados.preco_dinheiro, 3000); assert.equal(sv.dados.milhas, 80000); assert.equal(sv.dados.taxas, 0); assert.equal(sv.dados.destino, 'MIA');
});

test('aba Viagens: sem milhas suficientes avisa quanto falta; sem viagens mostra orientação', async () => {
  const caro = { id: 'v2', origem: 'GRU', destino: 'NRT', data_ida: '2027-05-01', programa: 'Smiles', milhas: 200000, taxas: 500, preco_dinheiro: 9000 };
  const t = montar('viagens.js', { viagem_listar: { viagens: [caro] }, pontos_listar: { itens: CARTEIRA } });
  await t.MB.telas.viagens(t.el);
  assert.match(t.el.innerHTML, /Faltam 142\.000|Faltam 142000/);
  const v = montar('viagens.js', { viagem_listar: { viagens: [] }, pontos_listar: { itens: [] } });
  await v.MB.telas.viagens(v.el);
  assert.match(v.el.innerHTML, /Cadastre uma viagem/);
});
