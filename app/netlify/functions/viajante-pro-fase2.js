'use strict';
// Viajante Pro — PAINEL PREMIUM, Fase 2: Financeiro, Agenda e tarefas, Leads.
// Chamado por viajante-pro-painel.js (já com a sessão do admin conferida).
// Regras da especificação: vendido ≠ recebido; recebido, a receber, a pagar e atrasado separados;
// só BRL (sem somar moedas diferentes); nada inventado.
//
// Coleções (dentro de viajante_contas/<site>/):
//   lancamentos  { tipo: receber|pagar, categoria, descricao, valor, vencimento, status: pendente|pago|cancelado,
//                  pago_em, forma, parcela, viagem_id, cliente_email, fornecedor, observacoes }
//   tarefas      { titulo, descricao, data, hora, prioridade, status: aberta|concluida, responsavel, vinculo{tipo,id} }
// Leads do site: coleção raiz nexia_leads (gravada por /api/leads); aqui só lemos/atualizamos os da Viajante Pro.

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const num = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  const s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const data = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const r2 = n => Math.round(n * 100) / 100;

const CATEGORIAS_FIN = {
  receber: ['venda', 'sinal', 'parcela', 'comissao', 'reembolso_recebido', 'outro'],
  pagar: ['fornecedor', 'comissao', 'despesa', 'imposto', 'taxa', 'reembolso', 'outro'],
};
const FORMAS = ['pix', 'cartao', 'boleto', 'transferencia', 'dinheiro', 'outro'];
const PRIORIDADES = ['baixa', 'media', 'alta'];
const STATUS_LEAD = ['novo', 'conversando', 'testando', 'cliente', 'perdido'];

async function todos(ref) {
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function hojeDe(now) { return new Date(now).toISOString().slice(0, 10); }
function situacao(l, hj) {
  if (l.status === 'pago') return 'pago';
  if (l.status === 'cancelado') return 'cancelado';
  return l.vencimento && l.vencimento < hj ? 'atrasado' : 'pendente';
}
function somarMeses(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

function resumoFinanceiro(lancs, viagens, now, inicio, fim) {
  const hj = hojeDe(now);
  const dentro = d => d && d >= inicio && d <= fim;
  const soma = f => r2(lancs.filter(f).reduce((t, l) => t + num(l.valor), 0));
  const rec = l => l.tipo === 'receber', pag = l => l.tipo === 'pagar';
  const out = {
    periodo: { inicio, fim },
    recebido: soma(l => rec(l) && l.status === 'pago' && dentro(l.pago_em)),
    pago: soma(l => pag(l) && l.status === 'pago' && dentro(l.pago_em)),
    a_receber: soma(l => rec(l) && situacao(l, hj) === 'pendente'),
    a_receber_periodo: soma(l => rec(l) && situacao(l, hj) === 'pendente' && dentro(l.vencimento)),
    atrasado_receber: soma(l => rec(l) && situacao(l, hj) === 'atrasado'),
    a_pagar: soma(l => pag(l) && situacao(l, hj) === 'pendente'),
    atrasado_pagar: soma(l => pag(l) && situacao(l, hj) === 'atrasado'),
    qtd_atrasados_receber: lancs.filter(l => rec(l) && situacao(l, hj) === 'atrasado').length,
    qtd_atrasados_pagar: lancs.filter(l => pag(l) && situacao(l, hj) === 'atrasado').length,
    comissoes_receber: soma(l => rec(l) && l.categoria === 'comissao' && l.status !== 'cancelado'),
    comissoes_pagar: soma(l => pag(l) && l.categoria === 'comissao' && l.status !== 'cancelado'),
  };
  out.saldo_periodo = r2(out.recebido - out.pago);

  // Fluxo de caixa: 6 meses (realizado) + previsão dos pendentes por vencimento
  const base = new Date(now);
  out.fluxo = [];
  for (let i = -3; i <= 2; i++) {
    const m = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    out.fluxo.push({
      mes: m,
      entrou: soma(l => rec(l) && l.status === 'pago' && String(l.pago_em || '').startsWith(m)),
      saiu: soma(l => pag(l) && l.status === 'pago' && String(l.pago_em || '').startsWith(m)),
      previsto_entrar: soma(l => rec(l) && l.status === 'pendente' && String(l.vencimento || '').startsWith(m)),
      previsto_sair: soma(l => pag(l) && l.status === 'pendente' && String(l.vencimento || '').startsWith(m)),
    });
  }

  // Margem por viagem: vendido (valor_total da viagem) × custos lançados a pagar ligados à viagem.
  out.por_viagem = viagens.map(v => {
    const ls = lancs.filter(l => l.viagem_id === v.id && l.status !== 'cancelado');
    const vendido = num(v.valor_total);
    const recebido = r2(ls.filter(l => rec(l) && l.status === 'pago').reduce((t, l) => t + num(l.valor), 0));
    const aReceber = r2(ls.filter(l => rec(l) && l.status !== 'pago').reduce((t, l) => t + num(l.valor), 0));
    const custos = r2(ls.filter(pag).reduce((t, l) => t + num(l.valor), 0));
    const custoBase = custos || num(v.custo_total);
    return {
      id: v.id, nome: v.nome, inicio: v.datas && v.datas.inicio, vendido, recebido, a_receber: aReceber,
      custos: custoBase, custo_fonte: custos ? 'lancamentos' : (num(v.custo_total) ? 'viagem' : ''),
      margem: vendido ? r2(vendido - custoBase) : null,
      falta_lancar: vendido ? r2(Math.max(0, vendido - recebido - aReceber)) : 0,
    };
  }).filter(x => x.vendido || x.recebido || x.custos).sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
  return out;
}

function limparLancamento(b, atual = {}) {
  const tipo = ['receber', 'pagar'].includes(b.tipo) ? b.tipo : (atual.tipo || 'receber');
  const status = ['pendente', 'pago', 'cancelado'].includes(b.status) ? b.status : (atual.status || 'pendente');
  return {
    ...atual,
    tipo,
    categoria: CATEGORIAS_FIN[tipo].includes(b.categoria) ? b.categoria : (atual.categoria || 'outro'),
    descricao: str(b.descricao, 200) || atual.descricao || '',
    valor: b.valor !== undefined ? num(b.valor) : num(atual.valor),
    moeda: 'BRL',
    vencimento: b.vencimento !== undefined ? data(b.vencimento) : (atual.vencimento || ''),
    status,
    pago_em: status === 'pago' ? (data(b.pago_em) || atual.pago_em || '') : '',
    forma: FORMAS.includes(b.forma) ? b.forma : (atual.forma || ''),
    parcela: b.parcela !== undefined ? str(b.parcela, 10) : (atual.parcela || ''),
    viagem_id: b.viagem_id !== undefined ? str(b.viagem_id, 64) : (atual.viagem_id || ''),
    cliente_email: b.cliente_email !== undefined ? str(b.cliente_email, 120).toLowerCase() : (atual.cliente_email || ''),
    fornecedor: b.fornecedor !== undefined ? str(b.fornecedor, 120) : (atual.fornecedor || ''),
    observacoes: b.observacoes !== undefined ? str(b.observacoes, 1000) : (atual.observacoes || ''),
  };
}

async function acoesFase2({ acao, body, contaRef, res, now, aleatorio, db, atividade }) {
  const hj = hojeDe(now);

  // ── Financeiro ──
  if (acao === 'fin-listar') {
    const lancs = (await todos(contaRef.collection('lancamentos'))).map(l => ({ ...l, situacao: situacao(l, hj) }));
    lancs.sort((a, b) => String(a.vencimento || '9').localeCompare(String(b.vencimento || '9')));
    return res(200, { ok: true, lancamentos: lancs });
  }
  if (acao === 'fin-resumo') {
    const inicio = data(body.inicio) || hj.slice(0, 8) + '01';
    const fim = data(body.fim) || hj;
    const [lancs, viagens] = await Promise.all([todos(contaRef.collection('lancamentos')), todos(contaRef.collection('viagens'))]);
    return res(200, { ok: true, ...resumoFinanceiro(lancs, viagens, now, inicio, fim) });
  }
  if (acao === 'fin-salvar') {
    const id = str(body.id, 64);
    if (id) {
      const ref = contaRef.collection('lancamentos').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'Lançamento não encontrado.' });
      const l = { ...limparLancamento(body, snap.data()), atualizado_em: new Date(now).toISOString() };
      if (l.status === 'pago' && !l.pago_em) l.pago_em = hj;
      if (!l.descricao || !(l.valor > 0)) return res(400, { error: 'Informe descrição e valor maior que zero.' });
      await ref.set(l);
      await atividade('financeiro', `${l.status === 'pago' ? (l.tipo === 'receber' ? 'Pagamento recebido' : 'Pagamento feito') : 'Lançamento atualizado'}: ${l.descricao}`, l.viagem_id ? { tipo: 'viagem', id: l.viagem_id } : null);
      return res(200, { ok: true, lancamento: { ...l, id, situacao: situacao(l, hj) } });
    }
    const base = limparLancamento(body);
    if (!base.descricao || !(base.valor > 0)) return res(400, { error: 'Informe descrição e valor maior que zero.' });
    if (base.status === 'pago' && !base.pago_em) base.pago_em = hj;
    const parcelas = Math.min(36, Math.max(1, parseInt(body.parcelas, 10) || 1));
    const venc = base.vencimento || hj;
    // divide em centavos para a soma bater exatamente
    const centavos = Math.round(base.valor * 100);
    const cada = Math.floor(centavos / parcelas);
    const criados = [];
    for (let i = 0; i < parcelas; i++) {
      const valor = (i === parcelas - 1 ? centavos - cada * (parcelas - 1) : cada) / 100;
      const l = {
        ...base, valor,
        vencimento: parcelas > 1 ? somarMeses(venc, i) : base.vencimento,
        parcela: parcelas > 1 ? `${i + 1}/${parcelas}` : base.parcela,
        status: parcelas > 1 && i > 0 ? 'pendente' : base.status,
        pago_em: parcelas > 1 && i > 0 ? '' : base.pago_em,
        criado_em: new Date(now).toISOString(),
      };
      const nid = `${now}-${aleatorio(4)}-${i}`;
      await contaRef.collection('lancamentos').doc(nid).set(l);
      criados.push({ ...l, id: nid, situacao: situacao(l, hj) });
    }
    await atividade('financeiro', `${base.tipo === 'receber' ? 'A receber' : 'A pagar'}: ${base.descricao}${parcelas > 1 ? ` (${parcelas}x)` : ''}`, base.viagem_id ? { tipo: 'viagem', id: base.viagem_id } : null);
    return res(200, { ok: true, lancamentos: criados });
  }
  if (acao === 'fin-excluir') {
    const ref = contaRef.collection('lancamentos').doc(str(body.id, 64));
    const snap = await ref.get();
    if (!snap.exists) return res(404, { error: 'Lançamento não encontrado.' });
    if (body.confirmar !== true) return res(400, { error: 'Confirme a exclusão.' });
    await ref.delete();
    await atividade('financeiro', `Lançamento excluído: ${snap.data().descricao}`, null);
    return res(200, { ok: true });
  }

  // ── Agenda e tarefas ──
  if (acao === 'tarefa-listar') {
    const ts = await todos(contaRef.collection('tarefas'));
    ts.sort((a, b) => `${a.data || '9'} ${a.hora || '99'}`.localeCompare(`${b.data || '9'} ${b.hora || '99'}`));
    return res(200, { ok: true, tarefas: ts });
  }
  if (acao === 'tarefa-salvar') {
    const id = str(body.id, 64) || `${now}-${aleatorio(4)}`;
    const ref = contaRef.collection('tarefas').doc(id);
    const snap = await ref.get();
    const atual = snap.exists ? snap.data() : { criado_em: new Date(now).toISOString() };
    const vt = body.vinculo && ['cliente', 'cotacao', 'viagem'].includes(body.vinculo.tipo) ? { tipo: body.vinculo.tipo, id: str(body.vinculo.id, 190) } : (body.vinculo === null ? null : atual.vinculo || null);
    const t = {
      ...atual,
      titulo: body.titulo !== undefined ? str(body.titulo, 160) : (atual.titulo || ''),
      descricao: body.descricao !== undefined ? str(body.descricao, 2000) : (atual.descricao || ''),
      data: body.data !== undefined ? data(body.data) : (atual.data || ''),
      hora: body.hora !== undefined ? (/^\d{2}:\d{2}$/.test(body.hora) ? body.hora : '') : (atual.hora || ''),
      prioridade: PRIORIDADES.includes(body.prioridade) ? body.prioridade : (atual.prioridade || 'media'),
      status: ['aberta', 'concluida'].includes(body.status) ? body.status : (atual.status || 'aberta'),
      responsavel: body.responsavel !== undefined ? str(body.responsavel, 80) : (atual.responsavel || ''),
      vinculo: vt && vt.id ? vt : null,
      atualizado_em: new Date(now).toISOString(),
    };
    if (!t.titulo) return res(400, { error: 'Informe o título da tarefa.' });
    if (t.status === 'concluida' && atual.status !== 'concluida') t.concluida_em = new Date(now).toISOString();
    await ref.set(t);
    if (!snap.exists || t.status !== atual.status) await atividade('tarefa', `${!snap.exists ? 'Tarefa criada' : t.status === 'concluida' ? 'Tarefa concluída' : 'Tarefa reaberta'}: ${t.titulo}`, t.vinculo);
    return res(200, { ok: true, tarefa: { ...t, id } });
  }
  if (acao === 'tarefa-excluir') {
    const ref = contaRef.collection('tarefas').doc(str(body.id, 64));
    const snap = await ref.get();
    if (!snap.exists) return res(404, { error: 'Tarefa não encontrada.' });
    await ref.delete();
    return res(200, { ok: true });
  }

  // ── Leads do site (formulário antigo /api/leads) ──
  // Na Hostinger o banco é só da Viajante Pro (VP_LEADS_TODOS=1); no banco compartilhado da Kernex filtra pelo site.
  const ehDaViajante = l => (typeof process !== 'undefined' && process.env && process.env.VP_LEADS_TODOS === '1')
    || /viajante/i.test(`${l.site || ''} ${l.origem || ''} ${l.produto || ''} ${l.pagina || ''}`);
  if (acao === 'lead-listar') {
    if (!db) return res(200, { ok: true, leads: [] });
    const ls = (await todos(db.collection('nexia_leads'))).filter(ehDaViajante);
    ls.sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    return res(200, { ok: true, leads: ls });
  }
  if (acao === 'lead-atualizar') {
    if (!db) return res(404, { error: 'Leads indisponíveis.' });
    const ref = db.collection('nexia_leads').doc(str(body.id, 64));
    const snap = await ref.get();
    if (!snap.exists || !ehDaViajante(snap.data())) return res(404, { error: 'Lead não encontrado.' });
    const patch = { atualizado_em: new Date(now).toISOString() };
    if (body.status !== undefined) { if (!STATUS_LEAD.includes(body.status)) return res(400, { error: 'Status inválido.' }); patch.status = body.status; }
    if (body.nota !== undefined) patch.nota = str(body.nota, 1000);
    if (body.motivo_perda !== undefined) patch.motivo_perda = str(body.motivo_perda, 200);
    if (body.proxima_acao !== undefined) patch.proxima_acao = str(body.proxima_acao, 200);
    await ref.update(patch);
    return res(200, { ok: true });
  }

  return null;
}

module.exports = { acoesFase2, resumoFinanceiro, situacao, somarMeses, CATEGORIAS_FIN, FORMAS, PRIORIDADES, STATUS_LEAD };
