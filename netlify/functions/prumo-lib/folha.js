'use strict';

// Kernex Finance — Cálculo da folha 2026 (SÓ cálculo, sem banco, sem IA).
// Fonte: Portaria Interministerial MPS/MF nº 13/2026 (INSS) e Lei 15.270/2025 (redutor IRRF).

// Tabelas oficiais INSS 2026 — progressivo por faixa, teto R$ 8.475,55.
// Faixas: até 1.621,00 (7,5%) | até 2.902,84 (9%) | até 4.354,27 (12%) | até 8.475,55 (14%).
const TABELAS_2026 = {
  inss: [
    { ate: 1621.00, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 },
  ],
  inss_teto: 8475.55,
  ir: [
    { ate: 2428.80, aliquota: 0.00, parcela: 0 },
    { ate: 2826.65, aliquota: 0.075, parcela: 182.16 },
    { ate: 3751.05, aliquota: 0.15, parcela: 394.16 },
    { ate: 4664.68, aliquota: 0.225, parcela: 675.49 },
    { ate: Infinity, aliquota: 0.275, parcela: 908.73 },
  ],
  ir_descricao_simplificado: 607.20,
  ir_dependente: 189.59,
  // Redutor Lei 15.270/2025 sobre o rendimento bruto tributável.
  ir_redutor: [
    { ate: 5000.00, valor: 312.89 },
    { ate: 7350.00, forma: (r) => 978.62 - 0.133145 * r },
  ],
};

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function inss(bruto) {
  if (typeof bruto !== 'number' || !isFinite(bruto) || bruto < 0) return 0;
  const base = Math.min(bruto, TABELAS_2026.inss_teto);
  let total = 0;
  let anterior = 0;
  for (const faixa of TABELAS_2026.inss) {
    if (base > anterior) {
      const fatia = Math.min(base, faixa.ate) - anterior;
      total += fatia * faixa.aliquota;
    }
    anterior = faixa.ate;
  }
  return round2(total);
}

function irrf({ rendimento, inss: inssValor, dependentes = 0 } = {}) {
  if (typeof rendimento !== 'number' || !isFinite(rendimento) || rendimento < 0) return 0;
  const inssDesconto = typeof inssValor === 'number' && isFinite(inssValor) ? inssValor : 0;
  const dep = typeof dependentes === 'number' && isFinite(dependentes) ? dependentes : 0;

  const maiorDesconto = Math.max(inssDesconto + TABELAS_2026.ir_dependente * dep, TABELAS_2026.ir_descricao_simplificado);
  const baseCalculo = rendimento - maiorDesconto;

  let imposto = 0;
  for (const faixa of TABELAS_2026.ir) {
    if (baseCalculo <= faixa.ate) {
      imposto = baseCalculo * faixa.aliquota - faixa.parcela;
      break;
    }
  }
  if (imposto < 0) imposto = 0;

  // Redutor da Lei 15.270/2025 sobre o rendimento bruto tributável.
  let redutor = 0;
  if (rendimento <= 5000.00) {
    redutor = TABELAS_2026.ir_redutor[0].valor;
  } else if (rendimento <= 7350.00) {
    redutor = TABELAS_2026.ir_redutor[1].forma(rendimento);
  }
  if (redutor < 0) redutor = 0;

  imposto -= redutor;
  if (imposto < 0) imposto = 0;
  return round2(imposto);
}

// Feriados nacionais 2026 (não caem em domingo são descanso).
const FERIADOS_2026 = [
  '2026-01-01', // Confraternização Universal
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-09-07', // Independência
  '2026-10-12', // Nossa Senhora Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Consciência Negra
  '2026-12-25', // Natal
];

function diasDoMes(mes) {
  if (typeof mes !== 'string') return { uteis: 0, descanso: 0 };
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return { uteis: 0, descanso: 0 };
  const ano = Number(m[1]);
  const mesNum = Number(m[2]);
  if (mesNum < 1 || mesNum > 12) return { uteis: 0, descanso: 0 };

  let descanso = 0;
  let totalDias = 0;
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  for (let d = 1; d <= ultimoDia; d++) {
    totalDias++;
    const data = new Date(ano, mesNum - 1, d);
    const iso = data.toISOString().slice(0, 10);
    const domingo = data.getDay() === 0;
    const feriado = FERIADOS_2026.includes(iso);
    if (domingo || (feriado && !domingo)) {
      descanso++;
    }
  }
  return { uteis: totalDias - descanso, descanso };
}

/** Perfil da folha (aprendido do holerite mensal ou ajustado à mão). Tudo opcional. */
function numPerfil(v, max) { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; }
function estimarFechamento({ mes, salario_base, jornada_mensal = 220, dependentes = 0, ponto = {}, recebidos = [], perfil = {} } = {}) {
  const pf = perfil || {};
  const noturnoPct = numPerfil(pf.noturno_pct, 100) || 20;
  const fixos = numPerfil(pf.fixos, 1e6); // triênio, gratificação... (tributável)
  const naoTributavel = numPerfil(pf.nao_tributavel, 1e6); // ajuda de custo home office...
  const prevPct = numPerfil(pf.prev_pct, 50); // previdência privada (% do salário base), abate do IR
  const descontosFixos = numPerfil(pf.descontos_fixos, 1e6); // vale alimentação, plano de saúde...
  const temPerfil = !!(pf.noturno_pct || fixos || naoTributavel || prevPct || descontosFixos);
  const aviso = temPerfil ? 'Estimativa com os itens fixos do seu holerite (ajuste em "Ajustes da folha").' : 'Estimativa: convênios, plano de saúde, VT e outros descontos da empresa não entram. Mande um holerite MENSAL para eu aprender os itens da sua empresa.';
  const linhas = [];

  if (typeof salario_base !== 'number' || !isFinite(salario_base) || salario_base < 0) {
    return { bruto: 0, inss: 0, irrf: 0, liquido: 0, ja_recebido: 0, a_receber: 0, dsr: 0, valor_hora: 0, linhas, aproximado: true, aviso };
  }

  const valor_hora = salario_base / jornada_mensal;
  linhas.push({ nome: 'Salário base', valor: round2(salario_base) });
  if (fixos) linhas.push({ nome: 'Adicionais fixos (triênio etc.)', valor: round2(fixos) });

  const he50 = typeof ponto.he50 === 'number' && isFinite(ponto.he50) ? ponto.he50 : 0;
  const he100 = typeof ponto.he100 === 'number' && isFinite(ponto.he100) ? ponto.he100 : 0;
  const he75 = typeof ponto.he75 === 'number' && isFinite(ponto.he75) ? ponto.he75 : 0;
  const sobreaviso = typeof ponto.sobreaviso === 'number' && isFinite(ponto.sobreaviso) ? ponto.sobreaviso : 0;
  const noturnas = typeof ponto.noturnas === 'number' && isFinite(ponto.noturnas) ? ponto.noturnas : 0;
  const faltas = typeof ponto.faltas === 'number' && isFinite(ponto.faltas) ? ponto.faltas : 0;

  const horasExtras = valor_hora * 1.5 * he50 + valor_hora * 1.75 * he75 + valor_hora * 2 * he100;
  const adicionalNoturno = valor_hora * (noturnoPct / 100) * noturnas;
  // Sobreaviso: hora à disposição paga a 1/3 da hora normal (CLT art. 244, § 2º).
  const valorSobreaviso = (valor_hora / 3) * sobreaviso;
  linhas.push({ nome: 'Horas extras', valor: round2(horasExtras) });
  linhas.push({ nome: 'Adicional noturno', valor: round2(adicionalNoturno) });
  linhas.push({ nome: 'Sobreaviso', valor: round2(valorSobreaviso) });

  let descanso = 0;
  let uteis = 1; // evita divisão por zero
  if (typeof mes === 'string') {
    const dm = diasDoMes(mes);
    uteis = dm.uteis || 1;
    descanso = dm.descanso;
  }
  const dsr = (horasExtras + adicionalNoturno + valorSobreaviso) * descanso / uteis;
  linhas.push({ nome: 'DSR', valor: round2(dsr) });

  const descontoFaltas = valor_hora * faltas;
  linhas.push({ nome: 'Faltas', valor: -round2(descontoFaltas) });

  const bruto = round2(salario_base + fixos + horasExtras + adicionalNoturno + valorSobreaviso + dsr - descontoFaltas);
  const inssValor = inss(bruto);
  const prev = round2(salario_base * prevPct / 100);
  // Previdência privada (PGBL/fundo da empresa) abate da base do IR, junto com o INSS.
  const irrfValor = irrf({ rendimento: bruto, inss: inssValor + prev, dependentes });
  const liquido = round2(bruto - inssValor - irrfValor - prev - descontosFixos + naoTributavel);

  let ja_recebido = 0;
  if (Array.isArray(recebidos)) {
    for (const r of recebidos) {
      if (r && r.tipo === 'adiantamento' && typeof r.liquido === 'number' && isFinite(r.liquido)) {
        ja_recebido += r.liquido;
      }
    }
  }
  ja_recebido = round2(ja_recebido);

  const a_receber = round2(liquido - ja_recebido);

  linhas.push({ nome: 'INSS', valor: -inssValor });
  linhas.push({ nome: 'IRRF', valor: -irrfValor });
  if (prev) linhas.push({ nome: 'Previdência privada', valor: -prev });
  if (descontosFixos) linhas.push({ nome: 'Outros descontos fixos', valor: -round2(descontosFixos) });
  if (naoTributavel) linhas.push({ nome: 'Ajuda de custo (sem imposto)', valor: round2(naoTributavel) });
  linhas.push({ nome: 'Líquido estimado', valor: liquido });

  return {
    bruto,
    inss: inssValor,
    irrf: irrfValor,
    liquido,
    ja_recebido,
    a_receber,
    dsr: round2(dsr),
    valor_hora: round2(valor_hora),
    perfil: { noturno_pct: noturnoPct, fixos, nao_tributavel: naoTributavel, prev_pct: prevPct, descontos_fixos: descontosFixos },
    linhas,
    aproximado: true,
    aviso,
  };
}

module.exports = { TABELAS_2026, inss, irrf, diasDoMes, estimarFechamento };
