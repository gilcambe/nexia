#!/usr/bin/env node
'use strict';
// ADR-FREE-02: ponto de entrada do workflow "NEXIA Jobs". Lê a tarefa de NEXIA_JOB (JSON só com ids)
// e roda com o mesmo código da API. Saída curta, sem dados do cliente.
const { runJob } = require('../nexia-ai/jobs/runner');
const { loadSecrets } = require('../nexia-ai/jobs/secrets');

loadSecrets(process.env);

(async () => {
  let job;
  try { job = JSON.parse(process.env.NEXIA_JOB || ''); } catch { console.error('NEXIA_JOB não é JSON.'); process.exit(2); }
  try {
    const r = await runJob(job);
    console.log('[nexia-job] ok', JSON.stringify(r));
  } catch (e) {
    console.error('[nexia-job] falhou', e && (e.code || e.name), e && e.message ? String(e.message).slice(0, 300) : '');
    process.exit(1);
  }
})();
