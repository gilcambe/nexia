'use strict';
// Servidor MCP mínimo sobre stdio (JSON-RPC 2.0, uma mensagem por linha), sem
// dependências: initialize, tools/list, tools/call, ping e, quando o cliente declara
// suporte, elicitation/create para pedir confirmação direto à pessoa.
const readline = require('readline');

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'nexia-bridge', version: '1.0.0' };

function createMcpServer({ tools, input = process.stdin, output = process.stdout }) {
  let clientInfo = { name: 'desconhecido' };
  let elicitation = false;
  let nextId = 1;
  const waiting = new Map();
  const send = msg => output.write(`${JSON.stringify(msg)}\n`);
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  /** Pergunta à pessoa pela interface do cliente MCP (o modelo não responde por ela). */
  function elicit(message) {
    const id = `nexia-${nextId++}`;
    send({ jsonrpc: '2.0', id, method: 'elicitation/create', params: {
      message,
      requestedSchema: { type: 'object', properties: { aprovar: { type: 'boolean', title: 'Aprovar esta operação?' } }, required: ['aprovar'] },
    } });
    return new Promise(resolve => {
      const timer = setTimeout(() => { waiting.delete(id); resolve(false); }, 5 * 60 * 1000);
      waiting.set(id, r => { clearTimeout(timer); resolve(!!(r && r.action === 'accept' && r.content && r.content.aprovar === true)); });
    });
  }
  elicit.supported = () => elicitation;

  const t = tools({ elicit, agent: () => clientInfo.name || 'desconhecido' });

  async function handle(msg) {
    if (msg.id !== undefined && !msg.method) { // resposta a um pedido nosso (elicitation)
      const w = waiting.get(msg.id);
      if (w) { waiting.delete(msg.id); w(msg.error ? null : msg.result); }
      return;
    }
    const { id, method, params = {} } = msg;
    if (method === 'initialize') {
      clientInfo = params.clientInfo || clientInfo;
      elicitation = !!(params.capabilities && params.capabilities.elicitation);
      const protocolVersion = SUPPORTED.includes(params.protocolVersion) ? params.protocolVersion : SUPPORTED[0];
      return reply(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO,
        instructions: 'NEXIA Bridge: acesso ao workspace local por projeto. Arquivos .env e credenciais nunca são lidos. Operações de escrita podem exigir aprovação humana.' });
    }
    if (method === 'notifications/initialized' || (method && method.startsWith('notifications/'))) return undefined;
    if (method === 'ping') return reply(id, {});
    if (method === 'tools/list') return reply(id, { tools: t.definitions });
    if (method === 'tools/call') {
      const r = await t.call(params.name, params.arguments || {});
      const body = r.ok ? r.result : { error: r.error };
      return reply(id, { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body, isError: !r.ok });
    }
    if (id !== undefined) return fail(id, -32601, `Método não suportado: ${method}`);
    return undefined;
  }

  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', line => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }); }
    Promise.resolve(handle(msg)).catch(() => { if (msg && msg.id !== undefined) fail(msg.id, -32603, 'Erro interno'); });
  });
  return { close: () => rl.close() };
}

module.exports = { createMcpServer, SUPPORTED };
