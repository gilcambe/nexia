'use strict';
// Testes para #1631: Cortex Qualidade Q3 (nunca travar, troca de IA se a resposta não começar em 4 s)
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../../nexia-ai/model-router');
const { createPlacar, CIRCUITO_FALHAS } = require('../../nexia-ai/model-router/cota');

test('Q3-1. Provedor 1 não entrega primeira palavra em 4s (simulado) -> troca para Provedor 2 sem erro', async () => {
  const providers = {
    lento: {
      capabilities: () => ({ streaming: true }),
      available: () => true,
      async *stream() {
        // Demora mais de 50 ms (simulando > 4s em ambiente de teste com firstChunkTimeoutMs reduzido)
        await new Promise(r => setTimeout(r, 80));
        yield { type: 'text', text: 'primeira palavra' };
      }
    },
    rapido: {
      capabilities: () => ({ streaming: true }),
      available: () => true,
      async *stream() {
        yield { type: 'text', text: 'resposta rapida' };
      }
    }
  };

  const router = createRouter({ providers });
  const descs = [{ provider: 'lento', model: 'm1' }, { provider: 'rapido', model: 'm2' }];

  const events = [];
  for await (const ev of router.streamWithFallback(descs, { messages: [{ role: 'user', content: 'oi' }] }, { firstChunkTimeoutMs: 30 })) {
    events.push(ev);
  }

  assert.equal(events[0].type, 'model');
  assert.equal(events[0].provider, 'rapido');
  assert.equal(events[1].type, 'text');
  assert.equal(events[1].text, 'resposta rapida');
});

test('Q3-2. Provedor 1 para no meio (> 8s simulado) -> Provedor 2 continua a partir do texto gerado', async () => {
  let p2Messages = null;
  const providers = {
    travador: {
      capabilities: () => ({ streaming: true }),
      available: () => true,
      async *stream() {
        yield { type: 'text', text: 'Inicio da resposta... ' };
        await new Promise(r => setTimeout(r, 80));
        yield { type: 'text', text: 'fim que nao chega' };
      }
    },
    continuador: {
      capabilities: () => ({ streaming: true }),
      available: () => true,
      async *stream(model, req) {
        p2Messages = req.messages;
        yield { type: 'text', text: 'e continuação com sucesso.' };
      }
    }
  };

  const router = createRouter({ providers });
  const descs = [{ provider: 'travador', model: 'm1' }, { provider: 'continuador', model: 'm2' }];

  const events = [];
  for await (const ev of router.streamWithFallback(descs, { messages: [{ role: 'user', content: 'me conte uma historia' }] }, { stallTimeoutMs: 30 })) {
    events.push(ev);
  }

  const textoCompleto = events.filter(e => e.type === 'text').map(e => e.text).join('');
  assert.equal(textoCompleto, 'Inicio da resposta... e continuação com sucesso.');
  assert.ok(p2Messages, 'o segundo provedor recebeu mensagens de continuação');
  assert.ok(JSON.stringify(p2Messages).includes('Inicio da resposta...'));
});

test('Q3-3. Estouro de tempo total de 60s (simulado) -> mensagem clara "Não consegui agora, tente de novo"', async () => {
  const providers = {
    infinito: {
      capabilities: () => ({ streaming: true }),
      available: () => true,
      async *stream() {
        await new Promise(r => setTimeout(r, 200));
        yield { type: 'text', text: 'nunca chega' };
      }
    }
  };

  const router = createRouter({ providers });
  const descs = [{ provider: 'infinito', model: 'm1' }];

  const events = [];
  for await (const ev of router.streamWithFallback(descs, { messages: [{ role: 'user', content: 'oi' }] }, { firstChunkTimeoutMs: 10, totalTimeoutMs: 20 })) {
    events.push(ev);
  }

  const textoCompleto = events.filter(e => e.type === 'text').map(e => e.text).join('');
  assert.ok(textoCompleto.includes('Não consegui agora, tente de novo'));
});

test('Q3-4. Provedor que falha 3 vezes seguidas fica de castigo por 5 min no placar compartilhado', () => {
  let agoraMs = 1000;
  const placar = createPlacar({ agora: () => agoraMs });
  const desc = { provider: 'groq', model: 'llama3' };

  for (let i = 0; i < CIRCUITO_FALHAS - 1; i++) {
    placar.marcar(desc, 'transient');
    assert.equal(placar.bloqueado(desc), false);
  }

  // 3ª falha ativa o castigo de 5 min (300.000 ms)
  placar.marcar(desc, 'transient');
  assert.equal(placar.bloqueado(desc), true);

  const exp = placar.exportar()['groq|llama3'];
  assert.equal(exp.motivo, 'circuito');
  assert.equal(exp.ate, agoraMs + 5 * 60 * 1000);
});
