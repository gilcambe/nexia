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
    const msg = `${e && (e.code || e.name)} ${e && e.message ? String(e.message).slice(0, 300) : ''}`.replace(/[\r\n%]+/g, ' ');
    console.error('[nexia-job] falhou', msg);
    // Anotação legível pela API de check-runs (o log do Actions não é): só código e mensagem curta.
    console.log(`::error title=Falha da tarefa::${msg}`);
    // Os dois bancos sem cota: guarda o pedido (só ids) para a Issue "nexia-job-pendente" (passo seguinte do workflow).
    if (e && e.code === 'QUOTA_BOTH' && process.env.NEXIA_PENDING_FILE) {
      try { require('fs').writeFileSync(process.env.NEXIA_PENDING_FILE, JSON.stringify(job)); } catch { /* sem arquivo, sem Issue */ }
    }
    process.exit(1);
  }
})();
