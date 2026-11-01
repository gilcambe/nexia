#!/usr/bin/env node
'use strict';
// ADR-FREE-02: ponto de entrada do workflow "NEXIA Jobs". Lê a tarefa de NEXIA_JOB (JSON só com ids)
// e roda com o mesmo código da API. Saída curta, sem dados do cliente.
const { runJob } = require('../nexia-ai/jobs/runner');
const { loadSecrets } = require('../nexia-ai/jobs/secrets');
const { carregarDoD1, salvarNoD1, carregarUsoDoD1, salvarUsoNoD1 } = require('../nexia-ai/model-router/cota');
const { carregarCacheDoD1, salvarCacheNoD1 } = require('../nexia-ai/model-router/cache');

loadSecrets(process.env);

(async () => {
  let job;
  try { job = JSON.parse(process.env.NEXIA_JOB || ''); } catch { console.error('NEXIA_JOB não é JSON.'); process.exit(2); }
  // Placar de cota: começa sabendo quais IAs estão sem cota (salvo pelos jobs anteriores) e salva ao terminar.
  await carregarDoD1(process.env);
  await carregarUsoDoD1(process.env);   // #2848 créditos internos por IA e por dia
  await carregarCacheDoD1(process.env); // #2853 respostas repetidas não gastam cota
  try {
    const r = await runJob(job);
    await salvarNoD1(process.env);
    await salvarUsoNoD1(process.env);
    await salvarCacheNoD1(process.env);
    console.log('[nexia-job] ok', JSON.stringify(r));
  } catch (e) {
    await salvarUsoNoD1(process.env);
    await salvarCacheNoD1(process.env);
    await salvarNoD1(process.env);   // antes do process.exit, que pula o finally
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
