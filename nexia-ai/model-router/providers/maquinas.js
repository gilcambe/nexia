'use strict';
// #2826 (parte 2 de #1846): provedor `maquinas`. Manda tarefas internas leves (classificar, resumir, título)
// para os PCs do dono com Ollama, pela fila `tarefas_locais` do D1 (nexia-ai/maquinas.js). Sem túnel:
// o PC é que busca a tarefa. Sem PC online, falha na hora e o roteador pula para o próximo.
// Nunca chat de cliente, nunca código: quem escolhe a classe é a lista de modelos do orquestrador.
const { ModelError, CODES } = require('../errors');

const ESPERA_MAX_MS = 90 * 1000;
const INTERVALO_MS = 3000;
const dormir = (ms) => new Promise((r) => { const t = setTimeout(r, ms); if (t.unref) t.unref(); });

function createMaquinasProvider({ env = process.env, maquinas, esperaMaxMs = ESPERA_MAX_MS, intervaloMs = INTERVALO_MS, agora = Date.now, esperar = dormir } = {}) {
  let m = maquinas;
  const mq = () => m || (m = require('../../maquinas').createMaquinas({ env }));
  const ligado = () => String(env.NEXIA_MAQUINA_TOKEN || '').length >= 24 && mq().ligado();
  return {
    id: 'maquinas',
    available: ligado,
    capabilities: () => ({ chat: true, streaming: false, tool_call: false, vision: false, structured_output: false, max_output_tokens: 8192 }),
    async chat(model, req = {}) {
      if (!ligado()) throw new ModelError(CODES.NO_API_KEY, 'maquinas: NEXIA_MAQUINA_TOKEN ou D1 não configurado', { provider: 'maquinas' });
      const online = (await mq().listar()).filter((x) => x.online && x.ollamaOk !== false);
      if (!online.length) throw new ModelError(CODES.UPSTREAM, 'maquinas: nenhum PC online agora', { provider: 'maquinas', model, semMaquina: true });
      const mensagens = [...(req.system ? [{ role: 'system', content: String(req.system) }] : []), ...(req.messages || []).map((x) => ({ role: x.role, content: String(x.content || '') }))];
      // Resposta longa (código) roda devagar na CPU do PC: espera proporcional, até 12 min.
      const maxTok = Math.min(8192, Number(req.maxTokens) || 0);
      const id = await mq().criarTarefa({ tipo: maxTok > 1024 ? 'codigo' : 'texto', modelo: model, mensagens, ...(maxTok ? { max_tokens: maxTok } : {}) });
      const espera = maxTok > 1024 ? Math.max(esperaMaxMs, 12 * 60 * 1000) : esperaMaxMs;
      const fim = agora() + espera;
      while (agora() < fim) {
        await esperar(intervaloMs);
        const t = await mq().lerTarefa(id);
        if (t && t.status === 'feito') {
          return { provider: 'maquinas', model, text: t.texto || '', tool_calls: [], usage: { input_tokens: 0, output_tokens: Number(t.tokens) || 0, total_tokens: Number(t.tokens) || 0 }, stop_reason: 'stop', maquina: t.maquina || null };
        }
        if (t && t.status === 'erro') throw new ModelError(CODES.UPSTREAM, `maquinas: o PC devolveu erro (${String(t.erro || 'sem detalhe').replace(/s+/g, ' ').slice(0, 200)})`, { provider: 'maquinas', model });
      }
      const e = new ModelError(CODES.UPSTREAM, `maquinas: o PC não respondeu em ${Math.round(espera / 1000)} s`, { provider: 'maquinas', model });
      e.isTimeout = true;
      throw e;
    },
  };
}

module.exports = { createMaquinasProvider, ESPERA_MAX_MS };
