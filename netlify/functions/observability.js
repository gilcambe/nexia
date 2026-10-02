'use strict';
/* GET /api/observability — real-time metrics from in-process store */

// Fallback in-memory store for cold starts
const _local = { reqs:0, errs:0, lats:[], byPath:{}, startedAt:Date.now() };

function getStore() {
  // In server.js context, global._obsMetrics is available
  return (typeof global !== 'undefined' && global._obsMetrics) ? global._obsMetrics : _local;
}

function calcMetrics(s) {
  const lats = s.lats || s.latency || [];
  const avg  = lats.length ? Math.round(lats.reduce((a,b)=>a+b,0)/lats.length) : 0;
  const sorted = [...lats].sort((a,b)=>a-b);
  const p95  = sorted[Math.floor(sorted.length*0.95)]||0;
  const p99  = sorted[Math.floor(sorted.length*0.99)]||0;
  const reqs = s.reqs||s.requests||0;
  const errs = s.errs||s.errors||0;
  const errRate = reqs ? +(((errs/reqs)*100).toFixed(1)) : 0;
  const byPath = s.byPath||{};
  const paths = Object.entries(byPath).map(([p,d])=>({
    path:p, count:d.count||0, errors:d.errors||0,
    avgMs: (d.lats||d.latency||[]).length
      ? Math.round((d.lats||d.latency||[]).reduce((a,b)=>a+b,0)/(d.lats||d.latency||[]).length) : 0
  })).sort((a,b)=>b.count-a.count).slice(0,20);
  return { requests:reqs, errors:errs, errRate, avgLatency:avg, p95, p99,
    uptimeMs: Date.now()-(s.startedAt||Date.now()), paths, ts: new Date().toISOString() };
}

const { requireBearerAuth, makeHeaders } = require('./middleware');
const MAX_SAMPLES = 1000; // SEC Fase 1 (A2): limita memória por processo

function pushCapped(arr, v) { arr.push(v); if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES); }

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod==='OPTIONS') return {statusCode:204,headers,body:''};
  // SEC Fase 1 (A2): métricas internas exigem token e papel admin (antes eram públicas)
  const authErr = await requireBearerAuth(event, 'admin');
  if (authErr) return authErr;
  if (event.httpMethod==='POST') {
    let b;
    try { b = JSON.parse(event.body||'{}'); } catch { return {statusCode:400,headers,body:JSON.stringify({error:'JSON inválido'})}; }
    const s = _local;
    const ms = Number.isFinite(b.ms) ? b.ms : 0;
    const status = Number.isFinite(b.status) ? b.status : 200;
    const p = typeof b.path === 'string' ? b.path.slice(0, 200) : 'unknown';
    s.reqs++; pushCapped(s.lats, ms);
    if (status>=500) s.errs++;
    if (!s.byPath[p]) {
      if (Object.keys(s.byPath).length >= 200) return {statusCode:200,headers,body:JSON.stringify({ok:true})};
      s.byPath[p]={count:0,errors:0,lats:[]};
    }
    s.byPath[p].count++; pushCapped(s.byPath[p].lats, ms);
    if (status>=500) s.byPath[p].errors++;
    return {statusCode:200,headers,body:JSON.stringify({ok:true})};
  }
  return {statusCode:200,headers,body:JSON.stringify(calcMetrics(getStore()))};
};
