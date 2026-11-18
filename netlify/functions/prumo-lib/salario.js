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
{"mes":"AAAA-MM","he50":0,"he75":0,"he100":0,"noturnas":0,"sobreaviso":0,"faltas":0}
Tudo em horas, número (1h30 vira 1.5; 36:39 vira 36.65). he50 = HE 50%, he75 = HE 75%, he100 = HE 100%, noturnas = total de horas noturnas ("Noturno"), sobreaviso = horas de SOBREAVISO à disposição ("Sobreaviso", NÃO o "sobreaviso trabalhado"), faltas = horas de falta. Não some "HE noturna", "HE (+) HE fer.", "sobreaviso trabalhado" nem "feriado trabalhado": já estão dentro dos outros totais. mes = mês do período da folha (se não aparecer, use "").`;

function listaValores(l) {
  const out = [];
  for (const x of Array.isArray(l) ? l.slice(0, 40) : []) {
    const nome = texto(x && x.nome, 80);
    const valor = numero(x && x.valor);
    if (nome && Number.isFinite(valor) && valor >= 0) out.push({ nome, valor: dinheiro(valor) });
  }
  return out;
}

/** Aprende o perfil da folha de um holerite MENSAL (proventos/descontos lidos). Só devolve o que achou. */
const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function perfilDoHolerite(item) {
  if (!item || item.tipo !== 'mensal') return null;
  const out = {}; let fixos = 0, naoTrib = 0, prev = 0, desc = 0, achou = false;
  for (const p of item.proventos || []) {
    const n = sem(p.nome);
    const pct = /noturn/.test(n) && /(\d{2})\s*%/.exec(n);
    if (pct) { out.noturno_pct = Number(pct[1]); achou = true; }
    else if (/trienio|anuenio|quinquenio|biênio|bienio|gratificacao|adicional de tempo/.test(n)) { fixos += p.valor; achou = true; }
    else if (/ajuda de custo|home office|auxilio (home|internet|energia)/.test(n)) { naoTrib += p.valor; achou = true; }
  }
  for (const d of item.descontos || []) {
    const n = sem(d.nome);
    if (/adiant|inss|ir retido|irrf|imposto|base |fgts|salario contrib|rat\b|empregador/.test(n)) continue;
    if (/prev|previd|pgbl|fundo de pensao/.test(n)) { prev += d.valor; achou = true; }
    else if (/vale (alimenta|refei)|\bva\b|\bvr\b|plano|saude|odont|convenio|sindic|seguro de vida|vale transp/.test(n)) { desc += d.valor; achou = true; }
  }
  if (!achou) return null;
  if (fixos) out.fixos = dinheiro(fixos);
  if (naoTrib) out.nao_tributavel = dinheiro(naoTrib);
  if (prev && item.salario_base > 0) out.prev_pct = Math.round((prev / item.salario_base) * 10000) / 100;
  if (desc) out.descontos_fixos = dinheiro(desc);
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

// Aceita 36.65, "36,65" e "36:39" (horas:minutos, como na folha de ponto).
function horas(v) { const hm = typeof v === 'string' ? /^\s*(\d+):(\d{1,2})\s*$/.exec(v) : null; const n = hm ? Number(hm[1]) + Number(hm[2]) / 60 : numero(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; }
const CAMPOS_PONTO = ['he50', 'he75', 'he100', 'noturnas', 'sobreaviso', 'faltas'];
function validarPonto(o) {
  const mes = texto(o && o.mes, 7);
  if (!MES.test(mes)) return { ok: false, erro: 'Diga o mês da folha de ponto (AAAA-MM).' };
  const ponto = { mes };
  for (const k of CAMPOS_PONTO) {
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
            const v = validarPonto({ ...j, mes: MES.test(String(j.mes || '')) ? j.mes : (MES.test(String(body.mes || '')) ? body.mes : agoraIso.slice(0, 7)) });
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
      // Editou e mudou data/tipo/mês: o id muda; apaga o antigo para não ficar duplicado.
      const antigo = texto(body.id, 80);
      if (antigo && antigo !== id) await base.collection('pagamentos').doc(antigo).delete();
      // Holerite MENSAL ensina o perfil da folha (noturno %, triênio, ajuda de custo, previdência, VA).
      const perfil = perfilDoHolerite(v.item);
      if (v.item.salario_base > 0 || perfil) {
        const cfg = await lerConfig();
        const novo = { ...cfg, atualizado_em: agoraIso };
        // 18/11 (verificação): holerite ANTIGO não pode trocar o salário novo (out/2026 8.446,37 apagava o de nov 8.868,69).
        // Só atualiza com holerite do mesmo mês ou mais novo que o último usado; o perfil idem.
        // Salário salvo antes desta regra não tem o mês: vale o mês em que foi salvo.
        const mesBase = cfg.salario_base_mes || (cfg.salario_base > 0 ? String(cfg.atualizado_em || '').slice(0, 7) : '');
        if (v.item.salario_base > 0 && !(mesBase && v.item.mes < mesBase)) { novo.salario_base = v.item.salario_base; novo.salario_base_mes = v.item.mes; }
        if (perfil && !(cfg.perfil_mes && v.item.mes < cfg.perfil_mes)) { novo.perfil = { ...(cfg.perfil || {}), ...perfil }; novo.perfil_mes = v.item.mes; }
        else if (perfil && !cfg.perfil) novo.perfil = perfil;
        await base.collection('config').doc('salario').set(novo);
      }
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
    case 'ponto_apagar': {
      const mes = texto(body.mes, 7);
      if (!MES.test(mes)) return [400, { error: 'Diga o mês da folha de ponto (AAAA-MM).' }];
      await base.collection('folhas_ponto').doc(mes).delete();
      return [200, { ok: true }];
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
        // Salário digitado à mão vale a partir deste mês (holerite antigo não o troca depois).
        if (k === 'salario_base' && novo.salario_base !== atual.salario_base) novo.salario_base_mes = agoraIso.slice(0, 7);
        mudou = true;
      }
      // Ajustes da folha (à mão): mesmos campos do perfil aprendido.
      if (body.perfil && typeof body.perfil === 'object') {
        const lim = { noturno_pct: 100, fixos: 1e6, nao_tributavel: 1e6, prev_pct: 50, descontos_fixos: 1e6 };
        const pf = { ...(atual.perfil || {}) };
        for (const k of Object.keys(lim)) {
          const v = body.perfil[k];
          if (v === undefined || v === null || v === '') { delete pf[k]; continue; }
          const n = numero(v);
          if (!Number.isFinite(n) || n < 0 || n > lim[k]) return [400, { error: 'Valor inválido em ' + k + '.' }];
          pf[k] = k.endsWith('_pct') ? Math.round(n * 100) / 100 : dinheiro(n);
        }
        novo.perfil = pf; mudou = true;
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
      const pontoMes = pontoDoc.exists ? { ...(pontoDoc.data() || {}), mes } : null;
      const sai = (previsao, motivo) => [200, { mes, recebidos, total_recebido, a_receber, total_a_receber, previsao, motivo, ponto: pontoMes }];
      if (!(cfg.salario_base > 0)) return sai(null, 'Informe seu salário base para eu estimar o fechamento.');
      if (recebidos.some((p) => p.tipo === 'mensal')) return sai(null, 'O mês já fechou: o pagamento mensal já foi recebido.');
      const mensalPrevisto = a_receber.find((p) => p.tipo === 'mensal');
      if (mensalPrevisto) return sai(null, 'O mês já fechou: o pagamento mensal está previsto para ' + String(mensalPrevisto.data_pagamento).slice(8, 10) + '/' + String(mensalPrevisto.data_pagamento).slice(5, 7) + ' e conta como recebido quando cair.');
      const ponto = pontoDoc.exists ? pontoDoc.data() || {} : {};
      const previsao = require('./folha').estimarFechamento({ mes, salario_base: cfg.salario_base, dependentes: cfg.dependentes || 0, jornada_mensal: cfg.jornada_mensal || 220, ponto, recebidos, perfil: cfg.perfil || {} });
      return sai(previsao, '');
    }
    default: return null;
  }
}

module.exports = { agirSalario, perguntarVisaoGratis, perfilDoHolerite };
