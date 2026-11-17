'use strict';

// ÔöÇÔöÇ fetchWithTimeout helper ÔöÇÔöÇ
async function _fetchTimeout(url, opts = {}, ms = 30000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(tid); }
}

/**
 * ÔòöÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòù
 * Ôòæ  NEXIA OS ÔÇö AI FINANCIAL ENGINE v1.0                        Ôòæ
 * Ôòæ  An├ílise financeira inteligente por tenant                  Ôòæ
 * Ôòæ  Previs├Áes, alertas, DRE, fluxo de caixa                   Ôòæ
 * ÔòÜÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòØ
 */

const { admin, db } = require('./firebase-init');
const { modeloGroq } = require('../../lib/groq-modelo');
const { guard, HEADERS, makeHeaders } = require('./middleware');

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  const auth = await guard(event, 'ai-financial'); // VULN-01 fix: await obrigat├│rio
  if (auth) return auth; // guard retorna resposta de erro ou null se ok

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const params = event.queryStringParameters || {};
  const action = params.action || body.action || 'summary';
  const tenantId = params.tenantId || body.tenantId;
  const question = body.question;

  try {
    if (action === 'summary' && tenantId) return resp(await getFinancialSummary(tenantId));
    if (action === 'dre' && tenantId) return resp(await getDRE(tenantId));
    if (action === 'cashflow' && tenantId) return resp(await getCashFlow(tenantId));
    if (action === 'forecast' && tenantId) return resp(await getForecast(tenantId));
    if (action === 'alerts') return resp(await getFinancialAlerts(tenantId));
    if (action === 'ask' && question && tenantId) return resp(await askAI(tenantId, question));
    if (action === 'empire') return resp(await getEmpireFinancials());
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action inv├ílida' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

function resp(data) {
  return { statusCode: 200, headers, body: JSON.stringify(data) };
}

async function getFinancialSummary(tenantId) {
  if (!db) return { error: 'Firebase n├úo configurado' };
  const thisMonth = new Date().toISOString().slice(0, 7);

  // L├¬ transa├º├Áes do m├¬s
  const txSnap = await db.collection('data').doc(tenantId)
    .collection('financeiro').where('mes', '==', thisMonth).get();

  let receitas = 0, despesas = 0;
  const categorias = {};

  txSnap.forEach(d => {
    const tx = d.data();
    if (tx.tipo === 'receita') {
      receitas += tx.valor || 0;
    } else if (tx.tipo === 'despesa') {
      despesas += tx.valor || 0;
      const cat = tx.categoria || 'Outros';
      categorias[cat] = (categorias[cat] || 0) + (tx.valor || 0);
    }
  });

  const lucro = receitas - despesas;
  const margem = receitas > 0 ? parseFloat(((lucro / receitas) * 100).toFixed(1)) : 0;

  return {
    mes: thisMonth, receitas, despesas, lucro, margemLucro: margem,
    categoriasDespesa: categorias,
    status: lucro > 0 ? 'POSITIVO' : 'NEGATIVO',
    tenantId
  };
}

async function getDRE(tenantId) {
  if (!db) return { error: 'Firebase n├úo configurado' };
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const dre = [];
  for (const mes of months) {
    const snap = await db.collection('data').doc(tenantId)
      .collection('financeiro').where('mes', '==', mes).get().catch(() => ({ forEach: () => {} }));

    let receitas = 0, despesas = 0, impostos = 0;
    snap.forEach(d => {
      const tx = d.data();
      if (tx.tipo === 'receita') receitas += tx.valor || 0;
      else if (tx.tipo === 'despesa') {
        despesas += tx.valor || 0;
        if (tx.categoria === 'Impostos') impostos += tx.valor || 0;
      }
    });
    dre.push({ mes, receitas, despesas, impostos, lucroLiquido: receitas - despesas });
  }
  return { tenantId, dre, period: '6 meses' };
}

async function getCashFlow(tenantId) {
  if (!db) return { error: 'Firebase n├úo configurado' };
  const snap = await db.collection('data').doc(tenantId)
    .collection('financeiro').orderBy('data', 'desc').limit(100).get().catch(() => ({ docs: [] }));

  const transactions = snap.docs.map(d => d.data());
  let saldo = 0;
  const timeline = transactions.reverse().map(tx => {
    saldo += tx.tipo === 'receita' ? (tx.valor || 0) : -(tx.valor || 0);
    return { data: tx.data || tx.mes, descricao: tx.descricao || '', tipo: tx.tipo, valor: tx.valor || 0, saldo };
  });

  return { tenantId, saldo_atual: saldo, timeline: timeline.slice(-30), totalTransacoes: transactions.length };
}

async function getForecast(tenantId) {
  if (!db) return { error: 'Firebase n├úo configurado' };

  // L├¬ ├║ltimos 3 meses para tend├¬ncia
  const months = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const historico = [];
  for (const mes of months) {
    const snap = await db.collection('data').doc(tenantId)
      .collection('financeiro').where('mes', '==', mes).get().catch(() => ({ forEach: () => {} }));
    let receitas = 0;
    snap.forEach(d => { if (d.data().tipo === 'receita') receitas += d.data().valor || 0; });
    historico.push({ mes, receitas });
  }

  // Tend├¬ncia linear simples
  const valores = historico.map(h => h.receitas);
  const avg = valores.reduce((a, b) => a + b, 0) / Math.max(valores.length, 1);
  const crescimento = valores.length >= 2
    ? (valores[valores.length - 1] - valores[0]) / Math.max(valores.length - 1, 1)
    : 0;

  const forecast = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now); d.setMonth(d.getMonth() + i);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const projecao = Math.max(0, Math.round(avg + crescimento * i));
    forecast.push({ mes, projecao, confianca: i === 1 ? 'ALTA' : i === 2 ? 'M├ëDIA' : 'BAIXA' });
  }

  return { tenantId, historico, forecast, crescimentoMensal: Math.round(crescimento) };
}

async function getFinancialAlerts(tenantId) {
  if (!db) return { alerts: [] };
  const alerts = [];
  const tenants = tenantId ? [{ id: tenantId }] : (await db.collection('tenants').get()).docs.map(d => ({ id: d.id }));

  for (const t of tenants) {
    // Pagamentos vencidos
    const overdue = await db.collection('data').doc(t.id)
      .collection('financeiro')
      .where('status', '==', 'vencido')
      .get().catch(() => ({ size: 0, forEach: () => {} }));

    if (overdue.size > 0) {
      let total = 0;
      overdue.forEach(d => { total += d.data().valor || 0; });
      alerts.push({ tenantId: t.id, level: 'HIGH', type: 'PAGAMENTOS_VENCIDOS', detail: `${overdue.size} pagamento(s) vencido(s) ÔÇö R$ ${total.toLocaleString('pt-BR')}` });
    }
  }

  return { alerts, total: alerts.length, scannedAt: new Date().toISOString() };
}

async function getEmpireFinancials() {
  if (!db) return { error: 'Firebase n├úo configurado' };
  const PLAN_MRR = { free: 0, starter: 297, pro: 597, business: 997, enterprise: 1497 };
  const snap = await db.collection('tenants').get();
  let mrr = 0, arr = 0; const tenants = [];

  snap.forEach(d => {
    const t = d.data();
    if (t.status === 'active' || t.status === 'ativo') {
      const m = t.mrr || PLAN_MRR[t.plan || 'free'] || 0;
      mrr += m;
      tenants.push({ id: d.id, name: t.name, plan: t.plan, mrr: m });
    }
  });
  arr = mrr * 12;

  return { mrr, arr, tenantCount: tenants.length, topTenants: tenants.sort((a, b) => b.mrr - a.mrr).slice(0, 10) };
}

async function askAI(tenantId, question) {
  const summary = await getFinancialSummary(tenantId).catch(() => ({}));
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return { error: 'GROQ_API_KEY necess├íria' };
  const modelo = await modeloGroq(groqKey);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 600,
      messages: [
        { role: 'system', content: 'Voc├¬ ├® um CFO virtual especialista em finan├ºas SaaS. Responda em portugu├¬s brasileiro, de forma direta e orientada a a├º├úo.' },
        { role: 'user', content: `Dados financeiros do tenant ${tenantId}:\n${JSON.stringify(summary)}\n\nPergunta: ${question}` }
      ]
    })
  });

  const data = await res.json();
  return { answer: data.choices?.[0]?.message?.content || 'Sem resposta', context: summary };
}
