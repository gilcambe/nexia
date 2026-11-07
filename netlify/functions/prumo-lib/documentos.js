'use strict';
/**
 * Kernex Finance, fase 2: leitor universal de documentos + lançamentos + resumo do Início.
 * A IA só LÊ o documento e devolve campos; quem soma, concilia e decide o que é dado confirmado é o motor.
 * Regras: dado duvidoso vai para "conferir" e só vira lançamento depois que a pessoa confirma;
 * nunca registra valores da pessoa em log; só IA grátis (anthropic fora).
 */
const crypto = require('crypto');
const { conciliar, chave, patrimonio, totais } = require('./motor');

const TIPOS_LANC = ['despesa', 'receita', 'transferencia_propria', 'pagamento_fatura'];
const CATEGORIAS_KF = ['moradia', 'alimentacao', 'transporte', 'saude', 'educacao', 'familia', 'lazer', 'compras', 'assinaturas', 'financeiro', 'impostos', 'investimentos', 'renda', 'outros'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;
const MAX_LANC = 200;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const LER_DOC = `Você lê documentos financeiros brasileiros (foto, print ou PDF renderizado): fatura de cartão, extrato bancário, comprovante Pix/TED, nota ou cupom fiscal, boleto, recibo, conta de consumo, extrato de corretora ou de milhas.
Devolva SOMENTE um JSON, sem texto fora dele:
{"tipo_documento":"fatura|extrato|comprovante|nota|boleto|recibo|conta|corretora|milhas|outro","instituicao":"banco ou loja","total_documento":número ou null,"lancamentos":[{"data":"AAAA-MM-DD","data_processamento":"AAAA-MM-DD ou null","descricao":"texto","estabelecimento":"nome","valor":número positivo,"moeda":"BRL","categoria":"uma de: ${CATEGORIAS_KF.join(', ')}","subcategoria":"texto curto ou null","conta_ou_cartao":"final 1234 ou nome","parcela":número ou null,"parcelas_total":número ou null,"vencimento":"AAAA-MM-DD ou null","tipo":"despesa|receita|transferencia_propria|pagamento_fatura","confianca":número de 0 a 1}]}
Regras:
1. "valor" é sempre positivo; o sentido está em "tipo". Compra, débito, boleto pago e saque são "despesa". Salário, Pix recebido, rendimento e reembolso são "receita".
2. Pagamento da fatura do cartão é "pagamento_fatura". Transferência entre contas da própria pessoa é "transferencia_propria". Nenhum dos dois é despesa nem receita.
3. Números com ponto decimal (R$ 1.234,56 vira 1234.56). Datas como AAAA-MM-DD; se faltar o ano, use o ano do documento.
4. "confianca" baixa (menos de 0.8) quando o texto estiver borrado, cortado ou você estiver adivinhando.
5. Não invente nada que não esteja legível. Se não houver lançamentos, devolva lista vazia.`;

function valorLido(v) {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
}
function dataLida(v) {
  const t = String(v == null ? '' : v).trim();
  if (DATA.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (!m) return '';
  return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const APELIDO_TIPO = [[/pagamento.*fatura|fatura.*pag/i, 'pagamento_fatura'], [/propria|mesma titular|entre contas/i, 'transferencia_propria'],
  [/receita|entrada|credito|crédito|recebid|sal[aá]rio|rendimento|reembolso/i, 'receita'], [/despesa|saida|saída|debito|débito|compra|pagamento|saque/i, 'despesa']];
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Arruma e valida um lançamento vindo da IA ou da tela. Devolve { ok, item } ou { ok:false, motivo }. */
function normalizarLancamento(b, doc) {
  if (!b || typeof b !== 'object') return { ok: false, motivo: 'lançamento inválido' };
  const valor = valorLido(b.valor);
  if (!Number.isFinite(valor) || valor === 0) return { ok: false, motivo: 'valor ilegível' };
  const data = dataLida(b.data);
  if (!data) return { ok: false, motivo: 'data ilegível' };
  const bruto = sem(b.tipo);
  const tipo = TIPOS_LANC.includes(bruto) ? bruto : ((APELIDO_TIPO.find(([re]) => re.test(bruto)) || [])[1] || null);
  if (!tipo) return { ok: false, motivo: 'não sei se é gasto ou entrada' };
  const descricao = texto(b.descricao, 120) || texto(b.estabelecimento, 120);
  if (!descricao) return { ok: false, motivo: 'sem descrição' };
  const cat = sem(b.categoria);
  const num = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 && n < 400 ? n : null; };
  const item = {
    data, data_processamento: dataLida(b.data_processamento) || null, descricao, estabelecimento: texto(b.estabelecimento, 120) || descricao,
    valor: Math.round(Math.abs(valor) * 100) / 100, moeda: texto(b.moeda, 3).toUpperCase() || 'BRL',
    categoria: CATEGORIAS_KF.includes(cat) ? cat : 'outros', subcategoria: texto(b.subcategoria, 60) || null,
    instituicao: texto(b.instituicao, 80) || texto(doc && doc.instituicao, 80) || null, conta_ou_cartao: texto(b.conta_ou_cartao, 60) || null,
    parcela: num(b.parcela), parcelas_total: num(b.parcelas_total), vencimento: dataLida(b.vencimento) || null, tipo,
    documento: texto(b.documento, 40) || texto(doc && doc.tipo_documento, 40) || 'outro',
    perfil: b.perfil === 'pj' ? 'pj' : 'pf',
  };
  const conf = Number(b.confianca);
  if (Number.isFinite(conf)) item.confianca = Math.max(0, Math.min(1, conf));
  if (b.forcar === true) item.forcar = true;
  return { ok: true, item };
}
const idDe = (l) => crypto.createHash('sha1').update(chave(l)).digest('hex').slice(0, 20);

/** Espera a promessa, mas desiste no prazo; o relógio sempre é desligado (nada fica pendurado). */
function comPrazo(promessa, ms) {
  let relogio;
  const prazo = new Promise((_, rej) => { relogio = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(relogio));
}

/** Lê as imagens com IA grátis que enxerga. Cada imagem corre separada; devolve [{json}|null]. */
async function lerComVisao(imagens, deps) {
  const { VISAO, extrairJson } = require('../prumo');
  const router = deps.getRouter();
  const vistos = new Set();
  const lista = [...VISAO, ...deps.listFor('fast')].filter((d) => d.provider !== 'anthropic' && !vistos.has(d.provider + d.model) && vistos.add(d.provider + d.model));
  const inicio = Date.now();
  const uma = async (img) => {
    let tentou = 0;
    for (const d of lista) {
      try {
        const cap = router.capabilities(d);
        if (!cap.available || !cap.vision) continue;
        const resta = 150000 - (Date.now() - inicio);
        if (resta < 5000) break;
        const ms = Math.min(tentou++ === 0 ? 90000 : 30000, resta);
        const out = await comPrazo(router.chat(d, { system: LER_DOC, messages: [{ role: 'user', content: 'Leia este documento e devolva o JSON.' }], images: [img], maxTokens: 8192, temperature: 0, timeoutMs: ms }), ms + 3000);
        const j = extrairJson(out && out.text);
        if (j && Array.isArray(j.lancamentos)) return j;
      } catch { /* tenta o próximo modelo grátis */ }
    }
    return null;
  };
  return Promise.all(imagens.map(uma));
}

const doMesReceitas = (lancs, mes) => totais(lancs.filter((x) => String(x.data).startsWith(mes))).receitas;
const mesAnterior = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 2, 1)); return d.toISOString().slice(0, 7); };
const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

async function agirDoc(acao, body, c) {
  if (!['doc_ler', 'doc_confirmar', 'lanc_listar', 'lanc_apagar', 'inicio_resumo'].includes(acao)) return null;
  const { base, listar, deps, agoraIso } = c;
  const col = base.collection('lancamentos');
  switch (acao) {
    case 'doc_ler': {
      const im = c.lerImagens(body.imagens);
      if (!im.ok) return [400, { error: im.erro }];
      const lidos = await lerComVisao(im.imagens, deps);
      if (!lidos.some(Boolean)) return [503, { error: 'Não consegui ler agora. Tente de novo com uma foto mais nítida.' }];
      const existentes = new Set((await listar(col)).map((x) => x.id));
      const brutos = []; const conferir = []; const tipos = [];
      for (const lido of lidos) {
        if (!lido) continue;
        tipos.push(texto(lido.tipo_documento, 30) || 'outro');
        for (const b of (lido.lancamentos || []).slice(0, MAX_LANC)) {
          const v = normalizarLancamento(b, lido);
          if (v.ok) brutos.push(v.item); else conferir.push({ ...b, motivo: v.motivo });
        }
      }
      const novos = []; let jaLancados = 0;
      for (const l of brutos) { if (existentes.has(idDe(l))) jaLancados++; else novos.push(l); }
      const r = conciliar(novos);
      return [200, { documento: tipos[0] || 'outro', imagens_lidas: lidos.filter(Boolean).length, imagens_total: lidos.length,
        prontos: r.confirmados, conferir: [...conferir, ...r.conferir], ja_lancados: jaLancados, receitas: r.receitas, despesas: r.despesas }];
    }
    case 'doc_confirmar': {
      const lista = Array.isArray(body.lancamentos) ? body.lancamentos.slice(0, MAX_LANC) : [];
      if (!lista.length) return [400, { error: 'Nenhum lançamento para gravar.' }];
      const existentes = new Set((await listar(col)).map((x) => x.id));
      const rejeitados = []; const normais = []; const forcados = [];
      for (const b of lista) {
        const v = normalizarLancamento(b, null);
        if (!v.ok) { rejeitados.push({ descricao: texto(b && b.descricao, 60), motivo: v.motivo }); continue; }
        (v.item.forcar ? forcados : normais).push(v.item);
      }
      const r = conciliar(normais);
      let gravados = 0; let jaExistiam = 0;
      for (const l of r.confirmados) {
        const id = idDe(l);
        if (existentes.has(id)) { jaExistiam++; continue; }
        existentes.add(id);
        await col.doc(id).set({ ...l, origem: 'documento', criado_em: agoraIso });
        gravados++;
      }
      for (const l of forcados) {
        const { forcar, ...limpo } = l;
        await col.doc(idDe(l) + '-' + novoId()).set({ ...limpo, origem: 'documento', revisado: true, criado_em: agoraIso });
        gravados++;
      }
      return [200, { ok: true, gravados, ja_existiam: jaExistiam, para_conferir: r.conferir.length, rejeitados }];
    }
    case 'lanc_listar': {
      const mes = texto(body.mes, 7);
      if (mes && !MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const perfilPedido = body.perfil === 'pj' ? 'pj' : 'pf'; // totais de PF e PJ nunca se misturam
      const todos = (await listar(col)).filter((x) => (x.perfil === 'pj' ? 'pj' : 'pf') === perfilPedido).filter((x) => !mes || String(x.data).startsWith(mes)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      return [200, { lancamentos: todos.slice(0, 300), total: todos.length, ...totais(todos) }];
    }
    case 'lanc_apagar': {
      const id = texto(body.id, 80);
      if (!id) return [400, { error: 'Diga qual lançamento apagar.' }];
      await col.doc(id).delete();
      return [200, { ok: true }];
    }
    case 'inicio_resumo': {
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const fin = require('./financas');
      const [lancsTodos, carteira, pontos, cartoes, contas, limites, dividas] = await Promise.all([listar(col), listar(base.collection('carteira')), listar(base.collection('pontos')), listar(base.collection('cartoes')), listar(base.collection('contas')), listar(base.collection('limites')), listar(base.collection('dividas'))]);
      const lancs = lancsTodos.filter((x) => x.perfil !== 'pj'); // PJ nunca entra nos totais pessoais
      const cfgDiv = await base.collection('config').doc('dividas').get();
      const resDiv = require('./dividas').resumoDividas(dividas, !!(cfgDiv && cfgDiv.exists && cfgDiv.data().sem_dividas), doMesReceitas(lancs, mes));
      const doMes = totais(lancs.filter((x) => String(x.data).startsWith(mes)));
      const anterior = totais(lancs.filter((x) => String(x.data).startsWith(mesAnterior(mes))));
      const sd = fin.saldoDisponivel(contas);
      const pat = patrimonio({ contas: contas.filter((k) => (k.moeda || 'BRL') === 'BRL').map((k) => ({ valor: k.saldo })), investimentos: carteira, milhas: [], dividas: dividas.map((d) => ({ valor: d.saldo })) });
      const consumo = fin.consumoLimites(limites, doMes.por_categoria);
      const milhas = Math.round(pontos.reduce((s, p) => s + ((p.saldo || 0) / 1000) * (p.valor_milheiro || 0), 0) * 100) / 100;
      const dia = new Date(agoraIso).getUTCDate();
      const vencimentos = cartoes.map((k) => ({ cartao: k.nome, dia: k.dia_vencimento, em_dias: (k.dia_vencimento - dia + 31) % 31 })).filter((v) => v.em_dias <= 7).sort((a, b) => a.em_dias - b.em_dias);
      const lacunas = [];
      if (!resDiv.registradas && !resDiv.sem) lacunas.push('dividas');
      if (!contas.length) lacunas.push('contas');
      if (!lancs.length) lacunas.push('lancamentos');
      return [200, { mes, receitas: doMes.receitas, despesas: doMes.despesas, economia: Math.round((doMes.receitas - doMes.despesas) * 100) / 100,
        despesas_mes_anterior: anterior.despesas, variacao_despesas_pct: pct(doMes.despesas, anterior.despesas), por_categoria: doMes.por_categoria,
        saldo_disponivel: sd.saldo, outras_moedas: sd.outras_moedas, limites: consumo, alertas_limite: consumo.filter((x) => x.status !== 'ok'),
        dividas: resDiv, investimentos: Math.round(carteira.reduce((t, x) => t + Math.round((x.valor || 0) * 100), 0)) / 100, patrimonio: pat, milhas_estimado: milhas, vencimentos, lacunas, qtd_lancamentos: lancs.length }];
    }
    default: return null;
  }
}

module.exports = { agirDoc, normalizarLancamento, idDe, LER_DOC, CATEGORIAS_KF, TIPOS_LANC };
