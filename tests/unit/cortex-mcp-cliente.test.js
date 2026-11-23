const test = require('node:test');
const assert = require('node:assert');
const { criarClienteMcp } = require('../../nexia-ai/integrations/mcp-cliente');

test('MCP Client - listarFerramentas devolve os nomes e inicializa corretamente', async () => {
  const fetchFalso = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === 'initialize') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2024-11-05' } })
      };
    }
    if (body.method === 'tools/list') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            tools: [
              { name: 'read_file', description: 'Lê um arquivo' },
              { name: 'delete_file', description: 'Apaga um arquivo' }
            ]
          }
        })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const cliente = criarClienteMcp({ url: 'http://mcp.test', fetchImpl: fetchFalso, token: 'meu-token' });
  
  const initRes = await cliente.inicializar();
  assert.strictEqual(initRes.ok, true);

  const listRes = await cliente.listarFerramentas();
  assert.strictEqual(listRes.ok, true);
  assert.strictEqual(listRes.ferramentas.length, 2);
  assert.strictEqual(listRes.ferramentas[0].name, 'read_file');
});

test('MCP Client - chamar ferramenta de leitura funciona', async () => {
  const fetchFalso = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === 'tools/call') {
      assert.strictEqual(body.params.name, 'read_file');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: body.id,
          result: { content: 'conteudo do arquivo' }
        })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const cliente = criarClienteMcp({ url: 'http://mcp.test', fetchImpl: fetchFalso });
  const res = await cliente.chamar('read_file', { path: '/tmp/teste.txt' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.resultado.content, 'conteudo do arquivo');
});

test('MCP Client - delete_file é recusada sem permitirEscrita e aceita com ela', async () => {
  let chamouFetch = false;
  const fetchFalso = async (url, opts) => {
    chamouFetch = true;
    const body = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: body.id,
        result: { success: true }
      })
    };
  };

  // Sem permitirEscrita
  const clientePadrao = criarClienteMcp({ url: 'http://mcp.test', fetchImpl: fetchFalso, permitirEscrita: false });
  const resNegada = await clientePadrao.chamar('delete_file', { path: '/tmp/arquivo.txt' });
  assert.strictEqual(resNegada.ok, false);
  assert.strictEqual(chamouFetch, false);

  // Com permitirEscrita
  const clienteEscrita = criarClienteMcp({ url: 'http://mcp.test', fetchImpl: fetchFalso, permitirEscrita: true });
  const resAceita = await clienteEscrita.chamar('delete_file', { path: '/tmp/arquivo.txt' });
  assert.strictEqual(resAceita.ok, true);
  assert.strictEqual(chamouFetch, true);
});

test('MCP Client - resposta de erro JSON-RPC e falha de rede viram { ok: false }', async () => {
  // Teste de Erro JSON-RPC
  const fetchErroJsonRpc = async (url, opts) => {
    const body = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32601, message: 'Metodo nao encontrado' }
      })
    };
  };

  const clienteJson = criarClienteMcp({ url: 'http://mcp.test', fetchImpl: fetchErroJsonRpc });
  const resJson = await clienteJson.chamar('read_file');
  assert.strictEqual(resJson.ok, false);
  assert.match(resJson.erro, /Metodo nao encontrado/);

  // Teste de Falha de Rede
  const fetchFalhaRede = async () => {
    throw new Error('Network failure');
  };

  const clienteRede = criarClienteMcp({ url: 'http://mcp.test', fetchImpl: fetchFalhaRede });
  const resRede = await clienteRede.chamar('read_file');
  assert.strictEqual(resRede.ok, false);
  assert.match(resRede.erro, /Network failure/);
});
