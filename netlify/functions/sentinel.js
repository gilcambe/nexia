'use strict';

/**
 * NEXIA OS — Sentinel v3.1 (AUTO-HEAL)
 * ──────────────────────────────────────────────────
 * FIXES v3.1:
 * - BUG CRÍTICO: sintaxe corrompida em scanEndpoint (url + ';) corrigida
 * - heal mode: triggerRedeploy agora dispara SEMPRE após aplicar qualquer
 *   patch no Firestore (não apenas se firestoreResult.applied > 0)
 * - Redeploy também é acionado mesmo sem override se há issues CRITICAL
 * - (removido) deploy hook de hospedagem antiga; hoje o redeploy é só manual (ADR-HOST-01)
 *
 * MODES (após SEC Fase 1, C4):
 *   GET ?action=ping  → health check sem auth
 *   GET               → status da última execução (Firestore); 503 sem DB
 *   POST {mode:scan}  → scan completo + diagnóstico IA (papel admin)
 *   POST {mode:heal}  → só com SENTINEL_HEAL_ENABLED=true e papel admin:
 *                       diagnóstico IA + issue no GitHub (se GITHUB_TOKEN/REPO);
 *                       NÃO aplica overrides do LLM no Firestore e NÃO dispara
 *                       o deploy hook da hospedagem. Grava apenas o relatório em
 *                       coleções fixas: sentinel_heals e system_status/last_heal.
 *   Não há mais modo agendado sem token nem auto-heal no scan.
 */

// ── fetchWithTimeout helper ──────────────────────────────────────────
async function _fetchTimeout(url, opts = {}, ms = 30000, _legacyOpts) {
  // Backward-compat: assinatura antiga era _fetchTimeout(url, {}, ms, opts)
  if (_legacyOpts && typeof _legacyOpts === 'object') opts = _legacyOpts;
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

const { admin, db }          = require('./firebase-init');
const { requireBearerAuth }  = require('./middleware');
const modelRouter = require('../../nexia-ai/model-router'); // Fase 10: chamadas de IA via Model Router

// ADR-HOST-01: sem Render; no container o próprio server.js responde em localhost
const BASE   = process.env.NEXIA_APP_URL
            || process.env.URL
            || `http://127.0.0.1:${process.env.PORT || 3001}`;
const GHTKN  = process.env.GITHUB_TOKEN;
const GHREPO = process.env.GITHUB_REPO;        // ex: "org/nexia-os"
// RENDER_DEPLOY_HOOK não é mais lido aqui: redeploy automático desativado (SEC Fase 1, C4)

// ─── ENDPOINTS MONITORADOS ──────────────────────────────────────────
const ENDPOINTS = [
  // ── ROTAS PÚBLICAS / LANDING ──────────────────────────────────────
  { name: 'Home',              url: BASE + '/',                         method: 'GET',  expect: 200,                  group: 'Core'       },
  { name: 'Login',             url: BASE + '/login',                    method: 'GET',  expect: 200,                  group: 'Core'       },
  { name: 'CES Landing',       url: BASE + '/ces/landing',              method: 'GET',  expect: 200,                  group: 'CES'        },
  { name: 'CES Admin',         url: BASE + '/ces/admin',                method: 'GET',  expect: 200,                  group: 'CES'        },
  { name: 'CES Executivo',     url: BASE + '/ces/executivo',            method: 'GET',  expect: 200,                  group: 'CES'        },
  { name: 'VP Landing',        url: BASE + '/vp/landing',               method: 'GET',  expect: 200,                  group: 'ViajantePro'},
  { name: 'VP Admin',          url: BASE + '/vp/admin',                 method: 'GET',  expect: 200,                  group: 'ViajantePro'},
  { name: 'Bezsan Landing',    url: BASE + '/bezsan/landing',           method: 'GET',  expect: 200,                  group: 'Bezsan'     },
  { name: 'Splash Admin',      url: BASE + '/splash/admin',             method: 'GET',  expect: 200,                  group: 'Splash'     },
  // ── NEXIA OS — MÓDULOS INTERNOS ───────────────────────────────────
  { name: 'NEXIA Hub',         url: BASE + '/nexia',                    method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Cortex',      url: BASE + '/nexia/cortex',             method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Store',       url: BASE + '/nexia/store',              method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Studio',      url: BASE + '/nexia/studio',             method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Sentinel',    url: BASE + '/nexia/sentinel',           method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Swarm',       url: BASE + '/nexia/swarm',              method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Pay',         url: BASE + '/nexia/pay',                method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA PABX',        url: BASE + '/nexia/pabx',              method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Striker',     url: BASE + '/nexia/striker',            method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Strike Ctr',  url: BASE + '/nexia/strike-center',      method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA OSINT',       url: BASE + '/nexia/osint-query',        method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA PKI',         url: BASE + '/nexia/pki',                method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Architect',   url: BASE + '/nexia/architect',          method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA AutoDemo',    url: BASE + '/nexia/autodemo',           method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Social',      url: BASE + '/nexia/social-media',       method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA My Panel',    url: BASE + '/nexia/my-panel',           method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Master Admin',url: BASE + '/nexia/master-admin',       method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA QA Center',   url: BASE + '/nexia/qa-test-center',     method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  { name: 'NEXIA Flow',        url: BASE + '/nexia/flow',               method: 'GET',  expect: 200,                  group: 'NEXIA'      },
  // ── APIs BACKEND ──────────────────────────────────────────────────
  // skipScan: true — APIs exigem Bearer token; sem ele sempre retornam 401.
  // O sentinel não tem token de serviço, então essas rotas são monitoradas
  // apenas pela presença (endpoint existe = não é 404/500) mas NÃO entram
  // no cálculo de score nem aparecem como "fail" no painel.
  { name: 'API Auth',          url: BASE + '/api/auth',                 method: 'POST', expect: [400, 401, 403, 200], group: 'API',  skipScan: true, body: { action: 'health' }                                           },
  { name: 'API Cortex',        url: BASE + '/api/cortex',               method: 'POST', expect: [400, 401, 403, 200], group: 'API',  skipScan: true, body: { userId: 'sentinel', tenantId: 'nexia', message: 'ping', stream: false } },
  { name: 'API Agents',        url: BASE + '/api/agents',               method: 'GET',  expect: [200, 401, 403],      group: 'API',  skipScan: true, params: '?tenantId=nexia'                                            },
  { name: 'API Billing',       url: BASE + '/api/billing',              method: 'GET',  expect: [400, 401, 403, 200], group: 'API',  skipScan: true, params: '?tenantId=nexia'                                            },
  { name: 'API KPI',           url: BASE + '/api/kpi',                  method: 'GET',  expect: [200, 401, 403],      group: 'API',  skipScan: true, params: '?action=summary&tenantId=nexia'                             },
  { name: 'API Tenant',        url: BASE + '/api/tenant',               method: 'GET',  expect: [200, 401, 403],      group: 'API',  skipScan: true, params: '?tenantId=nexia'                                            },
  { name: 'API Swarm',         url: BASE + '/api/swarm',                method: 'POST', expect: [400, 401, 403, 200], group: 'API',  skipScan: true, body: { action: 'status', tenantId: 'nexia' }                        },
  { name: 'API Sentinel IoT',  url: BASE + '/api/sentinel',             method: 'GET',  expect: [200, 401, 403],      group: 'API',  skipScan: true, params: '?tenantId=nexia'                                            },
  { name: 'API OSINT',         url: BASE + '/api/osint',                method: 'GET',  expect: [400, 401, 403, 200], group: 'API',  skipScan: true, params: '?query=test&type=cep'                                       },
  { name: 'API Metrics',       url: BASE + '/api/metrics',              method: 'GET',  expect: [200, 401, 403],      group: 'API',  skipScan: true, params: '?tenantId=nexia'                                            },
  { name: 'API Usage',         url: BASE + '/api/usage',                method: 'GET',  expect: [200, 401, 403],      group: 'API',  skipScan: true, params: '?tenantId=nexia'                                            },
];

// ─── SCAN ───────────────────────────────────────────────────────────
async function scanEndpoint(ep) {
  const start = Date.now();
  try {
    const url  = ep.url + (ep.params || '');
    const opts = { method: ep.method, signal: AbortSignal.timeout(20_000) }; // 20s — cobre a partida do container

    if (ep.body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body    = JSON.stringify(ep.body);
    }

    const r        = await fetch(url, opts);
    const ms       = Date.now() - start;
    const expected = Array.isArray(ep.expect) ? ep.expect : [ep.expect];
    const ok       = expected.includes(r.status);

    // Detecta página de "servidor iniciando" — retorna 503 com body específico
    // ou resposta instantânea (<10ms com status 200) que é falsa
    let bodyText = '';
    try { bodyText = await r.text(); } catch {}
    const isStarting = bodyText.includes('spinning up') ||
                       bodyText.includes('Service Unavailable') && r.status !== 200;

    if (isStarting) {
      return {
        name:   ep.name, url: ep.url, group: ep.group,
        status: 503, ms,
        ok:     false,
        error:  'Servidor inicializando (retente em 30s)',
      };
    }

    return {
      name:  ep.name, url: ep.url, group: ep.group,
      status: r.status, ms, ok,
      error: ok ? null : `HTTP ${r.status} (esperado: ${expected.join('/')})`,
    };
  } catch (e) {
    return {
      name:   ep.name, url: ep.url, group: ep.group,
      status: 0,
      ms:     Date.now() - start,
      ok:     false,
      error:  e.name === 'AbortError' || e.name === 'TimeoutError'
                ? 'Timeout (>20s) — servidor pode estar iniciando'
                : (e.message || 'Erro de rede'),
    };
  }
}

// ─── DIAGNÓSTICO VIA IA ─────────────────────────────────────────────
async function diagnosisViaAI(errors, context = '') {
  const key = process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key || !errors.length) return null;

  try {
    const isAnthropic = !!process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY;

    const prompt = `Você é um engenheiro DevOps sênior. Analise estes erros em produção no sistema NEXIA OS (Cloudflare + Firebase + HTML/JS):

ERROS:
${JSON.stringify(errors, null, 2)}

${context ? 'CONTEXTO ADICIONAL DO AUDIT:\n' + context : ''}

Para cada erro, forneça:
1. Diagnóstico da causa raiz
2. Ação imediata (pode ser feita agora sem redeploy)
3. Ação de longo prazo (requer redeploy)

Responda APENAS em JSON (sem markdown): {"summary":"...", "fixes":[{"issue":"...","rootCause":"...","immediateAction":"...","longTermFix":"...","priority":"CRITICAL|HIGH|MEDIUM|LOW","canAutoFix":true/false,"firestoreOverride":{"collection":"...","doc":"...","data":{}}}]}

Se canAutoFix=true, preencha firestoreOverride com dados para salvar no Firestore como override de config.`;

    let r, data;
    if (isAnthropic) {
      // Erro HTTP → '{}' (como antes); timeout/rede cai no catch.
      data = await modelRouter.getRouter().chat({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }, { maxTokens: 2000, timeoutMs: 30000, messages: [{ role: 'user', content: prompt }] }).catch(e => { if (e && e.details && e.details.status) return { text: '' }; throw e; });
      return JSON.parse((data.text || '{}').replace(/```json|```/g, '').trim());
    } else {
      // Erro HTTP → '{}' (como antes); timeout/rede cai no catch.
      data = await modelRouter.getRouter().chat({ provider: 'groq', model: 'llama-3.3-70b-versatile' }, { maxTokens: 2000, temperature: 0, timeoutMs: 30000, messages: [{ role: 'user', content: prompt }] }).catch(e => { if (e && e.details && e.details.status) return { text: '' }; throw e; });
      return JSON.parse((data.text || '{}').replace(/```json|```/g, '').trim());
    }
  } catch (e) {
    console.error('[Sentinel] diagnosisViaAI error:', e.message);
    return { error: 'Diagnóstico indisponível.' };
  }
}

// ─── AUTO-HEAL: FIRESTORE OVERRIDES ────────────────────────────────
// SEC Fase 1 (C4): a gravação de "overrides" sugeridos pela IA em coleções
// arbitrárias do Firestore (com Admin SDK, ignorando as regras) foi desativada.
// O diagnóstico continua disponível como sugestão; aplicar correções é ação humana.
async function applyFirestoreOverrides(_fixes) {
  return { applied: 0, disabled: true, reason: 'Aplicação automática de overrides desativada (Fase 1).' };
}

// ─── AUTO-HEAL: GITHUB ISSUE ────────────────────────────────────────
async function openGitHubPR(fixes, scanReport) {
  if (!GHTKN || !GHREPO) return null;
  const criticalFixes = fixes.filter(f => f.priority === 'CRITICAL' && f.longTermFix);
  if (!criticalFixes.length) return null;

  const prBody = `## 🤖 Sentinel Auto-Heal — ${new Date().toLocaleString('pt-BR')}

**Score do Audit:** ${scanReport.score || 'N/A'}
**Erros detectados:** ${scanReport.errorCount || criticalFixes.length}

### Fixes necessários

${criticalFixes.map(f => `#### ${f.priority}: ${f.issue}\n- **Causa:** ${f.rootCause || 'Ver diagnóstico'}\n- **Fix:** ${f.longTermFix}\n`).join('\n')}

> Gerado automaticamente pelo Sentinel v3.1. Revisar antes de fazer merge.`;

  try {
    const r = await _fetchTimeout(`https://api.github.com/repos/${GHREPO}/issues`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${GHTKN}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title:  `🔴 Sentinel: ${criticalFixes.length} fix(es) crítico(s) — ${new Date().toLocaleDateString('pt-BR')}`,
        body:   prBody,
        labels: ['sentinel', 'auto-heal', 'critical'],
      }),
    }, 15_000);

    const issue = await r.json();
    return { created: true, url: issue.html_url, number: issue.number };
  } catch (e) {
    console.error('[Sentinel] issue GitHub falhou:', e.message);
    return { created: false, error: 'Falha ao abrir issue.' };
  }
}

// ─── AUTO-HEAL: DEPLOY HOOK (desativado) ─────────────────────────────────
async function triggerRedeploy(_reason) {
  // SEC Fase 1 (C4): redeploy automático de produção desativado. Deploy é ação humana.
  return { triggered: false, reason: 'Redeploy automático desativado (Fase 1).' };
}

// ─── HANDLER PRINCIPAL ─────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  // FIX v53: GET ?action=ping — health check sem auth (usado por health checks)
  const qs = event.queryStringParameters || {};
  if (event.httpMethod === 'GET' && qs.action === 'ping') {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ts: new Date().toISOString(), version: 'v3.2' }) };
  }

  // GET → status da última execução
  if (event.httpMethod === 'GET') {
    const authErrGet = await requireBearerAuth(event);
    if (authErrGet) return authErrGet;

    // SEC Fase 1: sem Firestore não há status a devolver → 503 explícito (antes: "modo demo")
    if (!db) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Sentinel indisponível: banco de dados não configurado.' }) };

    const snap = await db.collection('system_status').doc('sentinel').get().catch(() => null);
    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify(snap?.exists ? snap.data() : { message: 'Sem dados ainda — execute um scan primeiro', health: 'UNKNOWN' }),
    };
  }

  // SEC Fase 1 (C4): removido o bypass por cabeçalho `x-netlify-event: schedule`
  // (qualquer cliente podia enviá-lo). Toda chamada POST exige token e papel admin.
  const authErr = await requireBearerAuth(event, 'admin');
  if (authErr) return authErr;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const mode = body.mode || 'scan';

  // ── MODO HEAL ─────────────────────────────────────────────────────
  if (mode === 'heal') {
    // SEC Fase 1 (C4): modo heal desligado por padrão. Mesmo ligado, só gera
    // diagnóstico e issue; não aplica overrides do LLM em coleção alguma nem
    // dispara redeploy. O único registro gravado é o relatório (coleções fixas).
    if (process.env.SENTINEL_HEAL_ENABLED !== 'true') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Sentinel heal desativado nesta versão.' }) };
    }
    const issues = body.issues || [];
    if (!issues.length) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'issues[] obrigatório' }) };
    }

    const errorIssues = issues.filter(i => ['CRITICAL', 'HIGH'].includes(i.severity));

    // 1. Diagnóstico IA
    const diagnosis = await diagnosisViaAI(errorIssues, JSON.stringify(issues.slice(0, 10)));

    // 2. Overrides sugeridos pelo LLM NÃO são aplicados (C4); fica só o registro
    const firestoreResult = await applyFirestoreOverrides(diagnosis?.fixes || []);

    // 3. Abrir GitHub issue se há críticos
    let githubResult = null;
    if (diagnosis?.fixes?.some(f => f.priority === 'CRITICAL')) {
      githubResult = await openGitHubPR(diagnosis.fixes, { errorCount: errorIssues.length });
    }

    // 4. Redeploy automático desativado (C4): nenhum deploy hook é chamado daqui
    const redeployResult = await triggerRedeploy('heal');

    // 5. Registro do heal (coleções fixas, sem dados escolhidos pelo LLM como destino)
    const healReport = {
      timestamp:          new Date().toISOString(),
      issuesReceived:     issues.length,
      criticalIssues:     errorIssues.length,
      diagnosis,
      firestoreOverrides: firestoreResult,
      githubIssue:        githubResult,
      redeploy:           redeployResult,
      aiEngine:           process.env.ANTHROPIC_API_KEY ? 'claude-haiku' : 'llama-3.3-70b',
    };

    if (db) {
      await Promise.all([
        db.collection('sentinel_heals').add({ ...healReport, ts: admin.firestore.FieldValue.serverTimestamp() }),
        db.collection('system_status').doc('last_heal').set({ ...healReport, ts: admin.firestore.FieldValue.serverTimestamp() }),
      ]).catch(() => {});
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(healReport) };
  }

  // ── MODO SCAN (default) ───────────────────────────────────────────
  // APIs com skipScan:true nao sao escaneadas — exigem token que o sentinel nao tem.
  // Sao listadas no relatorio como "skipped" para transparencia, sem afetar score.
  const scanTargets  = ENDPOINTS.filter(ep => !ep.skipScan);
  const skippedAPIs  = ENDPOINTS.filter(ep => ep.skipScan).map(ep => ({
    name: ep.name, url: ep.url, group: ep.group, skipped: true, reason: 'Requer auth — skipScan:true',
  }));

  const results  = await Promise.all(scanTargets.map(scanEndpoint));
  const errors   = results.filter(r => !r.ok);
  const ok       = errors.length === 0;
  const avgMs    = results.length ? Math.round(results.reduce((a, b) => a + b.ms, 0) / results.length) : 0;

  let diagnosis = null;
  if (!ok) {
    diagnosis = await diagnosisViaAI(errors);
  }

  // SEC Fase 1 (C4): o auto-heal do scan agendado foi removido junto com o bypass por cabeçalho
  const autoHealResult = null;

  const issues = errors.map(e => ({
    type:     e.status >= 500 || e.status === 0 ? 'DOWN' : 'DEGRADED',
    severity: e.status >= 500 || e.status === 0 ? 'CRITICAL' : 'HIGH',
    route:    e.url,
    name:     e.name,
    detail:   e.error || `HTTP ${e.status}`,
    status:   e.status,
    ms:       e.ms,
  }));

  const routeResults = results.filter(r => !r.url.includes('/api/'));
  const fnResults    = results.filter(r =>  r.url.includes('/api/'));

  // FIX v53: score calculado APENAS sobre rotas estáticas (não APIs)
  // APIs retornam 401 sem token — isso infla o score artificialmente
  // Score real = páginas que retornam 200 / total de páginas
  const routeOK   = routeResults.filter(r => r.ok && r.status === 200).length;
  const routeFail = routeResults.filter(r => !r.ok || r.status !== 200).length;
  const fnOK      = fnResults.filter(r => r.ok).length;
  const fnFail    = fnResults.filter(r => !r.ok).length;

  // health basado em rotas críticas (não APIs que sempre retornam 401)
  const criticalRouteErrors = routeResults.filter(r => !r.ok || r.status >= 500);
  const healthStatus = criticalRouteErrors.length === 0 ? 'HEALTHY'
    : criticalRouteErrors.some(e => e.status >= 500 || e.status === 0) ? 'DOWN'
    : 'DEGRADED';

  const report = {
    timestamp:      new Date().toISOString(),
    ok:             routeOK === routeResults.length,
    totalEndpoints: results.length,
    okCount:        results.filter(r => r.ok).length,
    errorCount:     errors.length,
    avgMs,
    results,
    errors,
    diagnosis,
    autoHeal:       autoHealResult,
    version:        'v3.2',

    // Formato enriquecido para sentinel-dashboard
    health:      healthStatus,
    scannedAt:   new Date().toISOString(),
    durationMs:  avgMs * results.length,
    routeOK,
    routeFail,
    fnOK,
    fnFail,
    critical:    issues.filter(i => i.severity === 'CRITICAL').length,
    totalIssues: issues.length,
    issues,
    fnResults:   fnResults.map(r => ({ name: r.name, url: r.url, ok: r.ok, status: r.status, ms: r.ms, error: r.error || null })),
    skippedAPIs, // APIs com skipScan:true — listadas para auditoria, fora do score
  };

  if (db) {
    await Promise.all([
      db.collection('sentinel_reports').add({ ...report, criadoEm: admin.firestore.FieldValue.serverTimestamp() }),
      db.collection('system_status').doc('sentinel').set({ ...report, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }),
    ]).catch(() => {});
  }

  return {
    statusCode: ok ? 200 : 207,
    headers:    CORS,
    body:       JSON.stringify(report),
  };
};

// Exposto só para testes de regressão da Fase 1 (C4)
exports._applyFirestoreOverrides = applyFirestoreOverrides;
exports._triggerRedeploy = triggerRedeploy;
