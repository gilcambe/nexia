'use strict';
/**
 * Kernex Finance, Salário v2: vários recebimentos no mês, folha de ponto e previsão de fechamento.
 * Chamado por agirExtra (extra.js). Devolve null se a ação não for daqui.
 */
const MES = /^\d{4}-\d{2}$/;
const prv = require('./previsto');
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = ['adiantamento', 'mensal', 'decimo_terceiro_1', 'decimo_terceiro_2', 'ferias', 'plr', 'outro'];
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;

const LER_HOLERITE = `Você lê UM holerite (contracheque) brasileiro. Responda SÓ com JSON:
{"tipo":"adiantamento|mensal|decimo_terceiro_1|decimo_terceiro_2|ferias|plr|outro","mes":"AAAA-MM","data_pagamento":"AAAA-MM-DD","empresa":"","bruto":0,"liquido":0,"salario_base":0,"descontos":[{"nome":"","valor":0}],"proventos":[{"nome":"","valor":0}]}
Classifique o tipo pelo texto ("Adiant Quinzenal" = adiantamento; "13º Salário - Adiantamento" = decimo_terceiro_1; "13º Salário - 2ª parcela" = decimo_terceiro_2; folha normal do mês = mensal).
Valores em número (R$ 1.234,56 vira 1234.56). Não copie CPF, nome da pessoa nem números de documento.`;
const LER_PONTO = `Você lê UMA folha de ponto brasileira. Responda SÓ com JSON:
{"mes":"AAAA-MM","he50":0,"he100":0,"noturnas":0,"faltas":0}
Tudo em horas, número (1h30 vira 1.5). he50 = horas extras a 50%, he100 = a 100%, noturnas = horas noturnas, faltas = horas de falta.`;

function listaValores(l) {
  const out = [];
  for (const x of Array.isArray(l) ? l.slice(0, 40) : []) {
    const nome = texto(x && x.nome, 80);
    const valor = numero(x && x.valor);
    if (nome && Number.isFinite(valor) && valor >= 0) out.push({ nome, valor: dinheiro(valor) });
  }
  return out;
}

function validarPagamento(o) {
  const mes = texto(o && o.mes, 7);
  const data = texto(o && o.data_pagamento, 10);
  const tipo = texto(o && o.tipo, 30);
  const bruto = o && o.bruto === undefined ? 0 : numero(o.bruto);
  const liquido = numero(o && o.liquido);
  if (!MES.test(mes)) return { ok: false, erro: 'Diga o mês (AAAA-MM).' };
  if (!DATA.test(data)) return { ok: false, erro: 'Diga a data do pagamento (AAAA-MM-DD).' };
  if (!TIPOS.includes(tipo)) return { ok: false, erro: 'Tipo de recebimento inválido.' };
  if (!Number.isFinite(liquido) || liquido < 0) return { ok: false, erro: 'O valor líquido precisa ser zero ou mais.' };
  if (!Number.isFinite(bruto) || bruto < 0) return { ok: false, erro: 'O valor bruto precisa ser zero ou mais.' };
  const base = numero(o.salario_base);
  const item = { tipo, mes, data_pagamento: data, bruto: dinheiro(bruto), liquido: dinheiro(liquido), empresa: texto(o.empresa, 80), proventos: listaValores(o.proventos), descontos: listaValores(o.descontos) };
  if (Number.isFinite(base) && base > 0) item.salario_base = dinheiro(base);
  return { ok: true, item };
}

function horas(v) { const n = numero(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; }
function validarPonto(o) {
  const mes = texto(o && o.mes, 7);
  if (!MES.test(mes)) return { ok: false, erro: 'Diga o mês da folha de ponto (AAAA-MM).' };
  const ponto = { mes };
  for (const k of ['he50', 'he100', 'noturnas', 'faltas']) {
    const h = o[k] === undefined || o[k] === null || o[k] === '' ? 0 : horas(o[k]);
    if (!Number.isFinite(h)) return { ok: false, erro: 'As horas precisam ser números de zero ou mais.' };
    ponto[k] = h;
  }
  return { ok: true, item: ponto };
}

// 17/11/2026: usa o leitor único (corrida escalonada + NVIDIA + Cloudflare). O antigo tentava só a lista 'fast', uma por vez.
function perguntarVisaoGratis(deps, img, sistema) {
  return require('./visao').perguntarVisao(deps, img, sistema);
}

async function agirSalario(acao, body, c) {
  const { base, agoraIso } = c;
  const lerConfig = async () => {
    const s = await base.collection('config').doc('salario').get();
    return s.exists ? s.data() || {} : {};
  };
  const pagamentosDe = async (mes) => {
    const todos = await c.listar(base.collection('pagamentos'));
    return todos.filter((p) => !mes || p.mes === mes).map((p) => ({ ...p, status: prv.statusDe(p, 'data_pagamento', prv.hojeDe(agoraIso)) })).sort((a, b) => String(a.data_pagamento).localeCompare(String(b.data_pagamento)));
  };
  switch (acao) {
    case 'salario_ler': {
      const im = c.lerImagens(body.imagens, { pdf: true });
      if (!im.ok) return [400, { error: im.erro }];
      const ponto = body.tipo === 'ponto';
      const sistema = ponto ? LER_PONTO : LER_HOLERITE;
      const perguntar = c.deps.perguntarVisao || ((img, s) => perguntarVisaoGratis(c.deps, img, s));
      const lidos = await Promise.all(im.imagens.map(async (img) => {
        try {
          const t = await perguntar(img, sistema);
          const j = t && c.extrairJson(t);
          if (!j) return { ok: false, erro: 'Não consegui ler esta imagem. Tente de novo ou digite os valores.' };
          if (ponto) {
            const v = validarPonto(j);
            return v.ok ? { ok: true, ponto: v.item } : { ok: false, erro: v.erro };
          }
          const v = validarPagamento({ ...j, tipo: TIPOS.includes(j.tipo) ? j.tipo : 'outro' });
          return v.ok ? { ok: true, pagamento: v.item } : { ok: false, erro: v.erro };
        } catch {
          return { ok: false, erro: 'Não consegui ler esta imagem agora.' };
        }
      }));
      return [200, { lidos }];
    }
    case 'pagamento_salvar': {
      const v = validarPagamento(body);
      if (!v.ok) return [400, { error: v.erro }];
      const id = `${v.item.mes}_${v.item.tipo}_${v.item.data_pagamento}`;
      await base.collection('pagamentos').doc(id).set({ ...v.item, status: prv.statusInicial(v.item.data_pagamento, prv.hojeDe(agoraIso)), atualizado_em: agoraIso });
      if (v.item.salario_base > 0) await base.collection('config').doc('salario').set({ ...(await lerConfig()), salario_base: v.item.salario_base, atualizado_em: agoraIso });
      return [200, { ok: true, id }];
    }
    case 'pagamento_listar': {
      const mes = texto(body.mes, 7);
      if (mes && !MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      return [200, { pagamentos: await pagamentosDe(mes) }];
    }
    case 'pagamento_apagar': return c.apagar('pagamentos');
    case 'ponto_salvar': {
      const v = validarPonto(body);
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('folhas_ponto').doc(v.item.mes).set({ ...v.item, atualizado_em: agoraIso });
      return [200, { ok: true, id: v.item.mes }];
    }
    case 'salario_config': {
      const atual = await lerConfig();
      const novo = { ...atual };
      let mudou = false;
      for (const k of ['salario_base', 'dependentes', 'jornada_mensal']) {
        if (body[k] === undefined || body[k] === null || body[k] === '') continue;
        const n = numero(body[k]);
        if (!Number.isFinite(n) || n < 0 || (k === 'jornada_mensal' && n === 0)) return [400, { error: 'Valor inválido em ' + k + '.' }];
        novo[k] = k === 'dependentes' ? Math.floor(n) : dinheiro(n);
        mudou = true;
      }
      if (mudou) { novo.atualizado_em = agoraIso; await base.collection('config').doc('salario').set(novo); }
      return [200, { ok: true, config: novo }];
    }
    case 'salario_previsao': {
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const [cfg, doMes, pontoDoc] = await Promise.all([lerConfig(), pagamentosDe(mes), base.collection('folhas_ponto').doc(mes).get()]);
      // Só o que JÁ caiu conta como recebido; o que tem data futura fica à parte, como "a receber".
      const recebidos = doMes.filter((p) => p.status === 'realizado');
      const a_receber = doMes.filter((p) => p.status === 'previsto');
      const total_recebido = dinheiro(recebidos.reduce((s, p) => s + (Number(p.liquido) || 0), 0));
      const total_a_receber = dinheiro(a_receber.reduce((s, p) => s + (Number(p.liquido) || 0), 0));
      const sai = (previsao, motivo) => [200, { mes, recebidos, total_recebido, a_receber, total_a_receber, previsao, motivo }];
      if (!(cfg.salario_base > 0)) return sai(null, 'Informe seu salário base para eu estimar o fechamento.');
      if (recebidos.some((p) => p.tipo === 'mensal')) return sai(null, 'O mês já fechou: o pagamento mensal já foi recebido.');
      const mensalPrevisto = a_receber.find((p) => p.tipo === 'mensal');
      if (mensalPrevisto) return sai(null, 'O mês já fechou: o pagamento mensal está previsto para ' + String(mensalPrevisto.data_pagamento).slice(8, 10) + '/' + String(mensalPrevisto.data_pagamento).slice(5, 7) + ' e conta como recebido quando cair.');
      const ponto = pontoDoc.exists ? pontoDoc.data() || {} : {};
      const previsao = require('./folha').estimarFechamento({ mes, salario_base: cfg.salario_base, dependentes: cfg.dependentes || 0, jornada_mensal: cfg.jornada_mensal || 220, ponto, recebidos });
      return sai(previsao, '');
    }
    default: return null;
  }
}

module.exports = { agirSalario, perguntarVisaoGratis };
