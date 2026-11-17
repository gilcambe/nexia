'use strict';
/**
 * Kernex Finance: Fluxo de caixa (90 dias, por semana), assinaturas, e Carreira e renda.
 * Chamado por agirExtra (extra.js). Devolve null se a ação não for daqui.
 * Ações: fluxo_visao, carreira_perfil_salvar, carreira_plano (IA grátis), carreira_visao.
 * Tudo aqui é ESTIMATIVA. Regras incertas estão marcadas com SUPOSIÇÃO.
 */
const folha = require('./folha');
const cartoes = require('./cartoes');
const motor = require('./motor');

const MES = /^\d{4}-\d{2}$/;
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const AVISO = 'Isto é uma estimativa e uma sugestão, não uma promessa. Confira com um profissional antes de decidir.';
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const r2 = (n) => Math.round(n * 100) / 100;
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b\d+\s*\/\s*\d+\b/g, '').replace(/[^a-z0-9]/g, '');

// ---------- datas (tudo em UTC, texto AAAA-MM-DD) ----------
const diasNoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate(); // mes 1..12
const mesDe = (iso) => String(iso).slice(0, 7);
function somarMes(mes, n) { const [a, m] = mes.split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }
function dataNoMes(mes, dia) { const [a, m] = mes.split('-').map(Number); return `${mes}-${String(Math.min(Math.max(1, dia), diasNoMes(a, m))).padStart(2, '0')}`; }
function somarDias(iso, n) { return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10); }
const diffDias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const diffMeses = (a, b) => { const [x, y] = a.split('-').map(Number); const [z, w] = b.split('-').map(Number); return (z * 12 + w) - (x * 12 + y); };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ---------- leitura dos dados ----------
async function carregar(c) {
  const { base, listar } = c;
  const lerDoc = async (col, id) => { const s = await base.collection(col).doc(id).get(); return s && s.exists ? s.data() || {} : {}; };
  const [cfg, carreira, orcDoc, pagamentos, pontos, cartoesL, gastos, dividas, contas, lancs, objetivos, carteira] = await Promise.all([
    lerDoc('config', 'salario'), lerDoc('config', 'carreira'), lerDoc('orcamento', 'atual'),
    listar(base.collection('pagamentos')), listar(base.collection('pontos')), listar(base.collection('cartoes')), listar(base.collection('gastos')),
    listar(base.collection('dividas')), listar(base.collection('contas')), listar(base.collection('lancamentos')), listar(base.collection('objetivos')),
    c.listarCarteira(),
  ]);
  return { cfg, carreira, orc: { fixas: [], guardar: [], limites: {}, renda_extra: 0, ...orcDoc }, pagamentos, pontos, cartoes: cartoesL, gastos, dividas, contas, lancs: lancs.filter((x) => x.perfil !== 'pj'), objetivos, carteira };
}

// ---------- salário ----------
/** Previsão de uma competência (mês) com o que já foi recebido e o ponto dela. */
function previsaoMes(d, mes, recebidosExtra) {
  const cfg = d.cfg || {};
  if (!(cfg.salario_base > 0)) return null;
  const recebidos = [...d.pagamentos.filter((p) => p.mes === mes), ...(recebidosExtra || [])];
  const ponto = d.pontos.find((p) => p.id === mes) || {};
  return folha.estimarFechamento({ mes, salario_base: cfg.salario_base, dependentes: cfg.dependentes || 0, jornada_mensal: cfg.jornada_mensal || 220, ponto, recebidos });
}
/** Aprende o padrão do último pagamento do tipo: dia do mês e se cai no mês seguinte à competência. */
function padrao(pagamentos, tipo) {
  const l = pagamentos.filter((p) => p.tipo === tipo && DIA_ISO.test(String(p.data_pagamento))).sort((a, b) => String(b.data_pagamento).localeCompare(String(a.data_pagamento)))[0];
  if (!l) return null;
  return { dia: Number(l.data_pagamento.slice(8, 10)), deslocamento: Math.max(0, Math.min(1, diffMeses(l.mes, mesDe(l.data_pagamento)))), valor: Number(l.liquido) || 0 };
}
/** Valor líquido estimado do 13º inteiro: base − INSS − IRRF (IRRF do 13º é separado). SUPOSIÇÃO: sem médias de horas extras. */
function decimoTerceiro(base, dependentes) {
  const i = folha.inss(base);
  const ir = folha.irrf({ rendimento: base, inss: i, dependentes: dependentes || 0 });
  const liquido = r2(base - i - ir);
  return { primeira: r2(base / 2), liquido, segunda: r2(liquido - r2(base / 2)) };
}

// ---------- eventos do fluxo ----------
function eventos(d, hoje, dias) {
  const fim = somarDias(hoje, dias); // exclusivo
  const dentro = (iso) => iso >= hoje && iso < fim;
  const out = [];
  const add = (data, tipo, categoria, nome, valor, estimado) => { if (dentro(data) && valor > 0) out.push({ data, tipo, categoria, nome, valor: r2(valor), estimado: !!estimado }); };
  const cfg = d.cfg || {};
  const NOMES = { mensal: 'Salário do mês', adiantamento: 'Adiantamento', decimo_terceiro_1: '13º (1ª parcela)', decimo_terceiro_2: '13º (2ª parcela)', ferias: 'Férias', plr: 'PLR', outro: 'Outro recebimento' };
  const CATEG = { mensal: 'salario', adiantamento: 'adiantamento', decimo_terceiro_1: '13o', decimo_terceiro_2: '13o', ferias: 'ferias', plr: 'plr', outro: 'outro' };

  // 1) Recebimentos já lançados com data de hoje em diante (valem como são).
  for (const p of d.pagamentos) if (DIA_ISO.test(String(p.data_pagamento))) add(p.data_pagamento, 'entrada', CATEG[p.tipo] || 'outro', NOMES[p.tipo] || 'Recebimento', Number(p.liquido) || 0, false);

  // 2) Projeções (só com salário base informado).
  if (cfg.salario_base > 0) {
    const pAd = padrao(d.pagamentos, 'adiantamento');
    const pMe = padrao(d.pagamentos, 'mensal');
    const mesHoje = mesDe(hoje);
    for (let m = somarMes(mesHoje, -1); m <= mesDe(fim); m = somarMes(m, 1)) {
      const doMes = d.pagamentos.filter((p) => p.mes === m);
      const temAd = doMes.some((p) => p.tipo === 'adiantamento');
      if (pAd && !temAd) add(dataNoMes(somarMes(m, pAd.deslocamento), pAd.dia), 'entrada', 'adiantamento', NOMES.adiantamento, pAd.valor, true);
      if (!doMes.some((p) => p.tipo === 'mensal')) {
        // SUPOSIÇÃO: sem histórico, o salário do mês cai no último dia do mês da competência.
        const dia = pMe ? pMe.dia : 31; const desloc = pMe ? pMe.deslocamento : 0;
        const prev = previsaoMes(d, m, !temAd && pAd ? [{ tipo: 'adiantamento', liquido: pAd.valor }] : []);
        if (prev) add(dataNoMes(somarMes(m, desloc), dia), 'entrada', 'salario', NOMES.mensal, prev.a_receber, true);
      }
    }
    const dec = decimoTerceiro(cfg.salario_base, cfg.dependentes);
    for (const ano of [Number(hoje.slice(0, 4)), Number(hoje.slice(0, 4)) + 1]) {
      const reg = d.pagamentos.filter((p) => String(p.mes).startsWith(String(ano)));
      const p1 = reg.find((p) => p.tipo === 'decimo_terceiro_1'); const p2 = reg.find((p) => p.tipo === 'decimo_terceiro_2');
      // SUPOSIÇÃO: datas-limite legais (1ª parcela até 30/11, 2ª até 20/12); a empresa pode pagar antes.
      if (!p1) add(`${ano}-11-30`, 'entrada', '13o', NOMES.decimo_terceiro_1, dec.primeira, true);
      if (!p2) add(`${ano}-12-20`, 'entrada', '13o', NOMES.decimo_terceiro_2, p1 ? r2(dec.liquido - (Number(p1.liquido) || dec.primeira)) : dec.segunda, true);
    }
  }

  // 3) Saídas: contas fixas, faturas de cartão e parcelas de dívidas.
  for (let m = mesDe(hoje); m <= mesDe(fim); m = somarMes(m, 1)) {
    for (const f of d.orc.fixas || []) add(dataNoMes(m, f.dia || 10), 'saida', 'conta', f.nome, f.valor, !f.dia); // SUPOSIÇÃO: sem dia, vence dia 10
    for (const k of d.cartoes) add(dataNoMes(m, k.dia_vencimento || 10), 'saida', 'cartao', `Fatura ${k.nome}`, cartoes.faturaDoMes(d.gastos, k.id, m), true); // SUPOSIÇÃO: a fatura do mês vence neste mês
    for (const v of d.dividas) add(dataNoMes(m, v.dia_vencimento || 10), 'saida', 'divida', `Dívida ${v.credor}`, Number(v.parcela) || 0, !v.dia_vencimento);
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === 'entrada' ? -1 : 1));
}

/** 13 semanas a partir de hoje, com saldo projetado e o aviso da primeira semana que fica no negativo. */
function semanas(evs, hoje, saldoInicial, nSemanas = 13) {
  let saldo = saldoInicial;
  const lista = [];
  for (let i = 0; i < nSemanas; i++) {
    const ini = somarDias(hoje, i * 7); const fim = somarDias(ini, 6);
    const itens = evs.filter((e) => e.data >= ini && e.data <= fim);
    let minimo = saldo;
    for (const e of itens) { saldo = r2(saldo + (e.tipo === 'entrada' ? e.valor : -e.valor)); if (saldo < minimo) minimo = saldo; }
    const entra = r2(itens.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0));
    const sai = r2(itens.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0));
    lista.push({ numero: i + 1, inicio: ini, fim, entra, sai, saldo_fim: saldo, saldo_minimo: r2(minimo), itens });
  }
  return lista;
}
function aviso(sem13) {
  const s = sem13.find((x) => x.saldo_minimo < 0);
  if (!s) return null;
  return { semana: s.numero, inicio: s.inicio, fim: s.fim, falta: r2(-s.saldo_minimo), texto: `Vai faltar dinheiro na semana ${s.numero} (${br(s.inicio)} a ${br(s.fim)}): faltam cerca de R$ ${r2(-s.saldo_minimo).toFixed(2).replace('.', ',')}. Veja o que dá para adiar ou cortar antes.` };
}

// ---------- assinaturas ----------
/** Gasto que se repete: mesmo nome em 2+ meses com valor parecido (±15% da mediana). Parcelados não contam. */
function assinaturas(lancs, gastos) {
  const grupos = new Map();
  const ponto = (nome, data, valor, origem) => {
    const k = sem(nome); const mes = mesDe(data);
    if (!k || !MES.test(mes) || !(valor > 0)) return;
    const g = grupos.get(k) || grupos.set(k, { nome, meses: new Map() }).get(k);
    g.meses.set(mes, Math.max(g.meses.get(mes) || 0, valor)); // mesmo gasto nas duas listas não soma duas vezes
    g.origem = g.origem && g.origem !== origem ? 'lançamentos e cartão' : origem;
  };
  for (const l of lancs || []) if (l.tipo === 'despesa') ponto(l.estabelecimento || l.descricao, String(l.data || ''), Number(l.valor), 'lançamentos');
  for (const g of gastos || []) if ((Number(g.parcelas) || 1) <= 1) ponto(g.descricao, String(g.data || ''), Number(g.valor), 'cartão');
  const out = [];
  for (const g of grupos.values()) {
    if (g.meses.size < 2) continue;
    const vals = [...g.meses.values()].sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)];
    if (!vals.every((v) => Math.abs(v - med) <= med * 0.15)) continue;
    const media = r2(vals.reduce((s, v) => s + v, 0) / vals.length);
    out.push({ nome: g.nome, valor_mensal: media, meses: g.meses.size, por_ano: r2(media * 12), origem: g.origem, pergunta: `Você ainda usa "${g.nome}"? Cancelar economiza R$ ${r2(media * 12).toFixed(2).replace('.', ',')} por ano.` });
  }
  out.sort((a, b) => b.por_ano - a.por_ano);
  return { itens: out, total_mes: r2(out.reduce((s, x) => s + x.valor_mensal, 0)), total_ano: r2(out.reduce((s, x) => s + x.por_ano, 0)) };
}

// ---------- 13º e férias: para onde mandar o dinheiro ----------
function destino(d, valor) {
  const caras = [...d.dividas].filter((x) => (Number(x.juros_mes) || 0) > 0).sort((a, b) => b.juros_mes - a.juros_mes);
  const gastoMes = r2((d.orc.fixas || []).reduce((s, f) => s + f.valor, 0));
  const saldo = d.contas.length ? d.contas.reduce((s, k) => s + ((k.moeda || 'BRL') === 'BRL' ? Number(k.saldo) || 0 : 0), 0) : null;
  if (caras.length && caras[0].juros_mes >= 1.5) return { tipo: 'divida', texto: `Pague a dívida mais cara primeiro: ${caras[0].credor} (juros de ${String(caras[0].juros_mes).replace('.', ',')}% ao mês).` };
  if (gastoMes > 0 && (saldo === null || saldo < gastoMes * 6)) return { tipo: 'reserva', texto: 'Monte a reserva de emergência (6 meses de contas fixas) antes de qualquer outra coisa.' };
  const obj = (d.objetivos || []).find((o) => o.nome);
  if (obj) return { tipo: 'objetivo', texto: `Mande para o seu objetivo "${obj.nome}".` };
  return { tipo: 'investir', texto: valor > 0 ? 'Invista para render: veja a aba Investir.' : '' };
}
function alertas13Ferias(d, evs, hoje) {
  return evs.filter((e) => e.tipo === 'entrada' && (e.categoria === '13o' || e.categoria === 'ferias')).map((e) => ({ nome: e.nome, categoria: e.categoria, data: e.data, em_dias: diffDias(hoje, e.data), valor: e.valor, estimado: e.estimado, destino: destino(d, e.valor) }));
}

// ---------- visão do fluxo ----------
function montarFluxo(d, hoje) {
  const evs = eventos(d, hoje, 91);
  const saldoConta = d.contas.length ? r2(d.contas.filter((k) => (k.moeda || 'BRL') === 'BRL').reduce((s, k) => s + (Number(k.saldo) || 0), 0)) : null;
  const lista = semanas(evs, hoje, saldoConta || 0);
  return {
    hoje, saldo_inicial: saldoConta, saldo_conhecido: saldoConta !== null,
    nota: saldoConta === null ? 'Você ainda não cadastrou suas contas: o saldo de partida foi considerado zero. Cadastre na aba Contas para o aviso ficar certo.' : null,
    sem_salario_base: !(d.cfg && d.cfg.salario_base > 0),
    semanas: lista, aviso: aviso(lista), alertas: alertas13Ferias(d, evs, hoje), assinaturas: assinaturas(d.lancs, d.gastos),
    total_entra: r2(lista.reduce((s, x) => s + x.entra, 0)), total_sai: r2(lista.reduce((s, x) => s + x.sai, 0)),
    aviso_legal: 'Estimativa: datas e valores futuros são previsões; faturas e contas sem dia usam um dia provável.',
  };
}
/** Cartão do Início: quanto ainda cai este mês e alerta do 13º/férias. */
function resumoInicio(d, hoje) {
  const mes = mesDe(hoje);
  const fimMes = dataNoMes(mes, 31);
  const dias = diffDias(hoje, fimMes) + 1;
  const evs = eventos(d, hoje, dias);
  const prev = previsaoMes(d, mes);
  const recebeuMensal = d.pagamentos.some((p) => p.mes === mes && p.tipo === 'mensal');
  const salario = prev && !recebeuMensal ? prev.a_receber : null;
  const contas = r2(evs.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0));
  return {
    mes, previsao_salario: salario, contas_a_vencer: contas, cai_este_mes: salario === null ? null : r2(salario - contas),
    motivo: salario === null ? (recebeuMensal ? 'O salário deste mês já caiu.' : 'Informe seu salário base na aba Salário para eu estimar.') : null,
    alertas: alertas13Ferias(d, eventos(d, hoje, 91), hoje).filter((a) => a.em_dias <= 60),
  };
}

// ---------- carreira ----------
function validarPerfil(o, atual) {
  const a = atual || {};
  const pega = (k, max) => (o && o[k] !== undefined ? texto(o[k], max) : texto(a[k], max));
  const cargo = pega('cargo', 80), area = pega('area', 80), cidade = pega('cidade', 80);
  const anos = o && o.anos_experiencia !== undefined && o.anos_experiencia !== '' ? numero(o.anos_experiencia) : null;
  if (anos !== null && (!Number.isFinite(anos) || anos < 0 || anos > 60)) return { ok: false, erro: 'Os anos de experiência vão de 0 a 60.' };
  const taxa = o && o.taxa_ano !== undefined && o.taxa_ano !== '' ? numero(o.taxa_ano) : null;
  if (taxa !== null && (!Number.isFinite(taxa) || taxa < 0 || taxa > 40)) return { ok: false, erro: 'A taxa de rendimento por ano vai de 0 a 40 (%).' };
  if (!cargo) return { ok: false, erro: 'Diga qual é o seu cargo.' };
  const item = { cargo, area, cidade };
  if (anos !== null) item.anos_experiencia = anos; else if (Number.isFinite(a.anos_experiencia)) item.anos_experiencia = a.anos_experiencia;
  if (taxa !== null) item.taxa_ano = r2(taxa); else if (Number.isFinite(a.taxa_ano)) item.taxa_ano = a.taxa_ano;
  return { ok: true, item };
}
/** Valor futuro de aportes mensais com juros compostos (taxa ao ano convertida em taxa mensal equivalente). */
function valorFuturo(aporte, taxaAno, meses) {
  if (!(aporte > 0) || !(meses > 0)) return 0;
  const i = Math.pow(1 + taxaAno / 100, 1 / 12) - 1;
  return r2(i === 0 ? aporte * meses : aporte * ((Math.pow(1 + i, meses) - 1) / i));
}
function alavancar(sobra, taxaAno) {
  if (!(sobra > 0)) return { sobra: r2(Math.max(0, sobra)), taxa_ano: taxaAno, cenarios: [], texto: 'Neste mês não sobra dinheiro. Corte gastos ou aumente a renda para poder investir.' };
  const cenarios = [1, 5, 10, 20].map((a) => ({ anos: a, guardado: r2(sobra * 12 * a), rendimento_total: valorFuturo(sobra, taxaAno, a * 12) }));
  return { sobra: r2(sobra), taxa_ano: taxaAno, cenarios: cenarios.map((x) => ({ ...x, juros: r2(x.rendimento_total - x.guardado) })), texto: 'Estimativa: rendimento fixo, sem imposto nem inflação.' };
}
/** Renda líquida mensal estimada e sobra do mês (renda − fixas − guardar − cartão − parcelas de dívidas). */
function sobraDoMes(d, hoje, resumoMes) {
  const mes = mesDe(hoje);
  const prev = previsaoMes(d, mes);
  const ultimo = [...d.pagamentos].filter((p) => p.tipo === 'mensal').sort((a, b) => String(b.mes).localeCompare(String(a.mes)))[0];
  const renda = prev ? prev.liquido : ultimo ? Number(ultimo.liquido) : 0;
  const fixas = (d.orc.fixas || []).reduce((s, f) => s + f.valor, 0);
  const guardar = (d.orc.guardar || []).reduce((s, g) => s + g.valor, 0);
  const cartao = resumoMes ? resumoMes(d.gastos, mes).total || 0 : 0;
  const dividas = d.dividas.reduce((s, v) => s + (Number(v.parcela) || 0), 0);
  const total = r2(renda + (d.orc.renda_extra || 0));
  return { renda: total, fixas: r2(fixas), guardar: r2(guardar), cartao: r2(cartao), dividas: r2(dividas), gasto_mensal: r2(fixas + cartao + dividas), sobra: r2(total - fixas - guardar - cartao - dividas) };
}
function visaoCarreira(d, hoje, resumoMes, body) {
  const perfil = d.carreira.perfil || {};
  const taxa = Number.isFinite(perfil.taxa_ano) ? perfil.taxa_ano : 10; // SUPOSIÇÃO: 10% ao ano se a pessoa não informou
  const s = sobraDoMes(d, hoje, resumoMes);
  const investimentos = r2(d.carteira.reduce((t, x) => t + (Number(x.valor) || 0), 0));
  const gasto = Number.isFinite(numero(body && body.gasto_mensal)) && numero(body.gasto_mensal) > 0 ? numero(body.gasto_mensal) : s.gasto_mensal;
  // SUPOSIÇÃO: inflação de 4,5% ao ano e retirada de 4% ao ano na independência.
  const ind = gasto > 0 ? motor.independenciaFinanceira({ gasto_mensal: gasto, retirada_pct: 4, atual: investimentos, aporte: Math.max(0, s.sobra), taxa_ano: taxa, inflacao_ano: 4.5 }) : null;
  return {
    perfil: { cargo: perfil.cargo || '', area: perfil.area || '', cidade: perfil.cidade || '', anos_experiencia: perfil.anos_experiencia === undefined ? null : perfil.anos_experiencia, taxa_ano: taxa, taxa_padrao: !Number.isFinite(perfil.taxa_ano) },
    salario_atual: d.cfg.salario_base > 0 ? d.cfg.salario_base : null,
    patrimonio: { investimentos, independencia: ind ? { gasto_mensal: gasto, alvo: ind.alvo, falta: ind.falta, anos: ind.anos, meses: ind.meses, nota: ind.meses === null ? 'Com esses números a meta não é atingida em 100 anos: aumente o aporte ou o rendimento.' : null } : null, motivo: ind ? null : 'Cadastre suas contas fixas e cartões para eu saber seu gasto mensal.' },
    alavancar: alavancar(s.sobra, taxa), mes: s,
    plano: d.carreira.plano || null, aviso: AVISO,
  };
}

const PROMPT_PLANO = `Você é um orientador de carreira brasileiro. Responda SÓ com JSON, em português simples, listas curtas (no máximo 4 itens cada, frases de até 120 letras):
{"proximo_cargo":"","certificacoes":[""],"aumento":{"pedir_pct":0,"argumento":""},"renda_extra":[""]}
pedir_pct é o aumento sugerido de salário em % (número entre 0 e 40). Use só informações gratuitas e realistas para o Brasil. Não invente números de mercado exatos.`;
const lista = (v, n) => (Array.isArray(v) ? v.map((x) => texto(String(x == null ? '' : x), 140)).filter(Boolean).slice(0, n) : []);
function normalizarPlano(j) {
  if (!j || typeof j !== 'object') return null;
  const pct = Number(j.aumento && j.aumento.pedir_pct);
  const p = { proximo_cargo: texto(j.proximo_cargo, 100), certificacoes: lista(j.certificacoes, 4), aumento: { pedir_pct: Number.isFinite(pct) ? Math.max(0, Math.min(40, r2(pct))) : null, argumento: texto(j.aumento && j.aumento.argumento, 200) }, renda_extra: lista(j.renda_extra, 4) };
  return p.proximo_cargo || p.certificacoes.length || p.renda_extra.length ? p : null;
}
async function perguntarTextoGratis(deps, sistema, pergunta) {
  const router = deps.getRouter();
  for (const m of deps.listFor('fast').filter((x) => x.provider !== 'anthropic')) {
    try {
      if (!router.capabilities(m).available) continue;
      const out = await Promise.race([router.chat(m, { system: sistema, messages: [{ role: 'user', content: pergunta }], maxTokens: 900 }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
      if (out && out.text) return out.text;
    } catch { /* tenta o próximo modelo grátis */ }
  }
  return null;
}

async function agirFluxo(acao, body, c) {
  if (!['fluxo_visao', 'carreira_perfil_salvar', 'carreira_plano', 'carreira_visao'].includes(acao)) return null;
  const { base, agoraIso } = c;
  const hoje = agoraIso.slice(0, 10);
  switch (acao) {
    case 'fluxo_visao': return [200, montarFluxo(await carregar(c), hoje)];
    case 'carreira_perfil_salvar': {
      const doc = await base.collection('config').doc('carreira').get();
      const dados = doc && doc.exists ? doc.data() || {} : {};
      const v = validarPerfil(body, dados.perfil);
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('config').doc('carreira').set({ ...dados, perfil: v.item, atualizado_em: agoraIso });
      return [200, { ok: true, perfil: v.item }];
    }
    case 'carreira_visao': return [200, visaoCarreira(await carregar(c), hoje, c.resumoMes, body)];
    case 'carreira_plano': {
      const d = await carregar(c);
      const perfil = d.carreira.perfil;
      if (!perfil || !perfil.cargo) return [400, { error: 'Preencha seu perfil (cargo e área) antes de pedir o plano.' }];
      const pergunta = `Cargo: ${perfil.cargo}. Área: ${perfil.area || 'não informada'}. Cidade: ${perfil.cidade || 'não informada'}. Anos de experiência: ${perfil.anos_experiencia === undefined ? 'não informado' : perfil.anos_experiencia}. Salário atual: ${d.cfg.salario_base > 0 ? 'R$ ' + d.cfg.salario_base + ' por mês' : 'não informado'}.`;
      const perguntar = c.deps.perguntarTexto || ((s, p) => perguntarTextoGratis(c.deps, s, p));
      let t = null;
      try { t = await perguntar(PROMPT_PLANO, pergunta); } catch { t = null; }
      const plano = normalizarPlano(t && c.extrairJson(t));
      if (!plano) return [503, { error: 'Não consegui montar o plano agora. Tente de novo daqui a pouco.' }];
      const guardado = { ...plano, gerado_em: agoraIso, aviso: AVISO };
      await base.collection('config').doc('carreira').set({ ...d.carreira, plano: guardado, atualizado_em: agoraIso });
      return [200, { plano: guardado }];
    }
    default: return null;
  }
}

module.exports = { agirFluxo, eventos, semanas, aviso, assinaturas, decimoTerceiro, valorFuturo, alavancar, validarPerfil, normalizarPlano, montarFluxo, resumoInicio, visaoCarreira, destino, previsaoMes, carregar, AVISO };
