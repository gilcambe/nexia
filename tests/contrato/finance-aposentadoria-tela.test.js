'use strict';
// Contrato: aba "Aposentadoria e FGTS". Roda prumo/apos.js e prumo/aposentadoria.js num vm com elementos falsos
// e confere o FLUXO (clique/arquivo -> chamada da API com o corpo certo -> conferência -> salvar).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
function pura() {
  const window = { MB: {} };
  vm.runInNewContext(ler('apos.js'), { window, console });
  assert.ok(window.MB.apos, 'prumo/apos.js define MB.apos sem recriar window.MB');
  return window.MB.apos;
}

const INSS = {
  melhor: 'pedagio_100', mais_cedo: 'pontos', aviso: 'Estimativa com as regras de 2026.',
  parametros: { teto: 8475.55, piso: 1621 }, avisos: ['Servidor público tem regras próprias.'], suposicoes: ['SUPOSIÇÃO: média igual até se aposentar.'],
  perfil: { nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 312, tc_total_meses: 396, media_salarial: 4000, vinculos: 0 },
  regras: [
    { id: 'pontos', nome: 'Pontos', cumpre_em: '2026-11-17', ja_cumpre: true, idade_na_data: 60.9, coeficiente_pct: 96, beneficio: 3840, limitado: null, fator_previdenciario: null, explica: 'Idade + tempo.' },
    { id: 'pedagio_100', nome: 'Pedágio de 100%', cumpre_em: '2027-12-01', ja_cumpre: false, idade_na_data: 61.9, coeficiente_pct: 100, beneficio: 4000, limitado: null, fator_previdenciario: null, explica: '57 anos.' },
    { id: 'idade', nome: 'Regra por idade', cumpre_em: null, ja_cumpre: false, beneficio: null, explica: 'x <b>y</b>' },
  ],
};
const VISAO = {
  aviso: 'x', inss: INSS, faltando: [],
  fgts: { saldo: 20000, deposito_mensal: 400, deposito_de: 'salario', tr_pct: 0, premissa: 'Rendimento de 3% ao ano + TR (0% ao ano).',
    projecao: [{ anos: 1, saldo: 25465.6 }, { anos: 5, saldo: 52000 }, { anos: 10, saldo: 90000 }, { anos: 20, saldo: 200000 }],
    comparacao: { aniversario: { saque_este_ano: 4400, aliquota_pct: 5, parcela_adicional: 2900, se_demitido_hoje: { saca_agora: 8000, saldo_bloqueado: 15600 } }, rescisao: { se_demitido_hoje: { saca_agora: 28000 } }, dica: 'Dica.', suposicao: 'SUPOSIÇÃO: multa sobre o saldo.' } },
  quanto_guardar: { renda_desejada: 8000, inss_estimado: 4000, inss_regra: 'Pedágio de 100%', gap_mensal: 4000, investimentos_hoje: 100000, fgts_na_data: 30000, anos_ate_aposentar: 1.1, aporte_mensal_necessario: 6000.5, avisos: ['O FGTS é um saque único, não renda mensal: entra só como patrimônio.'], independencia: { alvo: 1200000, falta: 1070000, nota: null } },
};

test('cartão INSS: cada regra com data e valor, destaque "a melhor para você", escapa texto', () => {
  const h = pura().cartaoInss(INSS);
  assert.match(h, /id="apo-inss"/);
  assert.match(h, /Pontos[\s\S]*Você já cumpre[\s\S]*R\$\s3\.840,00/);
  assert.match(h, /Pedágio de 100%[\s\S]*a melhor para você[\s\S]*01\/12\/2027[\s\S]*R\$\s4\.000,00/);
  assert.equal((h.match(/a melhor para você/g) || []).length, 1);
  assert.match(h, /Não cumpre nos próximos 50 anos/);
  assert.match(h, /R\$\s8\.475,55/); assert.match(h, /estimativa/i); assert.match(h, /SUPOSIÇÃO/);
  assert.doesNotMatch(h, /<b>y<\/b>/, 'texto da regra é escapado');
  assert.doesNotMatch(h, /Prumo|Nexia|Fortune/);
  assert.match(pura().cartaoInss(null), /Informe seus dados/);
});

test('cartão FGTS, previdência e quanto guardar mostram os números do servidor', () => {
  const A = pura();
  const f = A.cartaoFgts(VISAO.fgts);
  assert.match(f, /R\$\s20\.000,00/); assert.match(f, /Daqui a 5 anos[\s\S]*R\$\s52\.000,00/); assert.match(f, /Saque-aniversário[\s\S]*R\$\s4\.400,00/); assert.match(f, /demitido hoje/);
  assert.match(A.cartaoFgts(null), /Informe o saldo/);
  const g = A.cartaoGuardar(VISAO.quanto_guardar);
  assert.match(g, /Falta cobrir[\s\S]*R\$\s4\.000,00/); assert.match(g, /R\$\s1\.200\.000,00/); assert.match(g, /R\$\s6\.000,50/);
  const pv = A.cartaoPrev({ acumulado: { anos: 20, bruto: 240000 }, pgbl_ou_vgbl: { recomendacao: 'PGBL', motivo: 'Abate no IR.', limite_dedutivel_anual: 14400, economia_ir_anual: 3960 },
    tabelas: { regressiva: { aliquota_pct: 10, imposto_pgbl: 24000, imposto_vgbl: 0 }, progressiva: { imposto_total_pgbl: 0, imposto_total_vgbl: 0 }, menor_imposto_pgbl: 'progressiva', menor_imposto_vgbl: 'regressiva', dica: 'd' },
    quanto_aportar: { renda_alvo: 2000, anos_receber: 20, capital_necessario: 480000, aporte_mensal: 2000 }, suposicoes: ['SUPOSIÇÃO: taxa real.'], aviso: 'Estimativa.' });
  assert.match(pv, /PGBL/); assert.match(pv, /R\$\s14\.400,00/); assert.match(pv, /R\$\s480\.000,00/); assert.match(pv, /Regressiva \(10%\)/);
});

test('formulários: perfil converte anos+meses em meses, FGTS, previdência e quanto guardar', () => {
  const A = pura();
  const c = A.camposPerfil({ nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 314, tc_total_meses: 400, media_salarial: 4000 });
  const por = (nome) => c.find((x) => x.nome === nome);
  assert.equal(por('nascimento').tipo, 'date'); assert.equal(por('nascimento').valor, '1966-01-01');
  assert.match(por('sexo').opcoes, /value="F" selected/);
  assert.equal(por('tc2019_anos').valor, 26); assert.equal(por('tc2019_meses').valor, 2);
  assert.equal(por('total_anos').valor, 33); assert.equal(por('total_meses').valor, 4);
  const corpo = A.corpoPerfil({ nascimento: '1966-01-01', sexo: 'F', tc2019_anos: '26', tc2019_meses: '2', total_anos: '33', total_meses: '4', media_salarial: '4000' }, { vinculos: [{ empresa: 'A' }] });
  assert.deepEqual({ ...corpo }, { nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 314, tc_total_meses: 400, media_salarial: 4000, vinculos: [{ empresa: 'A' }] });
  assert.equal('media_salarial' in A.corpoPerfil({ nascimento: 'x', sexo: 'M', tc2019_anos: 0, total_anos: 0, media_salarial: '' }), false);
  assert.deepEqual({ ...A.corpoFgts({ saldo: '1000', deposito_mensal: '', tr_pct: '0.5', modalidade: 'aniversario' }) }, { saldo: 1000, tr_pct: 0.5, modalidade: 'aniversario' });
  assert.equal(A.corpoPrev({ renda_bruta_anual: '120000', declaracao_completa: 'sim', anos: '20' }).declaracao_completa, true);
  assert.equal(A.corpoPrev({ renda_bruta_anual: '120000', declaracao_completa: 'nao', anos: '20' }).declaracao_completa, false);
  assert.deepEqual({ ...A.corpoGuardar({ renda_desejada: '8000', aporte: '', taxa_ano: '8' }) }, { renda_desejada: 8000, taxa_ano: 8 });
  assert.deepEqual({ ...A.corpoImovel({ saldo_devedor: '100000', prazo_meses: '100', taxa_ano: '' }) }, { saldo_devedor: 100000, prazo_meses: 100, taxa_ano: 0 });
});

// ---------- Fluxo: roda prumo/aposentadoria.js ----------
function montarTela(respostas = {}) {
  const chamadas = []; const forms = []; const avisos = []; const pdfs = [];
  const stubs = {};
  const stub = (sel) => (stubs[sel] = stubs[sel] || { sel, onclick: null, onchange: null, innerHTML: '', files: [], click() {} });
  const el = { innerHTML: '', querySelector: stub, querySelectorAll: () => [], appendChild() {} };
  const window = { MB: { telas: {} } };
  const MB = window.MB;
  MB.api = async (acao, dados) => {
    chamadas.push({ acao, dados });
    if (acao === 'apos_visao') return respostas.visao || VISAO;
    if (respostas[acao]) return respostas[acao];
    return { ok: true };
  };
  const reduzir = async (f) => `R:${f.name}`;
  const esc = (s) => String(s == null ? '' : s);
  MB.ui = { aba() {}, brl: (v) => `R$ ${v}`, esc, hoje: () => '2026-11-17', opcoes: () => '', barra: () => '', reduzir, recarregar() {}, ok: (m) => { avisos.push(m); },
    formulario: (titulo, campos, aoSalvar) => { forms.push({ titulo, campos, aoSalvar }); } };
  MB.pdf = { MAX: 5, paraImagens: async (arqs, red) => { pdfs.push(arqs); const imagens = []; for (const a of arqs) { if (/\.pdf$/.test(a.name)) imagens.push(`P1:${a.name}`, `P2:${a.name}`); else imagens.push(await red(a)); } return { imagens, cortou: false }; } };
  const document = { createElement: () => ({}), body: { appendChild: (s) => { if (s.onload) setTimeout(s.onload, 0); } } };
  const ctx = { window, document, console, setTimeout, clearTimeout, Promise };
  vm.runInNewContext(ler('apos.js'), ctx);
  vm.runInNewContext(ler('aposentadoria.js'), ctx);
  return { MB, el, stub, chamadas, forms, avisos, pdfs };
}
const espera = () => new Promise((r) => setTimeout(r, 30));
const campo = (campos, nome) => campos.find((c) => c.nome === nome);

test('a aba abre: chama apos_visao e desenha INSS, FGTS e quanto guardar', async () => {
  const t = montarTela();
  await t.MB.telas.aposentadoria(t.el);
  assert.ok(t.chamadas.find((c) => c.acao === 'apos_visao'));
  for (const id of ['apo-inss', 'apo-fgts', 'apo-prev', 'apo-guardar', 'apo-cnis', 'apo-arq', 'apo-perfil']) assert.match(t.el.innerHTML, new RegExp(`id="${id}"`), id);
  assert.match(t.el.innerHTML, /a melhor para você/);
  assert.doesNotMatch(t.el.innerHTML, /Prumo|Nexia|Fortune/);
});

test('fluxo CNIS: PDF + foto viram imagens juntos, a IA lê, a pessoa confere e só então salva', async () => {
  const resumo = { vinculos: [{ empresa: 'A', inicio: '2010-01-01', fim: '2012-12-31' }], tc_total_meses: 148, tc_2019_meses: 64, media_salarial: 3000, contribuicoes_lidas: 2, alertas: ['Vínculo "C" está sem data de saída.'] };
  const t = montarTela({ apos_cnis_ler: { lidos: [{ ok: true }, { ok: true }, { ok: false, erro: 'x' }], resumo } });
  await t.MB.telas.aposentadoria(t.el);
  t.stub('#apo-cnis').onclick();
  const arq = t.stub('#apo-arq');
  arq.files = [{ name: 'cnis.pdf' }, { name: 'pagina.png' }];
  await arq.onchange(); await espera();
  assert.equal(t.pdfs.length, 1); assert.equal(t.pdfs[0].length, 2, 'os 2 arquivos juntos');
  const ler1 = t.chamadas.find((c) => c.acao === 'apos_cnis_ler');
  assert.deepEqual([...ler1.dados.imagens], ['P1:cnis.pdf', 'P2:cnis.pdf', 'R:pagina.png']);
  assert.ok(t.avisos.some((m) => /1 imagem/.test(String(m))), 'avisa quantas não deu para ler');
  assert.match(t.stub('#apo-alertas').innerHTML, /sem data de saída/);
  assert.equal(t.chamadas.some((c) => c.acao === 'apos_perfil_salvar'), false, 'não salva antes de conferir');
  const f = t.forms.find((x) => /Confira/.test(x.titulo));
  assert.ok(f, 'abre o formulário de conferência');
  assert.equal(campo(f.campos, 'nascimento').valor, '1966-01-01', 'mantém o que já tinha');
  assert.equal(campo(f.campos, 'tc2019_anos').valor, 5); assert.equal(campo(f.campos, 'tc2019_meses').valor, 4); // 64 meses
  assert.equal(campo(f.campos, 'total_anos').valor, 12); assert.equal(campo(f.campos, 'media_salarial').valor, 3000);
  await f.aoSalvar({ nascimento: '1966-01-01', sexo: 'F', tc2019_anos: '5', tc2019_meses: '4', total_anos: '12', total_meses: '4', media_salarial: '3000' });
  const s = t.chamadas.find((c) => c.acao === 'apos_perfil_salvar');
  assert.ok(s, 'salvou com apos_perfil_salvar');
  assert.equal(s.dados.tc_2019_meses, 64); assert.equal(s.dados.tc_total_meses, 148); assert.equal(s.dados.media_salarial, 3000);
  assert.equal(s.dados.vinculos.length, 1, 'manda os vínculos lidos');
});

test('fluxo meus dados, FGTS e FGTS por print', async () => {
  const t = montarTela({ fgts_salvar: { salvo: false, lidos: [{ ok: true, saldo: 12345.67, modalidade: 'aniversario' }] } });
  await t.MB.telas.aposentadoria(t.el);
  t.stub('#apo-perfil').onclick();
  assert.equal(campo(t.forms[0].campos, 'nascimento').valor, '1966-01-01');
  await t.forms[0].aoSalvar({ nascimento: '1966-01-01', sexo: 'F', tc2019_anos: '26', tc2019_meses: '0', total_anos: '33', total_meses: '0', media_salarial: '4000' });
  const s = t.chamadas.find((c) => c.acao === 'apos_perfil_salvar');
  assert.equal(s.dados.tc_2019_meses, 312); assert.equal('vinculos' in s.dados, false);
  t.stub('#apo-fgts-btn').onclick();
  const ff = t.forms[t.forms.length - 1];
  assert.equal(campo(ff.campos, 'saldo').valor, 20000);
  await ff.aoSalvar({ saldo: '25000', deposito_mensal: '', tr_pct: '0', modalidade: 'rescisao' });
  assert.deepEqual({ ...t.chamadas.filter((c) => c.acao === 'fgts_salvar').pop().dados }, { saldo: 25000, tr_pct: 0, modalidade: 'rescisao' });
  // print do FGTS
  t.stub('#apo-fgts-print').onclick();
  const arq = t.stub('#apo-fgts-arq');
  arq.files = [{ name: 'fgts.png' }];
  await arq.onchange(); await espera();
  const lido = t.chamadas.filter((c) => c.acao === 'fgts_salvar').find((c) => c.dados.imagens);
  assert.deepEqual([...lido.dados.imagens], ['R:fgts.png']);
  const conf = t.forms[t.forms.length - 1];
  assert.match(conf.titulo, /Confira/); assert.equal(campo(conf.campos, 'saldo').valor, 12345.67);
  assert.match(campo(conf.campos, 'modalidade').opcoes, /value="aniversario" selected/);
});

test('fluxo previdência e quanto guardar: o pedido vai com o corpo certo e a aba é redesenhada com o resultado', async () => {
  const prev = { acumulado: { anos: 20, bruto: 240000 }, pgbl_ou_vgbl: { recomendacao: 'PGBL', motivo: 'm', limite_dedutivel_anual: 14400, economia_ir_anual: 3960 },
    tabelas: { regressiva: { aliquota_pct: 10, imposto_pgbl: 1, imposto_vgbl: 1 }, progressiva: { imposto_total_pgbl: 1, imposto_total_vgbl: 1 }, menor_imposto_pgbl: 'regressiva', menor_imposto_vgbl: 'regressiva', dica: 'd' }, suposicoes: [], aviso: 'a' };
  const t = montarTela({ prev_simular: prev });
  await t.MB.telas.aposentadoria(t.el);
  t.stub('#apo-prev-btn').onclick();
  await t.forms[0].aoSalvar({ renda_bruta_anual: '120000', declaracao_completa: 'sim', aporte_mensal: '1000', saldo_atual: '0', anos: '20', taxa_real_ano: '4', renda_alvo: '2000', outras_rendas_mensais: '0' });
  const c = t.chamadas.find((x) => x.acao === 'prev_simular');
  assert.equal(c.dados.renda_bruta_anual, 120000); assert.equal(c.dados.declaracao_completa, true); assert.equal(c.dados.anos, 20); assert.equal(c.dados.renda_alvo, 2000);
  await t.MB.telas.aposentadoria(t.el); // recarregar
  assert.match(t.el.innerHTML, /PGBL ou VGBL\?/, 'o resultado da simulação continua na tela');
  t.stub('#apo-guardar-btn').onclick();
  await t.forms[t.forms.length - 1].aoSalvar({ renda_desejada: '8000', aporte: '500', taxa_ano: '8', inflacao_ano: '4' });
  t.chamadas.length = 0;
  t.stub('#apo-imovel').onclick();
  await t.forms[t.forms.length - 1].aoSalvar({ saldo_devedor: '100000', prazo_meses: '100', taxa_ano: '9' });
  await t.MB.telas.aposentadoria(t.el);
  const v = t.chamadas.find((x) => x.acao === 'apos_visao').dados;
  assert.equal(v.renda_desejada, 8000); assert.equal(v.aporte, 500); assert.deepEqual({ ...v.imovel }, { saldo_devedor: 100000, prazo_meses: 100, taxa_ano: 9 });
});

test('aba registrada: app.js, menu e cache do app', () => {
  assert.match(ler('app.js'), /'aposentadoria'[,\]]/);
  assert.match(ler('index.html'), /data-aba="aposentadoria"[^>]*>[\s\S]*?Aposentadoria e FGTS<\/button>/);
  const sw = ler('sw.js');
  assert.match(sw, /'\/prumo\/aposentadoria\.js'/); assert.match(sw, /'\/prumo\/apos\.js'/);
});
