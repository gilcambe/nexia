'use strict';
/**
/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  NEXIA OS — Metrics Aggregator v1.2                  ║
 * ║  Cross-tenant KPI aggregation from Firestore         ║
 * ║  SECURITY FIX: requireBearerAuth adicionado          ║
 * ╚══════════════════════════════════════════════════════╝
 */
const { admin, db } = require('./firebase-init');

const { requireBearerAuth, HEADERS, makeHeaders } = require('./middleware');

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // SECURITY FIX: endpoint expõe dados financeiros de todos os tenants — requer master token
  const METRICS_SECRET = process.env.METRICS_SECRET;
  // FIX v48: sem METRICS_SECRET configurado → 401 (não expõe dados, não retorna 200)
  if (!METRICS_SECRET) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  // SEC Fase 1 (A2): comparação em tempo constante e segredo mínimo de 32 caracteres
  const expected = Buffer.from(`Bearer ${METRICS_SECRET}`);
  const given = Buffer.from(authHeader);
  const okSecret = METRICS_SECRET.length >= 32 && given.length === expected.length && require('crypto').timingSafeEqual(given, expected);
  if (!okSecret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!db) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firebase indisponível' }) };

  try {
    const tenantsSnap = await db.collection('tenants').where('status', '==', 'active').get();
    let totalMrr = 0, activeTenants = 0, totalRevenue = 0;
    const tenantMetrics = [];

    for (const tenantDoc of tenantsSnap.docs) {
      const data = tenantDoc.data();
      const plan = data.subscription?.plan || 'free';
      const planValues = { starter: 297, pro: 597, enterprise: 1497, free: 0 };
      const mrr = planValues[plan] || 0;
      totalMrr += mrr;
      activeTenants++;

      // Sum payments
      const paymentsSnap = await db.collection('tenants').doc(tenantDoc.id).collection('payments')
        .where('status', '==', 'approved').get();
      let tenantRevenue = 0;
      paymentsSnap.forEach(p => { tenantRevenue += p.data().amount || 0; });
      totalRevenue += tenantRevenue;

      tenantMetrics.push({ id: tenantDoc.id, name: data.name, plan, mrr, revenue: tenantRevenue });
    }

    const avgLtv = activeTenants > 0 ? Math.round(totalRevenue / activeTenants) : 0;
    const arr = totalMrr * 12;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        total_mrr: totalMrr,
        arr,
        active_tenants: activeTenants,
        avg_ltv: avgLtv,
        tenants: tenantMetrics
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
