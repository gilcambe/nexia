'use strict';
// Escolha de modelo pelo Orchestrator (spec §14: tarefa, custo, contexto, latência e
// capacidade). Classe de tarefa → lista de candidatos em ordem; vale o primeiro cujo
// provedor está configurado e suporta tool_call.
const CLASSES = Object.freeze({
  reasoning: [{ provider: 'anthropic', model: 'claude-opus-5-5' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }],
  coding: [{ provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'anthropic', model: 'claude-opus-5-5' }],
  fast: [{ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }],
});

/** @returns {{ provider, model }[]} candidatos disponíveis para a classe */
function candidates(router, cls) {
  return (CLASSES[cls] || CLASSES.coding).filter(d => {
    try { const c = router.capabilities(d); return c && c.available !== false && c.tool_call; } catch { return false; }
  });
}

module.exports = { CLASSES, candidates };
