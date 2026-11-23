function criarClienteMcp({ url, fetchImpl = globalThis.fetch, token, permitirEscrita = false } = {}) {
  let idReq = 1;

  async function requisitar(method, params = {}) {
    const id = idReq++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return { ok: false, erro: `HTTP error status: ${response.status}` };
      }

      const data = await response.json();
      if (data.error) {
        return { ok: false, erro: data.error.message || JSON.stringify(data.error) };
      }

      return { ok: true, resultado: data.result };
    } catch (err) {
      return { ok: false, erro: err.message || String(err) };
    }
  }

  async function inicializar() {
    return requisitar('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nexia-mcp-client', version: '1.0.0' }
    });
  }

  async function listarFerramentas() {
    const res = await requisitar('tools/list', {});
    if (!res.ok) {
      return { ok: false, erro: res.erro };
    }
    const tools = res.resultado?.tools || res.resultado || [];
    return { ok: true, ferramentas: tools };
  }

  async function chamar(nome, args = {}) {
    if (!permitirEscrita) {
      const termo = String(nome).toLowerCase();
      const palavrasProibidas = ['create', 'update', 'delete', 'send', 'write', 'remove', 'apagar', 'enviar', 'criar'];
      const bloqueada = palavrasProibidas.some((p) => termo.includes(p));
      if (bloqueada) {
        return { ok: false, erro: `Ferramenta de escrita "${nome}" recusada sem permitirEscrita.` };
      }
    }

    const res = await requisitar('tools/call', {
      name: nome,
      arguments: args
    });

    if (!res.ok) {
      return { ok: false, erro: res.erro };
    }

    return { ok: true, resultado: res.resultado };
  }

  return {
    inicializar,
    listarFerramentas,
    chamar
  };
}

module.exports = { criarClienteMcp };
