'use strict';
/**
 * Kernex Finance, Aposentadoria e FGTS: INSS (regras da EC 103/2019), FGTS, previdência privada e "quanto guardar".
 * Chamado por agirExtra (extra.js). Devolve null se a ação não for daqui.
 * Tudo aqui é ESTIMATIVA com valores de 2026. Onde a regra não é certa está marcado SUPOSIÇÃO.
 * A IA só LÊ documentos (CNIS, saldo do FGTS); datas e valores vêm das funções puras daqui.
 */
const { projecaoReal } = require('./motor');

// ---------- Parâmetros de 2026 ----------
const TETO = 8475.55; // teto do RGPS 2026
const PISO = 1621.0; // salário mínimo 2026
const DATA_REFORMA = '2019-11-13'; // EC 103/2019
const FGTS_JUROS_ANO = 3; // % a.a. (além da TR)
const AVISO = 'Estimativa com as regras e valores de 2026. Não é a decisão do INSS: confirme no Meu INSS (https://meu.inss.gov.br) antes de decidir.';
// SUPOSIÇÕES gerais (aparecem na tela e no relatório):
const SUPOSICOES = [
  'SUPOSIÇÃO: a média salarial que você informa já está atualizada (corrigida) e continua igual até se aposentar.',
  'SUPOSIÇÃO: você continua contribuindo todo mês, sem interrupção, até a data da regra.',
  'SUPOSIÇÃO: quem tem tempo de contribuição até 13/11/2019 já era filiado ao INSS antes da reforma.',
  'SUPOSIÇÃO: o 2% por ano conta só anos COMPLETOS de contribuição acima de 20 anos (homem) ou 15 anos (mulher).',
  'SUPOSIÇÃO: o fator previdenciário do pedágio de 50% usa uma tábua de sobrevida aproximada (a oficial é do IBGE); o valor real pode variar.',
];

const num = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const din = (n) => Math.round(n * 100) / 100;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Datas (sem fuso: só ano, mês, dia) ----------
function pd(s) {
  if (!DATA.test(String(s))) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}
const fmt = ({ y, m, d }) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const diasNoMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Mês inteiro k (>=0) depois de `base`, no dia `dia` (ou no último dia do mês, se o mês for curto). */
function mesMais(base, k, dia) {
  const total = base.y * 12 + (base.m - 1) + k;
  const y = Math.floor(total / 12); const m = (total % 12) + 1;
  return { y, m, d: Math.min(dia, diasNoMes(y, m)) };
}
/** Meses completos entre a e b (b depois de a). */
function mesesEntre(a, b) {
  return (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
}

// ---------- INSS ----------
const SEXO = { F: { tc: 30, idadeReg: 62, pedagio100: 57, base: 15 }, M: { tc: 35, idadeReg: 65, pedagio100: 60, base: 20 } };
const pontosDe = (sexo, ano) => (sexo === 'F' ? Math.min(100, 86 + (ano - 2019)) : Math.min(105, 96 + (ano - 2019)));
const idadeProgDe = (sexo, ano) => (sexo === 'F' ? Math.min(62, 56 + 0.5 * (ano - 2019)) : Math.min(65, 61 + 0.5 * (ano - 2019)));
// Regra por idade da transição: 60 + 6 meses por ano até 62 (mulher); homem 65.
const idadeTransDe = (sexo, ano) => (sexo === 'F' ? Math.min(62, 60 + 0.5 * (ano - 2019)) : 65);

/** Fator previdenciário (só no pedágio de 50%). SUPOSIÇÃO: sobrevida aproximada, não é a tábua oficial do IBGE. */
function fatorPrevidenciario({ sexo, idadeAnos, tcAnos }) {
  const tc = tcAnos + (sexo === 'F' ? 5 : 0); // mulher soma 5 anos ao tempo de contribuição no fator
  const es = Math.max(5, 22.7 - 0.8 * (idadeAnos - 60)); // SUPOSIÇÃO
  const a = 0.31;
  return (tc * a / es) * (1 + (idadeAnos + tc * a) / 100);
}

/** 60% + 2% por ano completo acima de 20 (homem) / 15 (mulher). */
function coeficiente(sexo, tcMeses) {
  return Math.min(100, 60 + 2 * Math.max(0, Math.floor(tcMeses / 12) - SEXO[sexo].base));
}

/** Aplica teto e piso. */
function limitar(valor) {
  if (valor > TETO) return { beneficio: TETO, limitado: 'teto' };
  if (valor < PISO) return { beneficio: PISO, limitado: 'piso' };
  return { beneficio: din(valor), limitado: null };
}

/**
 * Cada regra: { id, nome, ok(ctx) -> bool, valor(ctx) -> { coef, fator? } , explica }.
 * ctx = { sexo, ano, idadeMeses, tcMeses, tc2019, filiadoAntes }.
 */
function regras(sexo, tc2019, filiadoAntes) {
  const S = SEXO[sexo];
  const tcMin = S.tc * 12;
  const falta = Math.max(0, tcMin - tc2019);
  const lista = [];
  if (filiadoAntes) {
    lista.push({
      id: 'pontos', nome: 'Pontos',
      ok: (c) => c.tcMeses >= tcMin && (c.idadeMeses + c.tcMeses) / 12 >= pontosDe(sexo, c.ano),
      explica: `Idade + tempo de contribuição somam os pontos do ano (${pontosDe(sexo, 2026)} em 2026, sobe 1 por ano até ${sexo === 'F' ? 100 : 105}) e pelo menos ${S.tc} anos de contribuição.`,
    });
    lista.push({
      id: 'idade_progressiva', nome: 'Idade mínima progressiva',
      ok: (c) => c.tcMeses >= tcMin && c.idadeMeses / 12 >= idadeProgDe(sexo, c.ano),
      explica: `${S.tc} anos de contribuição e idade mínima de ${idadeProgDe(sexo, 2026)} anos em 2026 (sobe 6 meses por ano até ${sexo === 'F' ? 62 : 65}).`,
    });
    if (falta <= 24) {
      const exigido = tcMin + Math.ceil(falta / 2);
      lista.push({
        id: 'pedagio_50', nome: 'Pedágio de 50%',
        ok: (c) => c.tcMeses >= exigido,
        fator: true,
        explica: `Você estava a até 2 anos de ${S.tc} anos em 13/11/2019. Precisa cumprir o que faltava mais 50% (total de ${Math.floor(exigido / 12)} anos e ${exigido % 12} meses). Sem idade mínima, mas com fator previdenciário (estimativa).`,
      });
    }
    {
      const exigido = tcMin + falta;
      lista.push({
        id: 'pedagio_100', nome: 'Pedágio de 100%',
        ok: (c) => c.tcMeses >= exigido && c.idadeMeses / 12 >= S.pedagio100,
        coefCheio: true,
        explica: `${S.pedagio100} anos de idade e ${Math.floor(exigido / 12)} anos e ${exigido % 12} meses de contribuição (o que faltava em 13/11/2019 dobrado). O benefício é 100% da média.`,
      });
    }
  }
  {
    const minTc = !filiadoAntes && sexo === 'M' ? 240 : 180; // SUPOSIÇÃO: quem se filiou depois de 13/11/2019 segue a regra permanente (homem 20 anos)
    lista.push({
      id: 'idade', nome: 'Regra por idade',
      ok: (c) => c.tcMeses >= minTc && c.idadeMeses / 12 >= (filiadoAntes ? idadeTransDe(sexo, c.ano) : S.idadeReg),
      explica: `${S.idadeReg} anos de idade (${filiadoAntes && sexo === 'F' ? 'em 2026; antes de 2023 era menos' : 'hoje'}) e ${minTc / 12} anos de contribuição.`,
    });
  }
  return lista;
}

/**
 * Estima cada regra. entrada: { nascimento, sexo, tc_2019_meses, tc_total_meses, tc_data_base, media_salarial, hoje }.
 * Devolve { regras: [...], melhor, mais_cedo, avisos, suposicoes }.
 */
function calcularInss(e) {
  const nasc = pd(e.nascimento); const hoje = pd(e.hoje);
  const sexo = e.sexo === 'F' ? 'F' : 'M';
  const tc2019 = Math.max(0, Math.round(num(e.tc_2019_meses) || 0));
  const base = pd(e.tc_data_base) || hoje;
  const tcBase = Math.max(0, Math.round(num(e.tc_total_meses) || 0));
  const media = num(e.media_salarial);
  const filiadoAntes = tc2019 > 0;
  const def = regras(sexo, tc2019, filiadoAntes);
  const tcEm = (D) => tcBase + Math.max(0, mesesEntre(base, D));
  const saida = [];
  for (const r of def) {
    // Procura a primeira data (a partir de hoje) em que a regra fecha. Passo de 1 mês, ancorado no dia do aniversário.
    let achou = null; let k0 = -1;
    for (let k = -1; k <= 12 * 50 && !achou; k++) {
      const D = k < 0 ? hoje : mesMais(hoje, k, nasc.d);
      if (k >= 0 && fmt(D) <= fmt(hoje)) continue; // só datas depois de hoje
      const c = { sexo, ano: D.y, idadeMeses: mesesEntre(nasc, D), tcMeses: tcEm(D), tc2019, filiadoAntes };
      if (r.ok(c)) { achou = { D, c }; k0 = k; }
    }
    const item = { id: r.id, nome: r.nome, explica: r.explica, cumpre_em: null, ja_cumpre: false, coeficiente_pct: null, fator_previdenciario: null, bruto: null, beneficio: null, limitado: null };
    if (achou) {
      const { D, c } = achou;
      item.cumpre_em = fmt(D);
      item.ja_cumpre = k0 < 0;
      item.idade_na_data = Math.round((c.idadeMeses / 12) * 10) / 10;
      item.tempo_na_data_meses = c.tcMeses;
      if (Number.isFinite(media) && media > 0) {
        let coef = r.coefCheio ? 100 : r.fator ? 100 : coeficiente(sexo, c.tcMeses);
        let bruto = media * coef / 100;
        if (r.fator) {
          const f = fatorPrevidenciario({ sexo, idadeAnos: c.idadeMeses / 12, tcAnos: c.tcMeses / 12 });
          item.fator_previdenciario = Math.round(f * 1000) / 1000;
          bruto *= f;
        }
        item.coeficiente_pct = coef;
        item.bruto = din(bruto);
        const l = limitar(bruto);
        item.beneficio = l.beneficio; item.limitado = l.limitado;
      }
    }
    saida.push(item);
  }
  const validas = saida.filter((r) => r.cumpre_em);
  const comValor = validas.filter((r) => r.beneficio != null);
  let melhor = null;
  for (const r of comValor) if (!melhor || r.beneficio > melhor.beneficio + 1 || (Math.abs(r.beneficio - melhor.beneficio) <= 1 && r.cumpre_em < melhor.cumpre_em)) melhor = r;
  const maisCedo = validas.slice().sort((a, b) => a.cumpre_em.localeCompare(b.cumpre_em))[0] || null;
  const avisos = [];
  if (!(Number.isFinite(media) && media > 0)) avisos.push('Informe a média salarial para eu estimar o valor do benefício.');
  if (!filiadoAntes) avisos.push('Sem tempo de contribuição até 13/11/2019, valem só as regras novas (permanentes); as regras de transição não se aplicam a você.');
  avisos.push('Servidor público, atividade especial, trabalho rural, deficiência e período no exterior têm regras próprias: procure o INSS ou um especialista.');
  return { regras: saida, melhor: melhor ? melhor.id : null, mais_cedo: maisCedo ? maisCedo.id : null, parametros: { teto: TETO, piso: PISO, sexo, filiado_antes_reforma: filiadoAntes }, avisos, suposicoes: SUPOSICOES, aviso: AVISO };
}

// ---------- CNIS (resultado da leitura por IA, conferido pela pessoa) ----------
/** Junta períodos que se sobrepõem: dois empregos no mesmo mês não contam 2 meses. Devolve meses totais e até 13/11/2019. */
function tempoDosVinculos(vinculos, hojeStr) {
  const hoje = pd(hojeStr);
  const reforma = pd(DATA_REFORMA);
  const idx = (D) => D.y * 12 + (D.m - 1);
  const alertas = [];
  const faixas = [];
  for (const v of vinculos) {
    const ini = pd(v.inicio); if (!ini) continue;
    let fim = pd(v.fim);
    if (!fim) { fim = hoje; alertas.push(`Vínculo "${v.empresa || 'sem nome'}" está sem data de saída: contei até hoje. Confira.`); }
    if (idx(fim) < idx(ini)) { alertas.push(`Vínculo "${v.empresa || 'sem nome'}" termina antes de começar: ignorei.`); continue; }
    for (const p of v.pendencias || []) alertas.push(`Pendência no CNIS (${v.empresa || 'sem nome'}): ${p}`);
    faixas.push([idx(ini), idx(fim)]);
  }
  faixas.sort((a, b) => a[0] - b[0]);
  const uni = [];
  for (const f of faixas) {
    const u = uni[uni.length - 1];
    if (u && f[0] <= u[1] + 1) u[1] = Math.max(u[1], f[1]); else uni.push([...f]);
  }
  const lim = idx(reforma);
  let total = 0; let ate2019 = 0;
  for (const [a, b] of uni) {
    total += b - a + 1;
    if (a <= lim) ate2019 += Math.min(b, lim) - a + 1;
  }
  if (faixas.length > uni.length && faixas.some((f, i) => i && f[0] <= faixas[i - 1][1])) alertas.push('Há períodos que se sobrepõem (dois vínculos no mesmo mês): contei o mês só uma vez.');
  return { tc_total_meses: total, tc_2019_meses: ate2019, alertas };
}

/** Média das contribuições lidas (de 07/1994 em diante), cada uma limitada ao teto. SUPOSIÇÃO: sem correção monetária. */
function mediaDasContribuicoes(contribs) {
  const vals = [];
  const alertas = [];
  let abaixo = 0;
  for (const c of contribs) {
    if (!/^\d{4}-\d{2}$/.test(c.competencia) || c.competencia < '1994-07') continue;
    const v = num(c.valor);
    if (!Number.isFinite(v) || v <= 0) continue;
    if (c.competencia >= '2019-11' && v < PISO && c.competencia >= '2026-01') abaixo++;
    vals.push(Math.min(v, TETO));
  }
  if (abaixo) alertas.push(`${abaixo} mês(es) de 2026 com contribuição abaixo do salário mínimo: podem não contar. Veja no Meu INSS como complementar.`);
  if (!vals.length) return { media: null, alertas };
  alertas.push('SUPOSIÇÃO: a média das contribuições lidas está SEM correção monetária; o INSS corrige os valores antigos, então o número real tende a ser maior.');
  return { media: din(vals.reduce((s, v) => s + v, 0) / vals.length), alertas };
}

// ---------- FGTS ----------
// Tabela oficial do saque-aniversário: [limite do saldo, alíquota, parcela adicional].
const TABELA_SAQUE_ANIVERSARIO = [
  [500, 0.5, 0], [1000, 0.4, 50], [5000, 0.3, 150], [10000, 0.2, 650], [15000, 0.15, 1150], [20000, 0.1, 1900], [Infinity, 0.05, 2900],
];
function saqueAniversario(saldo) {
  if (!(saldo > 0)) return { aliquota: 0, adicional: 0, valor: 0 };
  const [, al, ad] = TABELA_SAQUE_ANIVERSARIO.find(([lim]) => saldo <= lim);
  return { aliquota: al, adicional: ad, valor: din(saldo * al + ad) };
}

/** Saldo daqui a `anos`: juros de 3% a.a. + TR (%), depósito no fim de cada mês. SUPOSIÇÃO: salário e TR constantes. */
function projetarFgts({ saldo, deposito, anos, tr_pct = 0 }) {
  const taxa = (1 + FGTS_JUROS_ANO / 100) * (1 + tr_pct / 100) - 1;
  const i = Math.pow(1 + taxa, 1 / 12) - 1;
  const n = Math.round(anos * 12);
  const f = Math.pow(1 + i, n);
  const v = saldo * f + deposito * (i > 0 ? (f - 1) / i : n);
  return din(v);
}

/** Saque-aniversário × saque-rescisão. SUPOSIÇÃO: a multa de 40% é calculada sobre o saldo (o certo é sobre o total depositado corrigido). */
function compararSaques({ saldo, deposito, tr_pct = 0, anos = 5 }) {
  const taxa = (1 + FGTS_JUROS_ANO / 100) * (1 + tr_pct / 100) - 1;
  const i = Math.pow(1 + taxa, 1 / 12) - 1;
  const hoje = saqueAniversario(saldo);
  // Aniversário: todo ano saca pela tabela e o resto continua rendendo.
  let s = saldo; let sacado = 0;
  for (let a = 0; a < anos; a++) {
    for (let m = 0; m < 12; m++) s = s * (1 + i) + deposito;
    const sq = saqueAniversario(s);
    sacado += sq.valor; s -= sq.valor;
  }
  // Rescisão: nada sai durante o trabalho; tudo rende junto.
  const rescisaoFim = projetarFgts({ saldo, deposito, anos, tr_pct });
  const multa = din(saldo * 0.4);
  return {
    aniversario: {
      saque_este_ano: hoje.valor, aliquota_pct: Math.round(hoje.aliquota * 100), parcela_adicional: hoje.adicional,
      total_sacado_no_periodo: din(sacado), saldo_que_sobra_no_periodo: din(s),
      se_demitido_hoje: { saca_agora: multa, saldo_bloqueado: din(Math.max(0, saldo - hoje.valor)), nota: 'Na demissão sem justa causa você só saca a multa de 40%; o saldo fica preso e sai pela tabela, uma vez por ano.' },
    },
    rescisao: { saldo_no_periodo: rescisaoFim, se_demitido_hoje: { saca_agora: din(saldo + multa), saldo: din(saldo), multa_40: multa } },
    anos,
    dica: hoje.valor > 0 && saldo > 0 ? 'O saque-aniversário dá dinheiro todo ano, mas tranca o saldo se você for demitido. Para quem quer segurança no emprego, o saque-rescisão costuma proteger mais.' : '',
    suposicao: 'SUPOSIÇÃO: a multa de 40% foi calculada sobre o saldo atual; o valor oficial é sobre o total depositado e corrigido.',
    tabela: TABELA_SAQUE_ANIVERSARIO.map(([lim, al, ad]) => ({ ate: lim === Infinity ? null : lim, aliquota_pct: Math.round(al * 100), parcela_adicional: ad })),
  };
}

/** Quanto o FGTS abate num financiamento (sistema Price). Modo "prazo": mantém a parcela; "parcela": mantém o prazo. */
function usarFgtsNoImovel({ saldo_fgts, saldo_devedor, taxa_ano, prazo_meses }) {
  if (!(saldo_devedor > 0) || !(prazo_meses > 0) || !(saldo_fgts >= 0)) return null;
  const i = Math.pow(1 + (taxa_ano || 0) / 100, 1 / 12) - 1;
  const pmt = (s, n) => (i > 0 ? (s * i) / (1 - Math.pow(1 + i, -n)) : s / n);
  const uso = Math.min(saldo_fgts, saldo_devedor);
  const parcelaHoje = pmt(saldo_devedor, prazo_meses);
  const novoSaldo = saldo_devedor - uso;
  const jurosAntes = parcelaHoje * prazo_meses - saldo_devedor;
  // Mantendo a parcela, o prazo encurta.
  let nPrazo = 0;
  if (novoSaldo > 0) nPrazo = i > 0 ? Math.ceil(-Math.log(1 - (novoSaldo * i) / parcelaHoje) / Math.log(1 + i)) : Math.ceil(novoSaldo / parcelaHoje);
  const jurosPrazo = novoSaldo > 0 ? pmt(novoSaldo, nPrazo) * nPrazo - novoSaldo : 0;
  const parcelaNova = novoSaldo > 0 ? pmt(novoSaldo, prazo_meses) : 0;
  const jurosParcela = novoSaldo > 0 ? parcelaNova * prazo_meses - novoSaldo : 0;
  return {
    abate: din(uso), novo_saldo_devedor: din(novoSaldo), parcela_hoje: din(parcelaHoje),
    reduzindo_prazo: { novo_prazo_meses: nPrazo, meses_a_menos: prazo_meses - nPrazo, economia_juros: din(jurosAntes - jurosPrazo) },
    reduzindo_parcela: { nova_parcela: din(parcelaNova), economia_mensal: din(parcelaHoje - parcelaNova), economia_juros: din(jurosAntes - jurosParcela) },
    condicoes: [
      'Pelo menos 3 anos de trabalho sob o regime do FGTS (somados, seguidos ou não).',
      'Não ter outro financiamento ativo no SFH em nenhum lugar do país.',
      'Não ter imóvel residencial na cidade onde mora ou trabalha (e nas regiões vizinhas, conforme a CAIXA).',
      'O imóvel precisa se enquadrar nas regras do sistema; quem confirma é o banco/CAIXA.',
    ],
    fonte: 'https://www.fgts.gov.br/Paginas/trabalhador/fgts-na-moradia.aspx',
  };
}

// ---------- Previdência privada ----------
// Tabela mensal do IR (parcela a deduzir inclusa). SUPOSIÇÃO: mantida em 2026.
const FAIXAS_IR = [[2428.8, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]];
/** IR mensal estimado. SUPOSIÇÃO: isento até R$ 5.000; entre 5.000 e 7.350 o desconto some aos poucos (aproximação linear). */
function irMensal(renda) {
  if (!(renda > 0)) return 0;
  const [, al, ded] = FAIXAS_IR.find(([lim]) => renda <= lim);
  const tabela = Math.max(0, renda * al - ded);
  if (renda <= 5000) return 0;
  if (renda < 7350) return din((tabela * (renda - 5000)) / 2350);
  return din(tabela);
}
const REGRESSIVA = [[2, 35], [4, 30], [6, 25], [8, 20], [10, 15], [Infinity, 10]];
const aliquotaRegressiva = (anos) => REGRESSIVA.find(([lim]) => anos <= lim)[1];

/** PGBL deduz até 12% da renda bruta anual (declaração completa). Economia = IR que deixa de pagar. */
function pgblOuVgbl({ renda_bruta_anual, aporte_anual, declaracao_completa }) {
  const limite = din(Math.max(0, renda_bruta_anual) * 0.12);
  const deducao = declaracao_completa ? din(Math.min(Math.max(0, aporte_anual), limite)) : 0;
  const m = renda_bruta_anual / 12;
  const economia = din(12 * (irMensal(m) - irMensal(Math.max(0, m - deducao / 12))));
  let recomendacao; let motivo;
  if (!declaracao_completa) { recomendacao = 'VGBL'; motivo = 'Quem faz a declaração simplificada (ou é isento) não abate o aporte no imposto: o PGBL perde a vantagem. O VGBL só paga imposto sobre o rendimento.'; }
  else if (economia > 0) { recomendacao = 'PGBL'; motivo = `Com a declaração completa você abate até ${limite.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por ano e economiza cerca de ${economia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de imposto agora (o imposto é cobrado depois, no resgate).`; }
  else { recomendacao = 'VGBL'; motivo = 'Na sua faixa de renda a estimativa de imposto a pagar é zero, então abater o aporte não economiza nada: o VGBL costuma ser melhor.'; }
  return { limite_dedutivel_anual: limite, deducao_anual: deducao, economia_ir_anual: economia, recomendacao, motivo, compensa_pgbl: recomendacao === 'PGBL' };
}

/** Aporte mensal para juntar `capital` em `anos` com `inicial` e taxa real ao ano. */
function aporteNecessario({ capital, inicial = 0, taxa_real_ano = 0, anos }) {
  const n = Math.round(anos * 12);
  if (!(n > 0)) return null;
  const i = Math.pow(1 + taxa_real_ano / 100, 1 / 12) - 1;
  const f = Math.pow(1 + i, n);
  const falta = capital - inicial * f;
  if (falta <= 0) return 0;
  return din(falta / (i > 0 ? (f - 1) / i : n));
}
/** Capital para tirar `renda` por mês durante `anos_receber` (acaba no fim). */
function capitalParaRenda({ renda, anos_receber, taxa_real_ano = 0 }) {
  const n = Math.round(anos_receber * 12);
  const i = Math.pow(1 + taxa_real_ano / 100, 1 / 12) - 1;
  return din(renda * (i > 0 ? (1 - Math.pow(1 + i, -n)) / i : n));
}

function simularPrevidencia(b) {
  const anos = b.anos;
  const proj = projecaoReal({ inicial: b.saldo_atual, aporte: b.aporte_mensal, taxa_ano: b.taxa_real_ano, anos });
  const aporteAnual = b.aporte_mensal * 12;
  const pg = pgblOuVgbl({ renda_bruta_anual: b.renda_bruta_anual, aporte_anual: aporteAnual, declaracao_completa: b.declaracao_completa });
  const aliq = aliquotaRegressiva(anos);
  const rend = proj.rendimento;
  // Regressiva: PGBL paga sobre o total; VGBL, só sobre o rendimento.
  const regr = { aliquota_pct: aliq, imposto_pgbl: din((proj.bruto * aliq) / 100), imposto_vgbl: din((rend * aliq) / 100) };
  // Progressiva: a retirada soma à outra renda do mês e passa pela tabela. Retirada = capital / (anos_receber*12).
  const retirada = proj.bruto / (b.anos_receber * 12);
  const outras = b.outras_rendas_mensais;
  const impPg = irMensal(outras + retirada) - irMensal(outras);
  const baseVg = proj.bruto > 0 ? retirada * (rend / proj.bruto) : 0;
  const impVg = irMensal(outras + baseVg) - irMensal(outras);
  const prog = { retirada_mensal: din(retirada), imposto_mensal_pgbl: din(impPg), imposto_mensal_vgbl: din(impVg), imposto_total_pgbl: din(impPg * b.anos_receber * 12), imposto_total_vgbl: din(impVg * b.anos_receber * 12) };
  const menorPg = regr.imposto_pgbl <= prog.imposto_total_pgbl ? 'regressiva' : 'progressiva';
  const menorVg = regr.imposto_vgbl <= prog.imposto_total_vgbl ? 'regressiva' : 'progressiva';
  const out = {
    acumulado: { investido: proj.investido, bruto: proj.bruto, rendimento: rend, anos, taxa_real_ano: b.taxa_real_ano },
    pgbl_ou_vgbl: pg,
    tabelas: { regressiva: regr, progressiva: prog, menor_imposto_pgbl: menorPg, menor_imposto_vgbl: menorVg, tabela_regressiva: REGRESSIVA.map(([lim, a]) => ({ ate_anos: lim === Infinity ? null : lim, aliquota_pct: a })),
      dica: 'Prazo longo (acima de 10 anos) leva a regressiva a 10%. Quem espera renda alta na aposentadoria costuma preferir a regressiva; quem terá renda baixa, a progressiva. A escolha é feita ao contratar o plano e depois não muda.' },
    suposicoes: ['SUPOSIÇÃO: a taxa informada é REAL (já descontada a inflação), então os valores estão no poder de compra de hoje.', 'SUPOSIÇÃO: o IR usa a tabela mensal de 2026 com isenção até R$ 5.000 e desconto que some até R$ 7.350 (aproximação).', 'SUPOSIÇÃO: todo aporte conta no prazo total na regressiva (na regra real cada aporte tem seu prazo).'],
    aviso: 'Estimativa e simulação, não é promessa de rentabilidade nem recomendação de produto.',
  };
  if (b.renda_alvo > 0) {
    const capital = capitalParaRenda({ renda: b.renda_alvo, anos_receber: b.anos_receber, taxa_real_ano: b.taxa_real_ano });
    out.quanto_aportar = { renda_alvo: b.renda_alvo, anos_receber: b.anos_receber, capital_necessario: capital, aporte_mensal: aporteNecessario({ capital, inicial: b.saldo_atual, taxa_real_ano: b.taxa_real_ano, anos }) };
  }
  return out;
}

// ---------- IA: leitura de documentos ----------
const LER_CNIS = `Você lê UM extrato CNIS (INSS) em imagem. Responda SÓ com JSON:
{"nascimento":"AAAA-MM-DD ou vazio","vinculos":[{"empresa":"","inicio":"AAAA-MM-DD","fim":"AAAA-MM-DD ou vazio se aberto","tipo":"","pendencias":[""]}],"contribuicoes":[{"competencia":"AAAA-MM","valor":0}],"simulacao":{"tc_2019_meses":0,"tc_total_meses":0}}
Se for SIMULAÇÃO DE APOSENTADORIA do INSS (não CNIS), vinculos e contribuicoes ficam vazios e "simulacao" traz o tempo de contribuição escrito ("13 anos, 9 meses" vira 165), em meses. Se não for simulação, "simulacao" fica null.
Copie só o que está escrito. Não copie CPF, NIT, nome da pessoa nem endereço. Valores em número (R$ 1.234,56 vira 1234.56). Pendência = indicadores como PEXT, PREM-EXT, PADM, AEXT-VT... com a descrição curta.`;
const LER_FGTS = `Você lê UM print do app FGTS. Responda SÓ com JSON: {"saldo":0,"modalidade":"rescisao|aniversario|"}. saldo = saldo total em número (R$ 1.234,56 vira 1234.56). Não copie CPF nem nome.`;

// 17/11/2026: usa o leitor único (corrida escalonada + NVIDIA + Cloudflare). O antigo tentava só a lista 'fast', uma por vez.
function perguntarVisaoGratis(deps, img, sistema) {
  return require('./visao').perguntarVisao(deps, img, sistema);
}

function limparVinculos(lista) {
  const out = [];
  for (const v of Array.isArray(lista) ? lista.slice(0, 80) : []) {
    const inicio = texto(v && v.inicio, 10);
    if (!pd(inicio)) continue;
    const fim = texto(v && v.fim, 10);
    out.push({ empresa: texto(v.empresa, 80), tipo: texto(v.tipo, 40), inicio, fim: pd(fim) ? fim : '', pendencias: (Array.isArray(v.pendencias) ? v.pendencias : []).map((p) => texto(p, 100)).filter(Boolean).slice(0, 5) });
  }
  return out;
}
function limparContribs(lista) {
  const out = [];
  for (const c of Array.isArray(lista) ? lista.slice(0, 600) : []) {
    const competencia = texto(c && c.competencia, 7); const valor = num(c && c.valor);
    if (/^\d{4}-\d{2}$/.test(competencia) && Number.isFinite(valor) && valor > 0) out.push({ competencia, valor: din(valor) });
  }
  return out;
}

// ---------- Ações ----------
const sim = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'sim';

async function agirAposentadoria(acao, body, c) {
  if (!['apos_perfil_salvar', 'apos_visao', 'apos_cnis_ler', 'fgts_salvar', 'prev_simular'].includes(acao)) return null;
  const { base, agoraIso } = c;
  const hoje = agoraIso.slice(0, 10);
  const lerDoc = async (id) => { const s = await base.collection('aposentadoria').doc(id).get(); return s.exists ? s.data() || {} : {}; };

  switch (acao) {
    case 'apos_perfil_salvar': {
      const atual = await lerDoc('perfil');
      const nascimento = texto(body.nascimento, 10) || atual.nascimento;
      if (!pd(nascimento) || nascimento >= hoje) return [400, { error: 'Informe sua data de nascimento (dia/mês/ano).' }];
      const sexo = String(body.sexo || atual.sexo || '').toUpperCase().slice(0, 1);
      if (sexo !== 'F' && sexo !== 'M') return [400, { error: 'Diga o sexo (F ou M), pois as regras do INSS são diferentes.' }];
      const campos = {};
      for (const k of ['tc_2019_meses', 'tc_total_meses']) {
        const v = body[k] === undefined || body[k] === '' ? atual[k] : num(body[k]);
        if (!Number.isFinite(v) || v < 0 || v > 12 * 70) return [400, { error: 'O tempo de contribuição precisa ser em meses, de 0 a 840.' }];
        campos[k] = Math.round(v);
      }
      if (campos.tc_2019_meses > campos.tc_total_meses) return [400, { error: 'O tempo até 13/11/2019 não pode ser maior que o tempo total.' }];
      const m = body.media_salarial === undefined || body.media_salarial === '' ? atual.media_salarial : num(body.media_salarial);
      if (m !== undefined && (!Number.isFinite(m) || m < 0 || m > 1e6)) return [400, { error: 'A média salarial precisa ser um valor em reais.' }];
      const perfil = { ...atual, nascimento, sexo, ...campos, tc_data_base: hoje, atualizado_em: agoraIso };
      if (m !== undefined) perfil.media_salarial = din(m);
      if (Array.isArray(body.vinculos)) perfil.vinculos = limparVinculos(body.vinculos);
      await base.collection('aposentadoria').doc('perfil').set(perfil);
      return [200, { ok: true, perfil }];
    }

    case 'apos_cnis_ler': {
      const im = c.lerImagens(body.imagens, { pdf: true });
      if (!im.ok) return [400, { error: im.erro }];
      const perguntar = c.deps.perguntarVisao || ((img, s) => perguntarVisaoGratis(c.deps, img, s));
      const lidos = await Promise.all(im.imagens.map(async (img) => {
        try {
          const t = await perguntar(img, LER_CNIS);
          const j = t && c.extrairJson(t);
          if (!j) return { ok: false, erro: 'Não consegui ler esta imagem. Tente de novo ou digite os valores.' };
          const nasc = /^d{4}-d{2}-d{2}$/.test(String(j.nascimento || '')) ? j.nascimento : null;
          const m = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 900 ? n : null; };
          const sim = j.simulacao && typeof j.simulacao === 'object' ? { tc_2019_meses: m(j.simulacao.tc_2019_meses), tc_total_meses: m(j.simulacao.tc_total_meses) } : null;
          return { ok: true, nascimento: nasc, simulacao: sim, vinculos: limparVinculos(j.vinculos), contribuicoes: limparContribs(j.contribuicoes) };
        } catch { return { ok: false, erro: 'Não consegui ler esta imagem agora.' }; }
      }));
      // Junta as páginas; o mesmo vínculo em duas páginas não duplica.
      const vistos = new Set(); const vinculos = []; const contribs = new Map();
      for (const l of lidos.filter((x) => x.ok)) {
        for (const v of l.vinculos) { const k = `${v.empresa}|${v.inicio}`; if (!vistos.has(k)) { vistos.add(k); vinculos.push(v); } }
        for (const x of l.contribuicoes) contribs.set(x.competencia, x);
      }
      const t = tempoDosVinculos(vinculos, hoje);
      const md = mediaDasContribuicoes([...contribs.values()]);
      // Dono 19/11: simulação do INSS e data de nascimento também entram (antes a simulação não dava nada).
      const okL = lidos.filter((x) => x.ok);
      const nascimento = (okL.find((x) => x.nascimento) || {}).nascimento || null;
      const sim = (okL.find((x) => x.simulacao && (x.simulacao.tc_2019_meses || x.simulacao.tc_total_meses)) || {}).simulacao || null;
      if (!vinculos.length && sim) { if (sim.tc_2019_meses) t.tc_2019_meses = sim.tc_2019_meses; if (sim.tc_total_meses) t.tc_total_meses = sim.tc_total_meses; }
      return [200, { lidos, resumo: { nascimento, simulacao: !!sim, vinculos, tc_total_meses: t.tc_total_meses, tc_2019_meses: t.tc_2019_meses, media_salarial: md.media, contribuicoes_lidas: contribs.size, alertas: [...t.alertas, ...md.alertas] }, conferir: 'Confira os dados antes de salvar: a leitura por IA pode errar.' }];
    }

    case 'fgts_salvar': {
      const atual = await lerDoc('fgts');
      let saldo = body.saldo === undefined || body.saldo === '' || body.saldo === null ? undefined : num(body.saldo);
      if (saldo === undefined && Array.isArray(body.imagens)) {
        const im = c.lerImagens(body.imagens, { pdf: true });
        if (!im.ok) return [400, { error: im.erro }];
        const perguntar = c.deps.perguntarVisao || ((img, s) => perguntarVisaoGratis(c.deps, img, s));
        const lidos = await Promise.all(im.imagens.map(async (img) => {
          try {
            const t = await perguntar(img, LER_FGTS); const j = t && c.extrairJson(t);
            const s = j && num(j.saldo);
            return Number.isFinite(s) && s >= 0 ? { ok: true, saldo: din(s), modalidade: j.modalidade === 'aniversario' ? 'aniversario' : j.modalidade === 'rescisao' ? 'rescisao' : '' } : { ok: false, erro: 'Não consegui ler o saldo neste print.' };
          } catch { return { ok: false, erro: 'Não consegui ler esta imagem agora.' }; }
        }));
        return [200, { salvo: false, lidos, conferir: 'Confira o saldo e salve.' }];
      }
      if (saldo === undefined) saldo = atual.saldo;
      if (!Number.isFinite(saldo) || saldo < 0 || saldo > 1e8) return [400, { error: 'Informe o saldo do FGTS em reais.' }];
      const novo = { ...atual, saldo: din(saldo) };
      if (body.deposito_mensal !== undefined && body.deposito_mensal !== '') {
        const d = num(body.deposito_mensal);
        if (!Number.isFinite(d) || d < 0) return [400, { error: 'O depósito mensal precisa ser um valor em reais.' }];
        novo.deposito_mensal = din(d);
      }
      if (body.tr_pct !== undefined && body.tr_pct !== '') {
        const t = num(body.tr_pct);
        if (!Number.isFinite(t) || t < -5 || t > 30) return [400, { error: 'A TR vai de -5 a 30 (% ao ano).' }];
        novo.tr_pct = t;
      }
      if (body.modalidade !== undefined && body.modalidade !== '') {
        if (!['rescisao', 'aniversario'].includes(body.modalidade)) return [400, { error: 'Modalidade: saque-rescisão ou saque-aniversário.' }];
        novo.modalidade = body.modalidade;
      }
      novo.atualizado_em = agoraIso;
      await base.collection('aposentadoria').doc('fgts').set(novo);
      return [200, { ok: true, salvo: true, fgts: novo }];
    }

    case 'apos_visao': {
      const [perfil, fgtsDoc, cfgSnap] = await Promise.all([lerDoc('perfil'), lerDoc('fgts'), base.collection('config').doc('salario').get()]);
      const cfg = cfgSnap && cfgSnap.exists ? cfgSnap.data() || {} : {};
      const out = { aviso: AVISO, inss: null, fgts: null, quanto_guardar: null, faltando: [] };
      if (perfil.nascimento && perfil.sexo) out.inss = { ...calcularInss({ ...perfil, hoje }), perfil: { nascimento: perfil.nascimento, sexo: perfil.sexo, tc_2019_meses: perfil.tc_2019_meses || 0, tc_total_meses: perfil.tc_total_meses || 0, media_salarial: perfil.media_salarial || null, vinculos: (perfil.vinculos || []).length } };
      else out.faltando.push('Informe nascimento e sexo (aba INSS) para eu calcular a aposentadoria.');
      // FGTS
      const salarioBase = num(body.salario_base) > 0 ? num(body.salario_base) : Number(cfg.salario_base) > 0 ? Number(cfg.salario_base) : 0;
      const deposito = fgtsDoc.deposito_mensal > 0 ? fgtsDoc.deposito_mensal : din(salarioBase * 0.08);
      const tr = Number.isFinite(num(body.tr_pct)) ? num(body.tr_pct) : Number.isFinite(fgtsDoc.tr_pct) ? fgtsDoc.tr_pct : 0;
      if (fgtsDoc.saldo !== undefined) {
        const saldo = fgtsDoc.saldo;
        out.fgts = {
          saldo, deposito_mensal: deposito, deposito_de: fgtsDoc.deposito_mensal > 0 ? 'informado' : salarioBase > 0 ? 'salario' : 'nenhum', tr_pct: tr, modalidade: fgtsDoc.modalidade || null,
          projecao: [1, 5, 10, 20].map((a) => ({ anos: a, saldo: projetarFgts({ saldo, deposito, anos: a, tr_pct: tr }) })),
          comparacao: compararSaques({ saldo, deposito, tr_pct: tr, anos: 5 }),
          premissa: `Rendimento de ${FGTS_JUROS_ANO}% ao ano + TR (${tr}% ao ano). Estimativa: salário e TR constantes.`,
        };
        if (body.imovel && typeof body.imovel === 'object') {
          const im = body.imovel;
          const r = usarFgtsNoImovel({ saldo_fgts: saldo, saldo_devedor: num(im.saldo_devedor), taxa_ano: num(im.taxa_ano) || 0, prazo_meses: num(im.prazo_meses) });
          out.fgts.imovel = r || { erro: 'Para ver quanto o FGTS abate, informe o saldo devedor e o prazo restante.' };
        }
      } else out.faltando.push('Informe o saldo do FGTS para eu projetar.');
      // Quanto guardar: junta INSS + FGTS + investimentos e reusa meta_independencia (metas.js).
      const desejada = num(body.renda_desejada);
      if (desejada > 0) {
        const melhor = out.inss && out.inss.melhor ? out.inss.regras.find((r) => r.id === out.inss.melhor) : null;
        const inss = melhor ? melhor.beneficio : 0;
        const carteira = await c.listar(base.collection('carteira'));
        const investimentos = din(carteira.reduce((s, i) => s + (Number(i.valor) > 0 ? Number(i.valor) : 0), 0));
        const informado = num(body.investimentos);
        const aplicado = Number.isFinite(informado) && informado >= 0 ? informado : investimentos;
        const anosAte = melhor ? Math.max(0, Math.round(mesesEntre(pd(hoje), pd(melhor.cumpre_em)) / 12 * 10) / 10) : num(body.anos) || 20;
        const fgtsFuturo = out.fgts ? projetarFgts({ saldo: out.fgts.saldo, deposito, anos: anosAte, tr_pct: tr }) : 0;
        const gap = Math.max(0, din(desejada - inss));
        const q = { renda_desejada: din(desejada), inss_estimado: inss, inss_regra: melhor ? melhor.nome : null, gap_mensal: gap, investimentos_hoje: aplicado, fgts_na_data: fgtsFuturo, anos_ate_aposentar: anosAte, avisos: [] };
        if (!melhor) q.avisos.push('Sem o INSS calculado, contei R$ 0 de INSS: informe seu perfil para um número mais realista.');
        q.avisos.push('O FGTS é um saque único, não renda mensal: entra só como patrimônio.');
        if (gap === 0) { q.mensagem = 'O INSS estimado já cobre a renda que você quer.'; }
        else {
          const r = await require('./metas').agirMetas('meta_independencia', {
            gasto_mensal: gap, retirada_pct: body.retirada_pct === undefined || body.retirada_pct === '' ? 4 : body.retirada_pct, atual: aplicado + fgtsFuturo, aporte: body.aporte === undefined || body.aporte === '' ? 0 : body.aporte,
            taxa_ano: body.taxa_ano === undefined || body.taxa_ano === '' ? 8 : body.taxa_ano, inflacao_ano: body.inflacao_ano === undefined || body.inflacao_ano === '' ? 4 : body.inflacao_ano,
          }, c);
          if (r[0] !== 200) return r;
          q.independencia = r[1];
          const taxaReal = r[1].taxa_real_ano;
          q.aporte_mensal_necessario = anosAte > 0 ? aporteNecessario({ capital: r[1].alvo, inicial: aplicado + fgtsFuturo, taxa_real_ano: taxaReal, anos: anosAte }) : null;
        }
        out.quanto_guardar = q;
      }
      return [200, out];
    }

    case 'prev_simular': {
      const campo = (k, padrao, min, max) => { const v = body[k] === undefined || body[k] === '' || body[k] === null ? padrao : num(body[k]); return Number.isFinite(v) && v >= min && v <= max ? v : NaN; };
      const b = {
        renda_bruta_anual: campo('renda_bruta_anual', NaN, 1, 1e9), aporte_mensal: campo('aporte_mensal', 0, 0, 1e7), saldo_atual: campo('saldo_atual', 0, 0, 1e10),
        anos: campo('anos', NaN, 1, 70), taxa_real_ano: campo('taxa_real_ano', 4, -20, 50), anos_receber: campo('anos_receber', 25, 1, 60),
        outras_rendas_mensais: campo('outras_rendas_mensais', 0, 0, 1e7), renda_alvo: campo('renda_alvo', 0, 0, 1e7), declaracao_completa: sim(body.declaracao_completa),
      };
      if (!Number.isFinite(b.renda_bruta_anual)) return [400, { error: 'Informe sua renda bruta por ano (salário × 12, mais extras).' }];
      if (!Number.isFinite(b.anos)) return [400, { error: 'Diga em quantos anos (1 a 70) você quer se aposentar.' }];
      for (const k of ['aporte_mensal', 'saldo_atual', 'taxa_real_ano', 'anos_receber', 'outras_rendas_mensais', 'renda_alvo']) if (!Number.isFinite(b[k])) return [400, { error: 'Valor inválido em ' + k + '.' }];
      return [200, simularPrevidencia(b)];
    }
    default: return null;
  }
}

module.exports = {
  agirAposentadoria, calcularInss, coeficiente, limitar, fatorPrevidenciario, tempoDosVinculos, mediaDasContribuicoes,
  saqueAniversario, projetarFgts, compararSaques, usarFgtsNoImovel, irMensal, aliquotaRegressiva, pgblOuVgbl, aporteNecessario, capitalParaRenda, simularPrevidencia,
  TETO, PISO,
};
