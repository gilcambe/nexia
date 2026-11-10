'use strict';
// Viajante Pro — ações do PAINEL PREMIUM (Fase 1).
// Chamado por netlify/functions/viajante-pro.js DEPOIS da checagem de sessão do admin.
// Não altera nem substitui nenhuma ação antiga: só acrescenta ações novas.
// Regras da especificação: nenhum número inventado; todo indicador sai dos dados reais.
//
// Coleções usadas (todas dentro de viajante_contas/<site>/):
//   cotacoes (já existia; ganhou campos opcionais: itens, desconto, taxas, validade, canal…)
//   viagens  (já existia; ganhou campos opcionais: status, servicos, cliente_email, valor_total…)
//   clientes (nova; só dados extras do CRM. A lista de clientes nasce das cotações e viagens)
//   documentos (nova; metadados. O arquivo em si fica no servidor da Hostinger: /api/vp-arquivos)
//   atividades (nova; trilha do que foi feito no painel)

const STATUS_COTACAO = ['rascunho', 'em_preparacao', 'enviada', 'visualizada', 'em_negociacao', 'aprovada', 'recusada', 'expirada'];
const ROTULO_COTACAO = {
  nova: 'Nova', rascunho: 'Rascunho', em_preparacao: 'Em preparação', enviada: 'Enviada', visualizada: 'Visualizada',
  em_negociacao: 'Em negociação', aprovada: 'Aprovada', recusada: 'Recusada', expirada: 'Expirada',
};
const FECHADAS = new Set(['aprovada', 'recusada', 'expirada', 'fechada', 'cancelada', 'convertida', 'perdida']);
const STATUS_VIAGEM = ['planejada', 'confirmada', 'em_andamento', 'concluida', 'cancelada'];
const TIPOS_SERVICO = ['voo', 'hotel', 'transfer', 'passeio', 'seguro', 'trem', 'carro', 'cruzeiro', 'outro'];
const CANAIS = ['site', 'whatsapp', 'instagram', 'indicacao', 'telefone', 'email', 'presencial', 'outro'];

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const num = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  const s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  // aceita "1.234,56" e "1234.56"
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const data = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const emailOk = e => /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i.test(e);
const hoje = now => new Date(now).toISOString().slice(0, 10);

function statusCotacao(c) {
  const s = String(c.status || 'nova').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
  if (s === 'respondida') return 'enviada';
  if (s === 'em_andamento' || s === 'em_atendimento') return 'em_preparacao';
  if (s === 'fechada' || s === 'convertida') return 'aprovada';
  if (s === 'cancelada' || s === 'perdida') return 'recusada';
  return ROTULO_COTACAO[s] ? s : 'nova';
}

function totaisCotacao(c) {
  const itens = Array.isArray(c.itens) ? c.itens : [];
  const custo = itens.reduce((t, i) => t + num(i.custo), 0);
  const bruto = itens.reduce((t, i) => t + num(i.preco), 0);
  const venda = Math.max(0, bruto - num(c.desconto) + num(c.taxas));
  return { custo: Math.round(custo * 100) / 100, venda: Math.round(venda * 100) / 100, margem: Math.round((venda - custo) * 100) / 100, temValores: itens.length > 0 };
}

function limparItens(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 60).map(i => ({
    tipo: TIPOS_SERVICO.includes(i && i.tipo) ? i.tipo : 'outro',
    descricao: str(i && i.descricao, 300),
    fornecedor: str(i && i.fornecedor, 120),
    custo: num(i && i.custo),
    preco: num(i && i.preco),
  })).filter(i => i.descricao || i.preco || i.custo);
}

function limparServicos(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 80).map(s => ({
    tipo: TIPOS_SERVICO.includes(s && s.tipo) ? s.tipo : 'outro',
    descricao: str(s && s.descricao, 300),
    fornecedor: str(s && s.fornecedor, 120),
    localizador: str(s && s.localizador, 60),
    inicio: str(s && s.inicio, 20),
    fim: str(s && s.fim, 20),
    status: ['solicitada', 'confirmada', 'cancelada'].includes(s && s.status) ? s.status : 'solicitada',
    observacoes: str(s && s.observacoes, 500),
  })).filter(s => s.descricao || s.localizador);
}

async function sha256(s) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function todos(ref) {
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function registrarAtividade(contaRef, now, aleatorio, tipo, texto, ref) {
  try {
    const id = `${now}-${aleatorio(4)}`;
    await contaRef.collection('atividades').doc(id).set({ id, tipo, texto: str(texto, 200), ref: ref || null, criado_em: new Date(now).toISOString() });
  } catch { /* trilha nunca derruba a ação */ }
}

// Clientes = e-mails que aparecem em cotações e viagens + cadastros manuais, sem duplicar.
function montarClientes(cotacoes, viagens, extras) {
  const mapa = new Map();
  const pegar = email => {
    const e = String(email || '').trim().toLowerCase();
    if (!e || !e.includes('@')) return null;
    if (!mapa.has(e)) mapa.set(e, { email: e, nome: '', whatsapp: '', cotacoes: 0, viagens: 0, aprovadas: 0, valor_aprovado: 0, primeira: null, ultima: null, canal: '' });
    return mapa.get(e);
  };
  const marca = (c, quando) => {
    if (!quando) return;
    if (!c.primeira || quando < c.primeira) c.primeira = quando;
    if (!c.ultima || quando > c.ultima) c.ultima = quando;
  };
  for (const q of cotacoes) {
    const c = pegar(q.email);
    if (!c) continue;
    c.cotacoes++;
    if (!c.nome && q.nome) c.nome = q.nome;
    if (!c.whatsapp && q.whatsapp) c.whatsapp = q.whatsapp;
    if (!c.canal) c.canal = q.canal || 'site';
    if (statusCotacao(q) === 'aprovada') { c.aprovadas++; c.valor_aprovado += totaisCotacao(q).venda; }
    marca(c, q.criado_em);
  }
  for (const v of viagens) {
    const emails = new Set([v.cliente_email, v.email].filter(Boolean).map(x => String(x).toLowerCase()));
    for (const e of emails) {
      const c = pegar(e);
      if (!c) continue;
      c.viagens++;
      if (!c.nome) c.nome = (v.passageiros && v.passageiros[0] && v.passageiros[0].nome) || v.nome || '';
      if (!c.whatsapp && v.whatsapp) c.whatsapp = v.whatsapp;
      marca(c, v.criado_em);
    }
  }
  for (const x of extras) {
    const c = pegar(x.email);
    if (!c) continue;
    Object.assign(c, {
      nome: x.nome || c.nome,
      whatsapp: x.whatsapp || c.whatsapp,
      vip: !!x.vip,
      etiquetas: Array.isArray(x.etiquetas) ? x.etiquetas : [],
      canal: x.canal || c.canal,
      cadastrado: true,
    });
    marca(c, x.criado_em);
  }
  return [...mapa.values()].sort((a, b) => String(b.ultima || '').localeCompare(String(a.ultima || '')));
}

function limparCliente(b, atual = {}) {
  const pref = b.preferencias && typeof b.preferencias === 'object' ? b.preferencias : {};
  return {
    ...atual,
    email: String(b.email || atual.email || '').trim().toLowerCase(),
    nome: str(b.nome, 120) || atual.nome || '',
    whatsapp: str(b.whatsapp, 30).replace(/[^\d+]/g, '') || atual.whatsapp || '',
    cidade: str(b.cidade, 100),
    documento: str(b.documento, 40), // CPF/passaporte: só a agência vê (LGPD)
    aniversario: data(b.aniversario),
    canal: CANAIS.includes(b.canal) ? b.canal : (atual.canal || ''),
    vip: !!b.vip,
    etiquetas: (Array.isArray(b.etiquetas) ? b.etiquetas : String(b.etiquetas || '').split(',')).map(t => str(t, 30)).filter(Boolean).slice(0, 15),
    orcamento_habitual: str(b.orcamento_habitual, 60),
    viajantes_habituais: str(b.viajantes_habituais, 60),
    preferencias: {
      destinos: str(pref.destinos, 300), hospedagem: str(pref.hospedagem, 300), companhia: str(pref.companhia, 120),
      classe: str(pref.classe, 60), assento: str(pref.assento, 60), experiencias: str(pref.experiencias, 500),
      atendimento: str(pref.atendimento, 200),
    },
    ocasioes: str(b.ocasioes, 500),
    observacoes: str(b.observacoes, 2000),
  };
}

function novaViagemDe(cot, aleatorio, now) {
  const id = aleatorio(12);
  const passageiros = [{ nome: cot.nome || '', email: cot.email || '', tipo: 'adulto' }];
  for (let i = 1; i < (parseInt(cot.adultos, 10) || 1); i++) passageiros.push({ nome: '', email: '', tipo: 'adulto' });
  for (let i = 0; i < (parseInt(cot.criancas, 10) || 0); i++) passageiros.push({ nome: '', email: '', tipo: 'crianca' });
  return {
    id,
    nome: `${cot.nome || 'Cliente'} — ${cot.destino || 'Viagem'}`.slice(0, 100),
    destino: str(cot.destino, 100) || 'A definir',
    email: cot.email || '',
    cliente_email: cot.email || '',
    whatsapp: String(cot.whatsapp || '').replace(/\D/g, ''),
    datas: { inicio: data(cot.dataIda), fim: data(cot.dataVolta) },
    passageiros,
    roteiro: [],
    servicos: limparItens(cot.itens).map(i => ({ tipo: i.tipo, descricao: i.descricao, fornecedor: i.fornecedor, localizador: '', inicio: '', fim: '', status: 'solicitada', observacoes: '' })),
    status: 'confirmada',
    valor_total: totaisCotacao(cot).venda,
    custo_total: totaisCotacao(cot).custo,
    cotacao_id: cot.id,
    codigoSecreto: aleatorio(24),
    criado_em: new Date(now).toISOString(),
    atualizado_em: new Date(now).toISOString(),
  };
}

function mesesAtras(now, n) {
  const d = new Date(now);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}

async function resumo(contaRef, body, now, db) {
  const dias = [7, 30, 90, 365].includes(parseInt(body.dias, 10)) ? parseInt(body.dias, 10) : 30;
  const desde = new Date(now - dias * 86400000).toISOString();
  const hj = hoje(now);
  const [cotacoes, viagens, extras, docs, ativs, lancs, tarefas] = await Promise.all([
    todos(contaRef.collection('cotacoes')), todos(contaRef.collection('viagens')),
    todos(contaRef.collection('clientes')), todos(contaRef.collection('documentos')),
    todos(contaRef.collection('atividades')), todos(contaRef.collection('lancamentos')),
    todos(contaRef.collection('tarefas')),
  ]);
  const { resumoFinanceiro, situacao } = require('./viajante-pro-fase2');
  const fin = resumoFinanceiro(lancs, viagens, now, desde.slice(0, 10), hj);
  const pagAtrasados = lancs.filter(l => situacao(l, hj) === 'atrasado');
  const tarefasAbertas = tarefas.filter(t => t.status !== 'concluida');
  const tarefasAtrasadas = tarefasAbertas.filter(t => t.data && t.data < hj);
  const tarefasHoje = tarefasAbertas.filter(t => t.data === hj);
  let leadsNovos = 0;
  if (db) {
    const todosLeads = process.env.VP_LEADS_TODOS === '1';
    try { leadsNovos = (await todos(db.collection('nexia_leads'))).filter(l => (todosLeads || /viajante/i.test(`${l.site || ''} ${l.origem || ''} ${l.produto || ''} ${l.pagina || ''}`)) && (l.status || 'novo') === 'novo').length; } catch { leadsNovos = 0; }
  }

  const clientes = montarClientes(cotacoes, viagens, extras);
  const abertas = cotacoes.filter(c => !FECHADAS.has(statusCotacao(c)));
  const noPeriodo = cotacoes.filter(c => (c.criado_em || '') >= desde);
  const aprovPeriodo = cotacoes.filter(c => statusCotacao(c) === 'aprovada' && ((c.aprovada_em || c.atualizado_em || c.criado_em || '') >= desde));
  const vendido = aprovPeriodo.reduce((t, c) => t + totaisCotacao(c).venda, 0);
  const comValor = aprovPeriodo.filter(c => totaisCotacao(c).temValores);
  const margem = comValor.reduce((t, c) => t + totaisCotacao(c).margem, 0);
  const aberto = abertas.reduce((t, c) => t + totaisCotacao(c).venda, 0);

  const ativa = v => !['cancelada', 'concluida'].includes(v.status || '');
  const proximas = viagens.filter(v => ativa(v) && (v.datas && v.datas.inicio || '') >= hj)
    .sort((a, b) => a.datas.inicio.localeCompare(b.datas.inicio));
  const emViagem = viagens.filter(v => ativa(v) && v.datas && v.datas.inicio && v.datas.inicio <= hj && (v.datas.fim || v.datas.inicio) >= hj);
  const confirmadas = viagens.filter(v => (v.status || 'confirmada') === 'confirmada' && ativa(v));

  // Conversas sem resposta: última mensagem é do viajante.
  const semResposta = [];
  for (const v of viagens) {
    const msgs = await todos(contaRef.collection('viagens').doc(v.id).collection('mensagens'));
    if (!msgs.length) continue;
    msgs.sort((a, b) => String(a.ordem || a.criado_em).localeCompare(String(b.ordem || b.criado_em)));
    const ult = msgs[msgs.length - 1];
    if (ult.autor === 'viajante') semResposta.push({ viagemId: v.id, viagemNome: v.nome, texto: ult.texto, criado_em: ult.criado_em });
  }

  const meses = mesesAtras(now, 6);
  const serie = meses.map(m => ({
    mes: m,
    cotacoes: cotacoes.filter(c => (c.criado_em || '').startsWith(m)).length,
    aprovadas: cotacoes.filter(c => statusCotacao(c) === 'aprovada' && (c.aprovada_em || c.atualizado_em || c.criado_em || '').startsWith(m)).length,
    vendido: cotacoes.filter(c => statusCotacao(c) === 'aprovada' && (c.aprovada_em || c.atualizado_em || c.criado_em || '').startsWith(m)).reduce((t, c) => t + totaisCotacao(c).venda, 0),
    viagens: viagens.filter(v => (v.datas && v.datas.inicio || '').startsWith(m)).length,
  }));

  const origem = {};
  for (const c of noPeriodo) { const k = c.canal || 'site'; origem[k] = (origem[k] || 0) + 1; }

  const contar = lista => {
    const m = {};
    for (const x of lista) { const d = String(x || '').trim(); if (d) m[d] = (m[d] || 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([destino, total]) => ({ destino, total }));
  };

  const funil = { recebidas: noPeriodo.length };
  for (const s of ['nova', ...STATUS_COTACAO]) funil[s] = noPeriodo.filter(c => statusCotacao(c) === s).length;

  const vencendo = abertas.filter(c => c.validade && c.validade >= hj && c.validade <= new Date(now + 3 * 86400000).toISOString().slice(0, 10));
  const vencidas = abertas.filter(c => c.validade && c.validade < hj);
  const servicosPendentes = proximas.filter(v => (v.servicos || []).some(s => s.status === 'solicitada'));
  const docsVencendo = docs.filter(d => d.validade && d.validade <= new Date(now + 30 * 86400000).toISOString().slice(0, 10));

  const resumoCot = c => ({ id: c.id, codigo: c.codigo, nome: c.nome, destino: c.destino, status: statusCotacao(c), criado_em: c.criado_em, validade: c.validade || '', valor: totaisCotacao(c).venda });
  const resumoViagem = v => ({ id: v.id, nome: v.nome, destino: v.destino, datas: v.datas, status: v.status || 'confirmada' });

  return {
    periodo_dias: dias,
    atualizado_em: new Date(now).toISOString(),
    kpis: {
      clientes: clientes.length,
      clientes_novos: clientes.filter(c => (c.primeira || '') >= desde).length,
      cotacoes_abertas: abertas.length,
      cotacoes_novas: cotacoes.filter(c => statusCotacao(c) === 'nova').length,
      cotacoes_periodo: noPeriodo.length,
      valor_em_aberto: Math.round(aberto * 100) / 100,
      viagens_confirmadas: confirmadas.length,
      viagens_proximas: proximas.length,
      em_viagem: emViagem.length,
      vendido_periodo: Math.round(vendido * 100) / 100,
      aprovadas_periodo: aprovPeriodo.length,
      // conversão = aprovadas no período ÷ cotações recebidas no período
      conversao: noPeriodo.length ? Math.round((aprovPeriodo.length / noPeriodo.length) * 1000) / 10 : null,
      ticket_medio: aprovPeriodo.length ? Math.round((vendido / aprovPeriodo.length) * 100) / 100 : null,
      margem_estimada: comValor.length ? Math.round(margem * 100) / 100 : null,
      conversas_sem_resposta: semResposta.length,
      recebido_periodo: fin.recebido,
      a_receber: fin.a_receber,
      atrasado_receber: fin.atrasado_receber,
      a_pagar: fin.a_pagar,
      tem_financeiro: lancs.length > 0,
      tarefas_hoje: tarefasHoje.length,
      leads_novos: leadsNovos,
      tarefas_atrasadas: tarefasAtrasadas.length,
    },
    serie,
    origem,
    destinos_procurados: contar(noPeriodo.map(c => c.destino)),
    destinos_vendidos: contar(aprovPeriodo.map(c => c.destino)),
    funil,
    listas: {
      ultimas_cotacoes: [...cotacoes].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 6).map(resumoCot),
      ultimos_clientes: clientes.slice(0, 6).map(c => ({ email: c.email, nome: c.nome, ultima: c.ultima, vip: !!c.vip })),
      proximas_viagens: proximas.slice(0, 6).map(resumoViagem),
      conversas_sem_resposta: semResposta.slice(0, 6),
      atividades: ativs.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 8),
    },
    alertas: {
      cotacoes_vencendo: vencendo.map(resumoCot),
      cotacoes_vencidas: vencidas.map(resumoCot),
      servicos_pendentes: servicosPendentes.slice(0, 6).map(resumoViagem),
      documentos_vencendo: docsVencendo.slice(0, 6).map(d => ({ id: d.id, nome: d.nome, validade: d.validade, vinculo: d.vinculo })),
      pagamentos_atrasados: pagAtrasados.slice(0, 8).map(l => ({ id: l.id, tipo: l.tipo, descricao: l.descricao, valor: num(l.valor), vencimento: l.vencimento })),
      tarefas_atrasadas: tarefasAtrasadas.slice(0, 6).map(t => ({ id: t.id, titulo: t.titulo, data: t.data })),
      tarefas_hoje: tarefasHoje.slice(0, 8).map(t => ({ id: t.id, titulo: t.titulo, hora: t.hora, prioridade: t.prioridade })),
    },
  };
}

/**
 * Executa uma ação do painel premium. Devolve a resposta (via res) ou null se a ação não é daqui.
 */
async function acoesPainel({ acao, body, contaRef, res, now, aleatorio, db }) {
  if (acao === 'painel-resumo') return res(200, { ok: true, ...(await resumo(contaRef, body, now, db)) });

  // ── Cotações ──
  if (acao === 'cotacao-detalhe') {
    const snap = await contaRef.collection('cotacoes').doc(str(body.id, 64)).get();
    if (!snap.exists) return res(404, { error: 'Cotação não encontrada.' });
    const c = snap.data();
    return res(200, { ok: true, cotacao: { ...c, status_painel: statusCotacao(c), totais: totaisCotacao(c) } });
  }

  if (acao === 'cotacao-criar' || acao === 'cotacao-salvar') {
    const criando = acao === 'cotacao-criar';
    const id = criando ? aleatorio(8).toUpperCase() : str(body.id, 64);
    const ref = contaRef.collection('cotacoes').doc(id);
    let atual = {};
    if (!criando) {
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'Cotação não encontrada.' });
      atual = snap.data();
    }
    const nome = str(body.nome, 100) || atual.nome || '';
    const email = (str(body.email, 120) || atual.email || '').toLowerCase();
    if (!nome) return res(400, { error: 'Informe o nome do cliente.' });
    if (email && !emailOk(email)) return res(400, { error: 'E-mail inválido.' });
    const statusNovo = body.status ? str(body.status, 30) : '';
    if (statusNovo && !STATUS_COTACAO.includes(statusNovo)) return res(400, { error: 'Status inválido.' });

    const c = {
      ...atual,
      id,
      codigo: atual.codigo || `VP-${id}`,
      nome,
      email,
      whatsapp: body.whatsapp !== undefined ? str(body.whatsapp, 30) : (atual.whatsapp || ''),
      origem: body.origem !== undefined ? str(body.origem, 100) : (atual.origem || ''),
      destino: body.destino !== undefined ? str(body.destino, 100) : (atual.destino || ''),
      dataIda: body.dataIda !== undefined ? data(body.dataIda) : (atual.dataIda || ''),
      dataVolta: body.dataVolta !== undefined ? data(body.dataVolta) : (atual.dataVolta || ''),
      adultos: body.adultos !== undefined ? Math.max(1, parseInt(body.adultos, 10) || 1) : (atual.adultos || 1),
      criancas: body.criancas !== undefined ? Math.max(0, parseInt(body.criancas, 10) || 0) : (atual.criancas || 0),
      itens: body.itens !== undefined ? limparItens(body.itens) : (atual.itens || []),
      desconto: body.desconto !== undefined ? num(body.desconto) : num(atual.desconto),
      taxas: body.taxas !== undefined ? num(body.taxas) : num(atual.taxas),
      moeda: 'BRL',
      validade: body.validade !== undefined ? data(body.validade) : (atual.validade || ''),
      condicoes: body.condicoes !== undefined ? str(body.condicoes, 2000) : (atual.condicoes || ''),
      formas_pagamento: body.formas_pagamento !== undefined ? str(body.formas_pagamento, 500) : (atual.formas_pagamento || ''),
      observacoes_internas: body.observacoes_internas !== undefined ? str(body.observacoes_internas, 2000) : (atual.observacoes_internas || ''),
      responsavel: body.responsavel !== undefined ? str(body.responsavel, 80) : (atual.responsavel || ''),
      canal: CANAIS.includes(body.canal) ? body.canal : (atual.canal || (criando ? 'outro' : 'site')),
      atualizado_em: new Date(now).toISOString(),
    };
    if (criando) {
      c.status = statusNovo || 'em_preparacao';
      c.criado_em = new Date(now).toISOString();
      c.observacoes = str(body.observacoes, 1000);
      c.historico = [{ status_anterior: null, novo_status: c.status, observacoes: 'Criada no painel', data: c.criado_em }];
    } else if (statusNovo && statusNovo !== statusCotacao(atual)) {
      c.historico = [...(Array.isArray(atual.historico) ? atual.historico : []), { status_anterior: atual.status, novo_status: statusNovo, observacoes: '', data: c.atualizado_em }];
      c.status = statusNovo;
      if (statusNovo === 'aprovada') c.aprovada_em = c.atualizado_em;
    }
    await ref.set(c);
    await registrarAtividade(contaRef, now, aleatorio, 'cotacao', `${criando ? 'Cotação criada' : 'Cotação atualizada'}: ${c.codigo} · ${c.nome}`, { tipo: 'cotacao', id });
    return res(200, { ok: true, cotacao: { ...c, status_painel: statusCotacao(c), totais: totaisCotacao(c) } });
  }

  if (acao === 'cotacao-converter') {
    const ref = contaRef.collection('cotacoes').doc(str(body.id, 64));
    const snap = await ref.get();
    if (!snap.exists) return res(404, { error: 'Cotação não encontrada.' });
    const cot = snap.data();
    if (cot.viagem_id) {
      const vs = await contaRef.collection('viagens').doc(cot.viagem_id).get();
      if (vs.exists) return res(409, { error: 'Esta cotação já virou viagem.', viagem_id: cot.viagem_id });
    }
    const viagem = novaViagemDe({ ...cot, id: ref.id }, aleatorio, now);
    await contaRef.collection('viagens').doc(viagem.id).set(viagem);
    const quando = new Date(now).toISOString();
    await ref.update({
      status: 'aprovada', aprovada_em: cot.aprovada_em || quando, viagem_id: viagem.id, atualizado_em: quando,
      historico: [...(Array.isArray(cot.historico) ? cot.historico : []), { status_anterior: cot.status, novo_status: 'aprovada', observacoes: 'Convertida em viagem', data: quando }],
    });
    await registrarAtividade(contaRef, now, aleatorio, 'viagem', `Cotação ${cot.codigo || ref.id} convertida em viagem`, { tipo: 'viagem', id: viagem.id });
    return res(200, { ok: true, viagem, link: `/viajante-pro/app?v=${viagem.codigoSecreto}` });
  }

  if (acao === 'cotacao-excluir') {
    const ref = contaRef.collection('cotacoes').doc(str(body.id, 64));
    const snap = await ref.get();
    if (!snap.exists) return res(404, { error: 'Cotação não encontrada.' });
    if (body.confirmar !== true) return res(400, { error: 'Confirme a exclusão.' });
    await ref.delete();
    await registrarAtividade(contaRef, now, aleatorio, 'cotacao', `Cotação excluída: ${snap.data().codigo || ref.id}`, null);
    return res(200, { ok: true });
  }

  // ── Viagens (detalhes extras; viagem-criar/editar/excluir antigos continuam iguais) ──
  if (acao === 'viagem-detalhe') {
    const snap = await contaRef.collection('viagens').doc(str(body.id, 64)).get();
    if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });
    return res(200, { ok: true, viagem: snap.data(), link: `/viajante-pro/app?v=${snap.data().codigoSecreto}` });
  }

  if (acao === 'viagem-salvar-detalhes') {
    const ref = contaRef.collection('viagens').doc(str(body.id, 64));
    const snap = await ref.get();
    if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });
    const atual = snap.data();
    const status = body.status !== undefined ? str(body.status, 20) : (atual.status || 'confirmada');
    if (!STATUS_VIAGEM.includes(status)) return res(400, { error: 'Status inválido.' });
    const cEmail = body.cliente_email !== undefined ? str(body.cliente_email, 120).toLowerCase() : (atual.cliente_email || '');
    if (cEmail && !emailOk(cEmail)) return res(400, { error: 'E-mail do cliente inválido.' });
    const novo = {
      status,
      cliente_email: cEmail,
      servicos: body.servicos !== undefined ? limparServicos(body.servicos) : (atual.servicos || []),
      valor_total: body.valor_total !== undefined ? num(body.valor_total) : num(atual.valor_total),
      custo_total: body.custo_total !== undefined ? num(body.custo_total) : num(atual.custo_total),
      observacoes_internas: body.observacoes_internas !== undefined ? str(body.observacoes_internas, 2000) : (atual.observacoes_internas || ''),
      mensagem_boas_vindas: body.mensagem_boas_vindas !== undefined ? str(body.mensagem_boas_vindas, 600) : (atual.mensagem_boas_vindas || ''),
      contato_emergencia: body.contato_emergencia !== undefined ? str(body.contato_emergencia, 120) : (atual.contato_emergencia || ''),
      atualizado_em: new Date(now).toISOString(),
    };
    await ref.update(novo);
    await registrarAtividade(contaRef, now, aleatorio, 'viagem', `Viagem atualizada: ${atual.nome}`, { tipo: 'viagem', id: ref.id });
    return res(200, { ok: true, viagem: { ...atual, ...novo } });
  }

  // ── Clientes ──
  if (acao === 'cliente-listar') {
    const [cotacoes, viagens, extras] = await Promise.all([
      todos(contaRef.collection('cotacoes')), todos(contaRef.collection('viagens')), todos(contaRef.collection('clientes')),
    ]);
    return res(200, { ok: true, clientes: montarClientes(cotacoes, viagens, extras) });
  }

  if (acao === 'cliente-detalhe') {
    const email = str(body.email, 120).toLowerCase();
    if (!emailOk(email)) return res(400, { error: 'E-mail inválido.' });
    const [cotacoes, viagens, docs, extraSnap] = await Promise.all([
      todos(contaRef.collection('cotacoes')), todos(contaRef.collection('viagens')), todos(contaRef.collection('documentos')),
      contaRef.collection('clientes').doc(await sha256(email)).get(),
    ]);
    const minhasCot = cotacoes.filter(c => String(c.email || '').toLowerCase() === email);
    const minhasViagens = viagens.filter(v => [v.email, v.cliente_email].some(e => String(e || '').toLowerCase() === email));
    const ids = new Set([...minhasCot.map(c => `cotacao:${c.id}`), ...minhasViagens.map(v => `viagem:${v.id}`), `cliente:${email}`]);
    const base = montarClientes(minhasCot, minhasViagens, extraSnap.exists ? [extraSnap.data()] : [])[0] || { email };
    return res(200, {
      ok: true,
      cliente: { ...base, ...(extraSnap.exists ? extraSnap.data() : {}) },
      cotacoes: minhasCot.map(c => ({ id: c.id, codigo: c.codigo, destino: c.destino, status: statusCotacao(c), criado_em: c.criado_em, valor: totaisCotacao(c).venda })),
      viagens: minhasViagens.map(v => ({ id: v.id, nome: v.nome, destino: v.destino, datas: v.datas, status: v.status || 'confirmada' })),
      documentos: docs.filter(d => d.vinculo && ids.has(`${d.vinculo.tipo}:${d.vinculo.id}`)),
    });
  }

  if (acao === 'cliente-salvar') {
    const email = str(body.email, 120).toLowerCase();
    if (!emailOk(email)) return res(400, { error: 'Informe um e-mail válido.' });
    const ref = contaRef.collection('clientes').doc(await sha256(email));
    const snap = await ref.get();
    const atual = snap.exists ? snap.data() : { criado_em: new Date(now).toISOString() };
    const cli = { ...limparCliente(body, atual), atualizado_em: new Date(now).toISOString() };
    if (!cli.nome) return res(400, { error: 'Informe o nome.' });
    await ref.set(cli);
    await registrarAtividade(contaRef, now, aleatorio, 'cliente', `${snap.exists ? 'Cliente atualizado' : 'Novo cliente'}: ${cli.nome}`, { tipo: 'cliente', id: email });
    return res(200, { ok: true, cliente: cli });
  }

  // ── Busca global ──
  if (acao === 'painel-buscar') {
    const q = str(body.q, 80).toLowerCase();
    if (q.length < 2) return res(200, { ok: true, resultados: [] });
    const [cotacoes, viagens, extras] = await Promise.all([
      todos(contaRef.collection('cotacoes')), todos(contaRef.collection('viagens')), todos(contaRef.collection('clientes')),
    ]);
    const tem = (...v) => v.some(x => String(x || '').toLowerCase().includes(q));
    const resultados = [
      ...montarClientes(cotacoes, viagens, extras).filter(c => tem(c.nome, c.email, c.whatsapp)).slice(0, 6).map(c => ({ tipo: 'cliente', id: c.email, titulo: c.nome || c.email, sub: c.email })),
      ...cotacoes.filter(c => tem(c.codigo, c.nome, c.email, c.destino)).slice(0, 6).map(c => ({ tipo: 'cotacao', id: c.id, titulo: `${c.codigo || c.id} · ${c.nome}`, sub: c.destino || '' })),
      ...viagens.filter(v => tem(v.nome, v.destino, v.email)).slice(0, 6).map(v => ({ tipo: 'viagem', id: v.id, titulo: v.nome, sub: v.destino })),
    ];
    return res(200, { ok: true, resultados });
  }

  // ── Fase 2: financeiro, agenda/tarefas, leads ──
  const f2 = await require('./viajante-pro-fase2').acoesFase2({
    acao, body, contaRef, res, now, aleatorio, db,
    atividade: (tipo, texto, ref) => registrarAtividade(contaRef, now, aleatorio, tipo, texto, ref),
  });
  if (f2) return f2;

  return null;
}

module.exports = { acoesPainel, statusCotacao, totaisCotacao, montarClientes, STATUS_COTACAO, STATUS_VIAGEM, TIPOS_SERVICO, CANAIS, _interno: { num, limparItens, limparServicos } };
