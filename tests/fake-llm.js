'use strict';
// Servidor falso dos provedores de IA para os testes do Model Router (Fase 5).
// Fala o protocolo de cada API (Anthropic Messages SSE, OpenAI Chat Completions SSE,
// Gemini streamGenerateContent SSE) para exercitar os adapters e o SDK oficial de verdade,
// sem chave real e sem rede externa. `gate` segura a resposta depois do primeiro trecho,
// para provar que o primeiro token chega ao cliente antes do fim da geração.
const http = require('http');

function createFakeLLM() {
  const state = {
    requests: [],
    text: ['Olá', ', mundo', '!'],
    toolInput: null,          // Anthropic/OpenAI: devolve tool_use com este input quando há tools
    status: {},               // { anthropic: 500, openai: 429, gemini: 503 } para simular falha
    gate: null,               // Promise: segura a resposta após o primeiro trecho
    firstChunkSent: null,     // resolvida quando o primeiro trecho sai
    failMidStream: false,     // corta a conexão 100 ms depois do primeiro trecho
  };
  let markFirst;
  const resetFirst = () => { state.firstChunkSent = new Promise(r => { markFirst = r; }); };
  resetFirst();

  const sse = (res, event, data) => res.write(`${event ? `event: ${event}\n` : ''}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);

  async function stream(res, chunks, write, finish) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    for (let i = 0; i < chunks.length; i++) {
      write(chunks[i]);
      if (i === 0) {
        markFirst();
        if (state.failMidStream) { await new Promise(r => setTimeout(r, 100)); res.destroy(); return; }
        if (state.gate) await state.gate;
      }
    }
    finish();
    res.end();
  }

  async function anthropic(req, res, body) {
    if (state.status.anthropic) { res.writeHead(state.status.anthropic, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'falha simulada' } })); }
    const model = body.model;
    const usage = { input_tokens: 12, output_tokens: 1 };
    const useTool = body.tools && body.tools.length && state.toolInput;
    if (!body.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const content = useTool ? [{ type: 'tool_use', id: 'toolu_1', name: body.tools[0].name, input: state.toolInput }] : [{ type: 'text', text: state.text.join('') }];
      return res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model, content, stop_reason: useTool ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 12, output_tokens: 7 } }));
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    sse(res, 'message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage } });
    if (useTool) {
      sse(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: body.tools[0].name, input: {} } });
      sse(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(state.toolInput) } });
      sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
      sse(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } });
      sse(res, 'message_stop', { type: 'message_stop' });
      markFirst();
      return res.end();
    }
    sse(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    // cabeçalhos já enviados; o stream() abaixo só escreve os deltas
    for (let i = 0; i < state.text.length; i++) {
      sse(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: state.text[i] } });
      if (i === 0) {
        markFirst();
        if (state.failMidStream) { await new Promise(r => setTimeout(r, 100)); res.destroy(); return undefined; }
        if (state.gate) await state.gate;
      }
    }
    sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
    sse(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } });
    sse(res, 'message_stop', { type: 'message_stop' });
    return res.end();
  }

  async function openai(req, res, body) {
    if (state.status.openai) { res.writeHead(state.status.openai, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'falha simulada' } })); }
    if (!body.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const message = body.tools && state.toolInput
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: body.tools[0].function.name, arguments: JSON.stringify(state.toolInput) } }] }
        : { role: 'assistant', content: state.text.join('') };
      return res.end(JSON.stringify({ model: body.model, choices: [{ message, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } }));
    }
    return stream(res, state.text, t => sse(res, null, { choices: [{ delta: { content: t } }] }), () => {
      sse(res, null, { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
      sse(res, null, '[DONE]');
    });
  }

  async function gemini(req, res, body, streaming) {
    if (state.status.gemini) { res.writeHead(state.status.gemini, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'falha simulada' } })); }
    const part = t => ({ candidates: [{ content: { parts: [{ text: t }], role: 'model' } }] });
    if (!streaming) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ...part(state.text.join('')), usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3 } })); }
    return stream(res, state.text, t => sse(res, null, part(t)), () => sse(res, null, { candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3 } }));
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { /* corpo inválido */ }
      state.requests.push({ path: req.url, headers: req.headers, body });
      const p = req.url;
      if (p.startsWith('/v1/messages')) return anthropic(req, res, body);
      if (p.startsWith('/openai/')) return openai(req, res, body);
      if (p.startsWith('/gemini/')) return gemini(req, res, body, p.includes(':streamGenerateContent'));
      res.writeHead(404); return res.end();
    });
  });

  return {
    state,
    resetFirst,
    async start(port = 0) { await new Promise(r => server.listen(port, '127.0.0.1', r)); this.url = `http://127.0.0.1:${server.address().port}`; return this; },
    close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(r); }),
    baseUrls() {
      return { anthropic: this.url, openai: `${this.url}/openai/chat/completions`, groq: `${this.url}/openai/chat/completions`, deepseek: `${this.url}/openai/chat/completions`, gemini: `${this.url}/gemini` };
    },
  };
}

module.exports = { createFakeLLM };
