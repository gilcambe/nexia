'use strict';
// Contrato: TELAS do Fluxo de caixa, da Carreira e renda e o cartão do Início. Roda o código das telas num `vm`
// com elementos falsos e confere o fluxo (clique -> chamada da API com o corpo certo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');

function montar(respostas, scripts) {
  const chamadas = []; const forms = []; const abertas = []; let recarregou = 0;
  const stubs = {};
  const stub = (sel) => (stubs[sel] = stubs[sel] || { sel, onclick: null, disabled: false });
  const el = { innerHTML: '', querySelector: (s) => (el.innerHTML.includes(`id="${s.slice(1)}"`) ? stub(s) : null), querySelectorAll: () => [] };
  const window = { MB: { telas: {} } };
  const MB = window.MB;
  MB.api = async (acao, dados) => { chamadas.push({ acao, dados }); const r = respostas[acao]; if (r instanceof Error) throw r; return r; };
  MB.abrirAba = (n) => abertas.push(n);
  MB.usuario = () => null;
  MB.ui = { aba() {}, brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s), barra: () => '', recarregar() { recarregou++; }, formulario: (titulo, campos, aoSalvar) => { forms.push({ titulo, campos, aoSalvar }); } };
  MB.graficos = { linha: () => '', barras: () => '', ganhoDoDia: () => null };
  const document = { createElement: () => ({}), body: { appendChild: () => { throw new Error('não deveria carregar script de fora'); } } };
  const ctx = { window, document, console, setTimeout, Promise };
  for (const s of scripts) vm.runInNewContext(ler(s), ctx);
  return { MB, el, stubs, chamadas, forms, abertas, recarregou: () => recarregou };
}

const FLUXO = {
  saldo_conhecido: true, saldo_inicial: 1000, sem_salario_base: false, nota: null, total_entra: 3000, total_sai: 8000, aviso_legal: 'Estimativa: datas futuras.',
  aviso: { semana: 7, inicio: '2027-01-01', fim: '2027-01-07', falta: 500, texto: 'Vai faltar dinheiro na semana 7 (01/01 a 07/01): faltam cerca de R$ 500,00.' },
  semanas: [
    { numero: 1, inicio: '2026-11-20', fim: '2026-11-26', entra: 0, sai: 700, saldo_fim: 300, saldo_minimo: 300, itens: [{ data: '2026-11-25', tipo: 'saida', nome: 'Fatura <Nubank>', valor: 700, estimado: true }] },
    { numero: 7, inicio: '2027-01-01', fim: '2027-01-07', entra: 0, sai: 1500, saldo_fim: -500, saldo_minimo: -500, itens: [{ data: '2027-01-05', tipo: 'saida', nome: 'Aluguel', valor: 1500, estimado: false }] },
  ],
  assinaturas: { itens: [{ nome: 'Netflix', valor_mensal: 39.9, meses: 3, por_ano: 478.8, pergunta: 'Você ainda usa "Netflix"? Cancelar economiza R$ 478,80 por ano.' }], total_mes: 39.9, total_ano: 478.8 },
};

test('aba Fluxo: chama fluxo_visao e mostra semanas, aviso de falta, assinaturas com total por ano e "cancelar?"', async () => {
  const t = montar({ fluxo_visao: FLUXO }, ['fluxo-visao.js', 'fluxo.js']);
  await t.MB.telas.fluxo(t.el);
  assert.deepEqual(t.chamadas.map((c) => c.acao), ['fluxo_visao']);
  const h = t.el.innerHTML;
  assert.match(h, /Vai faltar dinheiro na semana 7/);
  assert.match(h, /Semana 1 · 20\/11 a 26\/11[\s\S]*R\$ 300,00/);
  assert.match(h, /Semana 7[\s\S]*-R\$ 500,00/);
  assert.match(h, /falta dinheiro aqui/);
  assert.match(h, /Fatura &lt;Nubank&gt;/, 'texto escapado');
  assert.doesNotMatch(h, /<Nubank>/);
  assert.match(h, /id="fluxo-assinaturas"[\s\S]*R\$ 478,80 por ano[\s\S]*Cancelar\?/);
  assert.match(h, /estimativa/i);
});

test('aba Fluxo: sem problema mostra confirmação; sem assinaturas diz isso; sem salário base avisa', async () => {
  const t = montar({ fluxo_visao: { ...FLUXO, aviso: null, sem_salario_base: true, nota: 'Cadastre suas contas.', assinaturas: { itens: [], total_mes: 0, total_ano: 0 } } }, ['fluxo-visao.js', 'fluxo.js']);
  await t.MB.telas.fluxo(t.el);
  assert.match(t.el.innerHTML, /saldo não fica negativo/);
  assert.match(t.el.innerHTML, /Informe seu salário base/);
  assert.match(t.el.innerHTML, /Cadastre suas contas/);
  assert.match(t.el.innerHTML, /Não achei gastos que se repetem/);
});

const CARREIRA = {
  perfil: { cargo: 'Analista', area: 'TI', cidade: 'SP', anos_experiencia: 3, taxa_ano: 10, taxa_padrao: true }, salario_atual: 5000,
  patrimonio: { investimentos: 20000, independencia: { gasto_mensal: 2500, alvo: 750000, falta: 730000, anos: 18.5, meses: 222, nota: null }, motivo: null },
  alavancar: { sobra: 1500, taxa_ano: 10, texto: 'Estimativa: rendimento fixo.', cenarios: [{ anos: 1, guardado: 18000, rendimento_total: 18900, juros: 900 }, { anos: 10, guardado: 180000, rendimento_total: 300000, juros: 120000 }] },
  plano: null, aviso: 'Isto é uma estimativa e uma sugestão.',
};

test('aba Carreira: mostra perfil, meta de patrimônio e alavancar; botões chamam a API com o corpo certo', async () => {
  const t = montar({ carreira_visao: CARREIRA, carreira_perfil_salvar: { ok: true }, carreira_plano: { plano: {} } }, ['carreira-visao.js', 'carreira.js']);
  await t.MB.telas.carreira(t.el);
  const h = t.el.innerHTML;
  assert.match(h, /Analista/); assert.match(h, /R\$ 5\.000,00/);
  assert.match(h, /R\$ 750\.000,00/); assert.match(h, /18,5 anos/);
  assert.match(h, /1 ano[\s\S]*R\$ 18\.900,00/); assert.match(h, /10 anos[\s\S]*R\$ 300\.000,00/);
  // editar perfil -> formulário com os valores atuais -> carreira_perfil_salvar
  t.stubs['#car-editar'].onclick();
  const f = t.forms[0];
  assert.deepEqual(Array.from(f.campos, (c) => c.nome), ['cargo', 'area', 'cidade', 'anos_experiencia']);
  assert.equal(f.campos[0].valor, 'Analista');
  await f.aoSalvar({ cargo: 'Líder', area: 'TI', cidade: 'Rio', anos_experiencia: '4' });
  assert.equal(t.chamadas.at(-1).acao, 'carreira_perfil_salvar');
  assert.deepEqual({ ...t.chamadas.at(-1).dados }, { cargo: 'Líder', area: 'TI', cidade: 'Rio', anos_experiencia: '4' });
  // plano da IA
  await t.stubs['#car-plano'].onclick();
  assert.equal(t.chamadas.at(-1).acao, 'carreira_plano');
  assert.equal(t.recarregou(), 1);
  // mudar a taxa
  t.stubs['#car-taxa'].onclick();
  await t.forms[1].aoSalvar({ taxa_ano: '12' });
  assert.equal(t.chamadas.at(-1).acao, 'carreira_perfil_salvar');
  assert.deepEqual({ ...t.chamadas.at(-1).dados }, { taxa_ano: '12' });
});

test('aba Carreira: mostra o plano da IA com aviso de sugestão e valor do aumento; sem sobra não mostra rendimento', async () => {
  const r = { ...CARREIRA, plano: { proximo_cargo: 'Analista Sênior', certificacoes: ['ITIL <1>'], aumento: { pedir_pct: 10, argumento: 'Entreguei X' }, renda_extra: ['Freelance'], aviso: 'Isto é uma estimativa e uma sugestão.' }, alavancar: { sobra: 0, taxa_ano: 10, cenarios: [], texto: 'Neste mês não sobra dinheiro.' } };
  const t = montar({ carreira_visao: r }, ['carreira-visao.js', 'carreira.js']);
  await t.MB.telas.carreira(t.el);
  const h = t.el.innerHTML;
  assert.match(h, /Analista Sênior/); assert.match(h, /ITIL &lt;1&gt;/); assert.match(h, /cerca de 10%[\s\S]*R\$ 500,00 a mais/);
  assert.match(h, /sugestão/); assert.match(h, /Neste mês não sobra dinheiro/);
  assert.doesNotMatch(h, /id="car-taxa"/);
});

test('aba Carreira: erro da IA não derruba a tela (botão volta a ficar ativo)', async () => {
  const t = montar({ carreira_visao: CARREIRA, carreira_plano: new Error('IA fora') }, ['carreira-visao.js', 'carreira.js']);
  await t.MB.telas.carreira(t.el);
  const b = t.stubs['#car-plano']; await b.onclick();
  assert.equal(b.disabled, false); assert.equal(t.recarregou(), 0);
});

test('abas novas estão ligadas: app.js, menu, sw.js (versão subiu) e arquivos existem', () => {
  assert.match(ler('app.js'), /'fluxo', 'carreira'/);
  const html = ler('index.html');
  for (const a of ['fluxo', 'carreira']) assert.match(html, new RegExp(`data-aba="${a}"`));
  assert.match(html, /Fluxo de caixa/); assert.match(html, /Carreira e renda/);
  const sw = ler('sw.js');
  for (const f of ['fluxo', 'fluxo-visao', 'carreira', 'carreira-visao']) assert.match(sw, new RegExp(`'/prumo/${f}\\.js'`));
  assert.ok(Number(/prumo-casca-v(\d+)-kernexfinance/.exec(sw)[1]) >= 30);
  for (const f of ['fluxo', 'carreira']) assert.match(ler(`${f}.js`), new RegExp(`MB\\.telas\\.${f} =`));
  for (const f of ['fluxo-visao.js', 'carreira-visao.js', 'fluxo.js', 'carreira.js', 'inicio.js']) assert.doesNotMatch(ler(f), /window\.MB\s*=\s*\{/, 'nunca recria window.MB');
  for (const f of ['fluxo.js', 'carreira.js', 'fluxo-visao.js', 'carreira-visao.js']) assert.doesNotMatch(ler(f).replace(/\/?prumo\/[\w-]+\.js/g, ''), /Prumo|Nexia|Fortune/i, 'sem marca antiga em texto visível');
});
