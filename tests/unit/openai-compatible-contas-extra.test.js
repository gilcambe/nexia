'use strict';
// Teste: fallback de contas extra (IA_VAGA_1..10) quando a conta principal retorna 429.
// Nunca loga a chave nem a expõe em issues.
const { createOpenAICompatibleProvider } = require('../../nexia-ai/model-router/providers/openai-compatible');

function criarFetchComRespostas(respostas) {
  let idx = 0;
  const chamadas = [];
  return async (url, init) => {
    chamadas.push({ url, auth: init.headers && init.headers.authorization });
    const r = respostas[idx] || respostas[respostas.length - 1];
    idx++;
    return {
      ok: r.ok,
      status: r.status,
      text: async () => r.texto || '',
      json: async () => r.json || { choices: [{ message: { content: 'ok' } }] },
      headers: new Map(),
      body: null,
      cancel: async () => {},
    };
  };
}

async function main() {
  const env = {
    GEMINI_API_KEY: 'chave-principal',
    IA_VAGA_2: 'groq:xyz',
    IA_VAGA_5: 'openrouter:abc123',
  };

  const fetchImpl = criarFetchComRespostas([
    { ok: false, status: 429, texto: 'rate limited' }, // conta principal -> 429
    { ok: true, status: 200, json: { choices: [{ message: { content: 'resposta extra' } }] } }, // primeira conta extra
  ]);

  const provider = createOpenAICompatibleProvider('google', { env, fetchImpl });

  const resultado = await provider.chat('gemini-1.5-flash', {
    messages: [{ role: 'user', content: 'oi' }],
  });

  if (resultado.text !== 'resposta extra') {
    throw new Error(`Esperava 'resposta extra', obteve '${resultado.text}'`);
  }

  // Verifica que a segunda chamada usou a chave da conta extra (groq:xyz)
  const chamadaExtra = fetchImpl.chamadas.find(c => c.auth === 'Bearer xyz');
  if (!chamadaExtra) {
    throw new Error('Nenhuma chamada usou a chave da conta extra (groq:xyz).');
  }

  // Verifica que a primeira chamada usou a chave principal
  const chamadaPrincipal = fetchImpl.chamadas.find(c => c.auth === 'Bearer chave-principal');
  if (!chamadaPrincipal) {
    throw new Error('Nenhuma chamada usou a chave principal.');
  }

  // Verifica ordem: principal primeiro, extra depois
  if (fetchImpl.chamadas.indexOf(chamadaPrincipal) >= fetchImpl.chamadas.indexOf(chamadaExtra)) {
    throw new Error('A conta extra não veio depois da principal.');
  }

  console.log('OK: fallback funcionou. Chamadas:', fetchImpl.chamadas.length, '| texto:', resultado.text);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
