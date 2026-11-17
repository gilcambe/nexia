'use strict';
// Kernex Finance: TELAS do score no Início, da saúde financeira sempre visível e do "preencher por print" em
// Contas, Cartões e Dívidas. Roda o código das telas num vm, com as respostas REAIS do servidor (p.agir + banco falso).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p = require('../../netlify/functions/prumo.js');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (n) => col(`${caminho}/${id}/${n}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
  });
  return { collection: col, dados };
}
const IMG = (n) => `data:image/png;base64,${Buffer.from('img' + n).toString('base64')}`;

// Ambiente: a "API" da tela chama o servidor de verdade (p.agir) com banco falso e IA falsa.
function ambiente(respostasIA) {
  const banco = bancoFalso(); const pedidos = [];
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  p.deps.perguntarVisao = async (img, sistema) => { pedidos.push({ img, sistema }); const r = respostasIA.shift(); return typeof r === 'string' ? r : JSON.stringify(r); };
  const chamadas = []; const forms = []; const avisos = []; const els = {}; const scripts = [];
  const stub = (sel) => (els[sel] = els[sel] || { sel, onclick: null, onchange: null, dataset: {}, files: [], value: '', click() { this.clicado = true; }, innerHTML: '' });
  const el = {
    innerHTML: '', pos: '',
    querySelector(sel) { const id = sel.startsWith('#') ? sel.slice(1) : null; if (id && !this.innerHTML.includes(`id="${id}"`) && !this.pos.includes(`id="${id}"`)) return null; return stub(sel); },
    querySelectorAll: () => [], addEventListener() {},
    insertAdjacentHTML(_onde, h) { this.pos += h; },
  };
  const window = { MB: { telas: {} } };
  const MB = window.MB;
  MB.api = async (acao, dados) => {
    chamadas.push({ acao, dados });
    if (acao === 'historico_listar') return { meses: [] };
    if (acao === 'cotacoes_vivas') return { itens: [] };
    const r = await p.agir('u1', { acao, ...(dados || {}) });
    if (r[0] !== 200) throw new Error(r[1].error);
    return r[1];
  };
  MB.ui = { aba() {}, brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s), TIPOS: {}, CATS: {}, hoje: () => '2026-11-20', opcoes: (m, sel) => Object.entries(m).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join(''), barra: () => '',
    formulario: (titulo, campos, aoSalvar, aoApagar) => { forms.push({ titulo, campos, aoSalvar, aoApagar }); }, reduzir: async (f) => IMG(f.name), recarregar() {}, ok: (m) => { avisos.push(m); } };
  MB.pdf = { paraImagens: async (arqs, red) => { const imagens = []; for (const a of arqs) imagens.push(await red(a)); return { imagens }; } };
  MB.usuario = () => ({ displayName: 'Ana Souza' });
  MB.abrirAba = () => {};
  const document = { createElement: () => ({}), body: { appendChild: (s) => { scripts.push(s.src); try { rodar(s.src.replace('/prumo/', '')); } catch (e) { if (s.onerror) return setTimeout(s.onerror, 0); } if (s.onload) setTimeout(s.onload, 0); } }, querySelector: () => null };
  const ctx = { window, document, console, setTimeout, clearTimeout, Promise, Date };
  vm.createContext(ctx);
  function rodar(f) { return vm.runInContext(ler(f), ctx); }
  return { MB, el, els, chamadas, forms, avisos, pedidos, banco, rodar, scripts };
}
const ARQ = (nome) => ({ name: nome });

test('Início: cartão de score + saúde parcial com próximo passo, mesmo numa conta vazia', async () => {
  const a = ambiente([]);
  a.rodar('score.js'); a.rodar('inicio.js');
  await a.MB.telas.inicio(a.el);
  assert.match(a.el.innerHTML, /id="kf-saude"/);
  assert.match(a.el.innerHTML, /Saúde financeira \(parcial\)/);
  assert.match(a.el.innerHTML, /faltam 3 indicadores/);
  assert.match(a.el.innerHTML, /👉 /, 'mostra o próximo passo');
  assert.match(a.el.innerHTML, /id="score-cartao"/);
  assert.match(a.el.innerHTML, /Ainda não tenho seu score/);
  assert.match(a.el.innerHTML, /📷 Atualizar score/);
  assert.ok(a.el.innerHTML.indexOf('id="kf-saude"') < a.el.innerHTML.indexOf('kf-hero'), 'saúde fica no topo');
});

test('Início: depois de salvar scores, mostra o último de cada birô, a faixa, a variação e 3 dicas', async () => {
  const a = ambiente([]);
  for (const [biro, score, data] of [['serasa', 600, '2026-10-01'], ['serasa', 650, '2026-11-01'], ['spc', 380, '2026-11-05']]) await p.agir('u1', { acao: 'score_salvar', biro, score, data });
  a.rodar('score.js'); a.rodar('inicio.js');
  await a.MB.telas.inicio(a.el);
  const h = a.el.innerHTML;
  assert.match(h, /Serasa[\s\S]*01\/11\/2026[\s\S]*▲ \+50 desde o anterior[\s\S]*650[\s\S]*bom/);
  assert.match(h, /SPC[\s\S]*380[\s\S]*regular[\s\S]*faixa estimada/);
  assert.doesNotMatch(h, /Boa Vista/);
  assert.equal((h.match(/• /g) || []).length, 3, '3 dicas');
});

test('Início: "Atualizar score" lê o print (imagens juntas), abre o formulário preenchido e salva com score_salvar', async () => {
  const a = ambiente([{ biro: 'serasa', score: 712, data: '2026-11-18' }, 'ilegível']);
  a.rodar('score.js'); a.rodar('inicio.js');
  await a.MB.telas.inicio(a.el);
  const arq = a.els['#score-arq'];
  a.els['#score-atualizar'].onclick();
  assert.ok(arq.clicado, 'o botão abre o seletor de arquivo');
  arq.files = [ARQ('a.png'), ARQ('b.pdf')];
  await arq.onchange({ target: { files: arq.files } });
  assert.deepEqual(a.chamadas.find((c) => c.acao === 'score_print_ler').dados.imagens, [IMG('a.png'), IMG('b.pdf')]);
  assert.equal(a.avisos.length, 1, 'avisa quantos não deu para ler');
  assert.equal(a.forms.length, 1, 'um formulário para o lido ok');
  const f = a.forms[0];
  assert.equal(f.titulo, 'Confira o score');
  assert.equal(f.campos.find((c) => c.nome === 'score').valor, 712);
  assert.equal(f.campos.find((c) => c.nome === 'data').valor, '2026-11-18');
  assert.match(f.campos.find((c) => c.nome === 'biro').opcoes, /value="serasa" selected/);
  await f.aoSalvar({ biro: 'serasa', score: '715', data: '2026-11-18' });
  const salvo = a.chamadas.filter((c) => c.acao === 'score_salvar').pop();
  assert.deepEqual(JSON.parse(JSON.stringify(salvo.dados)), { biro: 'serasa', score: 715, data: '2026-11-18' });
  const lista = await p.agir('u1', { acao: 'score_listar' });
  assert.equal(lista[1].por_biro.serasa.score, 715);
});

test('Início: "Digitar" abre formulário vazio; sem os botões desenhados nada quebra', async () => {
  const a = ambiente([]);
  a.rodar('score.js'); a.rodar('inicio.js');
  await a.MB.telas.inicio(a.el);
  a.els['#score-digitar'].onclick();
  assert.equal(a.forms[0].titulo, 'Digite seu score');
  const sem = { innerHTML: '', querySelector: () => null };
  assert.doesNotThrow(() => a.MB.score.ligar(sem, { api: a.MB.api, pdf: a.MB.pdf, reduzir: a.MB.ui.reduzir, formulario: a.MB.ui.formulario, ok: a.MB.ui.ok }));
});

test('Contas: botão de print lê o saldo, abre o MESMO formulário preenchido e salva com conta_salvar (atualiza a conta que já existe)', async () => {
  const a = ambiente([{ nome: 'Nubank', instituicao: 'Nubank', saldo: 'R$ 2.500,10', tipo: 'corrente' }]);
  const existente = await p.agir('u1', { acao: 'conta_salvar', nome: 'Nubank', tipo: 'corrente', saldo: 100, moeda: 'BRL' });
  a.rodar('contas.js');
  await a.MB.telas.contas(a.el);
  assert.match(a.el.pos, /id="ct-ler"/);
  const arq = a.els['#ct-ler-arq'];
  a.els['#ct-ler'].onclick();
  assert.ok(arq.clicado);
  arq.files = [ARQ('saldo.png')];
  await arq.onchange({ target: { files: arq.files } });
  assert.equal(a.chamadas.find((c) => c.acao === 'conta_print_ler').dados.imagens.length, 1);
  const f = a.forms.pop();
  assert.equal(f.titulo, 'Confira a conta');
  assert.equal(f.campos.find((c) => c.nome === 'saldo').valor, 2500.1);
  assert.equal(f.campos.find((c) => c.nome === 'nome').valor, 'Nubank');
  await f.aoSalvar({ nome: 'Nubank', tipo: 'corrente', instituicao: 'Nubank', saldo: '2500.10', moeda: 'BRL' });
  const salvo = a.chamadas.find((c) => c.acao === 'conta_salvar');
  assert.equal(salvo.dados.id, existente[1].id, 'atualiza a conta que já existe, sem duplicar');
  const l = await p.agir('u1', { acao: 'conta_listar' });
  assert.equal(l[1].contas.length, 1);
  assert.equal(l[1].contas[0].saldo, 2500.1);
});

test('Dívidas: print do contrato vira formulário preenchido; salva com divida_salvar e a dívida aparece na lista', async () => {
  const a = ambiente([{ credor: 'Banco X', tipo: 'emprestimo', saldo: 12000, parcela: 450, juros_mes: 2.5, cet_ano: 40, dia_vencimento: 5 }]);
  a.rodar('dividas.js');
  await a.MB.telas.dividas(a.el);
  assert.match(a.el.pos, /id="dv-ler"/);
  const arq = a.els['#dv-ler-arq'];
  arq.files = [ARQ('contrato.pdf')];
  await arq.onchange({ target: { files: arq.files } });
  const f = a.forms.pop();
  assert.equal(f.titulo, 'Confira a dívida');
  const v = (n) => f.campos.find((c) => c.nome === n).valor;
  assert.deepEqual([v('credor'), v('saldo'), v('parcela'), v('juros_mes'), v('cet_ano'), v('dia_vencimento')], ['Banco X', 12000, 450, 2.5, 40, 5]);
  await f.aoSalvar({ credor: 'Banco X', tipo: 'emprestimo', saldo: '12000', juros_mes: '2.5', parcela: '450', cet_ano: '40', dia_vencimento: '5' });
  const l = await p.agir('u1', { acao: 'divida_listar' });
  assert.equal(l[1].dividas.length, 1);
  assert.equal(l[1].dividas[0].credor, 'Banco X');
  assert.equal(l[1].dividas[0].saldo, 12000);
});

test('Cartões: sem cartão, o print da fatura cria o cartão; com cartão do mesmo nome, atualiza sem perder os outros campos', async () => {
  const lido = { nome: 'Roxinho', bandeira: 'Mastercard', limite: 8000, fatura_atual: 1520.9, dia_vencimento: 10, dia_fechamento: 3 };
  const a = ambiente([lido]);
  a.rodar('cartoes.js');
  await a.MB.telas.cartoes(a.el);
  assert.match(a.el.pos, /id="ca-ler"/, 'o botão aparece mesmo sem cartão');
  const arq = a.els['#ca-ler-arq'];
  arq.files = [ARQ('fatura.pdf')];
  await arq.onchange({ target: { files: arq.files } });
  assert.ok(a.avisos.some((m) => /Fatura lida: R\$ 1520.9/.test(m)));
  let f = a.forms.pop();
  assert.equal(f.titulo, 'Confira o cartão');
  assert.equal(f.campos.find((c) => c.nome === 'limite').valor, 8000);
  await f.aoSalvar({ nome: 'Roxinho', bandeira: 'Mastercard', limite: '8000', dia_fechamento: '3', dia_vencimento: '10' });
  let cartoes = (await p.agir('u1', { acao: 'cartao_listar' }))[1].cartoes;
  assert.equal(cartoes.length, 1);
  // segunda leitura: o cartão já existe, com anuidade; a anuidade não pode sumir
  const id = cartoes[0].id;
  await p.agir('u1', { acao: 'cartao_salvar', id, nome: 'Roxinho', limite: 8000, dia_fechamento: 3, dia_vencimento: 10, anuidade: 300 });
  const b = ambiente([{ ...lido, limite: 9000 }]);
  b.banco.dados.clear();
  p.deps.db = () => a.banco;
  b.rodar('cartoes.js');
  await b.MB.telas.cartoes(b.el);
  const arq2 = b.els['#ca-ler-arq'];
  arq2.files = [ARQ('fatura2.png')];
  await arq2.onchange({ target: { files: arq2.files } });
  f = b.forms.pop();
  assert.equal(f.campos.find((c) => c.nome === 'limite').valor, 9000);
  await f.aoSalvar({ nome: 'Roxinho', bandeira: 'Mastercard', limite: '9000', dia_fechamento: '3', dia_vencimento: '10' });
  cartoes = (await p.agir('u1', { acao: 'cartao_listar' }))[1].cartoes;
  assert.equal(cartoes.length, 1, 'não duplicou');
  assert.equal(cartoes[0].limite, 9000);
  assert.equal(cartoes[0].anuidade, 300, 'manteve a anuidade');
});

test('arquivos novos estão na casca do service worker e o MB não é recriado', () => {
  const sw = ler('sw.js');
  assert.match(sw, /'\/prumo\/leitura\.js'/);
  assert.match(sw, /'\/prumo\/score\.js'/);
  for (const f of ['leitura.js', 'score.js', 'inicio.js', 'contas.js', 'cartoes.js', 'dividas.js']) assert.doesNotMatch(ler(f), /window\.MB\s*=\s*\{/, `${f} não recria window.MB`);
});
