#!/usr/bin/env node
'use strict';
// Rodada do DIRETOR (Fase 8, 13/11/2026): 8h e 18h (Brasília) pelo workflow escritorio-diretor.yml.
// 1) lê o mural; 2) posta as cobranças de pedidos atrasados; 3) monta o resumo, guarda em escritorio/resumo (D1)
// e posta no mural; 4) imprime o resumo no log (Actions). Não gasta IA, não manda mensagem para fora.
const { createMural } = require('../nexia-ai/escritorio/mural');
const { montarResumo, cobrancas } = require('../nexia-ai/escritorio/diretor');

async function rodar({ mural = createMural(), agora = new Date().toISOString(), log = console.log } = {}) {
  if (!mural.ligado()) { log('Escritório sem D1 (NEXIA_D1_TOKEN/NEXIA_D1_ACCOUNT_ID): nada a fazer.'); return { ok: false }; }
  const recados = await mural.listar({ limite: 500 });
  const cob = cobrancas(recados, agora);
  for (const c of cob) await mural.postar(c);
  const resumo = montarResumo(await mural.listar({ limite: 500 }), agora);
  await mural.postar({ area: 'diretoria', agente: 'Diretor', tipo: 'info', texto: `Resumo: ${resumo.titulo}. Feito ${resumo.feitos}; precisa de você ${resumo.precisaVoce.length}; atrasado ${resumo.atrasados.length}.` });
  log(resumo.texto);
  log(`cobranças postadas: ${cob.length}`);
  return { ok: true, cobrancas: cob.length, resumo };
}

module.exports = { rodar };
if (require.main === module) rodar().catch((e) => { console.error('ERRO:', e && e.message); process.exit(1); });
