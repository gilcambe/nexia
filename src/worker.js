import { chatRoutes } from './routes/chat.js';

/**
 * Durable Object que gerencia a fila de chat e o streaming SSE.
 * Cada cliente conectado recebe um ID e sua posição na fila.
 */
export class ChatDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map(); // id -> { controller, position, joinedAt }
    this.queue = []; // ids na ordem de entrada
    this.intervalMs = 5000; // estima ~20s para 3 posições (ajustável)
  }

  async fetch(request) {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId') || crypto.randomUUID();

    if (url.pathname === '/sse' || url.pathname === '/api/sse') {
      return this.handleSSE(request, clientId);
    }

    if (url.pathname === '/chat' || url.pathname === '/api/chat') {
      return this.handleChat(request, clientId);
    }

    return new Response('Not found', { status: 404 });
  }

  async handleSSE(request, clientId) {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const send = (data) => {
      const payload = `data: ${JSON.stringify(data)}\n\n`;
      return writer.write(encoder.encode(payload));
    };

    // Registra cliente na fila
    const position = this.queue.length + 1;
    this.queue.push(clientId);
    this.clients.set(clientId, {
      controller: writer,
      position,
      joinedAt: Date.now(),
    });

    // Persiste estado no DO
    await this.state.storage.put('queue', this.queue);
    await this.state.storage.put('clients', Object.fromEntries(this.clients));

    // Envia evento inicial com posição e tempo estimado
    const estimatedSeconds = position * (this.intervalMs / 1000);
    await send({
      type: 'queue',
      clientId,
      position,
      estimated: `você é o ${position}º, cerca de ${estimatedSeconds} s`,
    });

    // Atualiza posições dos demais clientes
    this.notifyQueueUpdate();

    // Mantém conexão aberta com heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await send({ type: 'heartbeat' });
      } catch (e) {
        clearInterval(heartbeat);
        this.removeClient(clientId);
      }
    }, 30000);

    // Quando cliente fecha, remove da fila
    request.signal.addEventListener('abort', () => {
      clearInterval(heartbeat);
      this.removeClient(clientId);
    });

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  async handleChat(request, clientId) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.json().catch(() => ({}));
    const { message } = body;

    // Responde colocando o cliente na fila se ainda não estiver
    if (!this.clients.has(clientId)) {
      const position = this.queue.length + 1;
      this.queue.push(clientId);
      this.clients.set(clientId, {
        controller: null,
        position,
        joinedAt: Date.now(),
      });
      await this.state.storage.put('queue', this.queue);
      await this.state.storage.put('clients', Object.fromEntries(this.clients));
    }

    const position = this.clients.get(clientId).position;
    const estimatedSeconds = position * (this.intervalMs / 1000);

    return new Response(
      JSON.stringify({
        ok: true,
        clientId,
        position,
        estimated: `você é o ${position}º, cerca de ${estimatedSeconds} s`,
        message: message || 'Mensagem recebida. Você está na fila.',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  notifyQueueUpdate() {
    const now = Date.now();
    for (const [id, client] of this.clients) {
      if (!client.controller) continue;
      const idx = this.queue.indexOf(id) + 1;
      const estimatedSeconds = idx * (this.intervalMs / 1000);
      client.controller.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            type: 'queue-update',
            clientId: id,
            position: idx,
            estimated: `você é o ${idx}º, cerca de ${estimatedSeconds} s`,
          })}\n\n`
        )
      ).catch(() => {
        this.removeClient(id);
      });
    }
  }

  removeClient(clientId) {
    const idx = this.queue.indexOf(clientId);
    if (idx >= 0) this.queue.splice(idx, 1);
    this.clients.delete(clientId);
    this.state.storage.put('queue', this.queue);
    this.state.storage.put('clients', Object.fromEntries(this.clients));
    this.notifyQueueUpdate();
  }
}

/**
 * Roteador principal do Cloudflare Worker.
 * Encaminha chat e SSE para o Durable Object e preserva as rotas existentes.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Chat e SSE -> Durable Object
    if (
      url.pathname.startsWith('/api/chat') ||
      url.pathname.startsWith('/api/sse') ||
      url.pathname.startsWith('/chat') ||
      url.pathname.startsWith('/sse')
    ) {
      const id = env.CHAT_DO.idFromName('chat-fila');
      const stub = env.CHAT_DO.get(id);
      return stub.fetch(request);
    }

    // 2. Rotas existentes da API (preservadas)
    // /api/cortex, /api/pedidos, /api/central, etc. seguem para os handlers do Netlify/Cloudflare.
    // Mantemos a passagem adiante para não quebrar nada que já existe.
    return chatRoutes(request, env, ctx);
  },
};
