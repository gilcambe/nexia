import { apiPath, healthUrl, firebaseConfigUrl } from "@/config/env";
import { initFirebase } from "@/services/firebase";
import { criarLeitorSSE, type EventoSSE } from "@/lib/sse";

// Token do usuário logado no Firebase; sem login devolve {} e a API responde 401.
async function cabecalhoAuth(): Promise<Record<string, string>> {
  try {
    const result = await initFirebase();
    const u = result?.auth?.currentUser;
    if (!u) return {};
    const token = await u.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  version: string;
  uptime: number;
  timestamp: string;
}

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface SentinelReport {
  okCount: number;
  totalEndpoints: number;
  errorCount: number;
  errors?: { url: string; error: string; status?: number }[];
}

export interface CortexStreamChunk {
  token?: string;
  done?: boolean;
  model?: string;
  intent?: string;
  usage?: { calls: number; limit: number; unlimited?: boolean };
}

export interface AutomationItem {
  id: string;
  name: string;
  template?: string;
  scheduleTime: string;
  channel: string;
  active: boolean;
  status: "ativa" | "pausada";
  lastRun?: string;
  createdAt: string;
}

export interface CortexReply {
  reply: string;
  type: string;
  intent: string;
  _meta: {
    layer: number | string;
    ms: number;
    modelUsed: string;
    version: string;
    conversationId: string;
    plan: string;
    usage: { calls: number; limit: number };
  };
}

async function _fetch<T>(
  url: string,
  opts: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    semLogin?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(opts.semLogin ? {} : await cabecalhoAuth()), ...(opts.headers || {}) },
      method: opts.method,
      body: opts.body,
      signal: opts.signal,
    });
    const status = res.status;
    if (status === 401) return { error: "Faça login para usar o Cortex.", status };
    if (!res.ok) {
      const body = await res.text();
      return { error: body || `HTTP ${status}`, status };
    }
    const data = (await res.json()) as T;
    return { data, status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { error: msg, status: 0 };
  }
}

export async function* streamCortex(
  payload: {
    message: string;
    model?: string;
    tenantId?: string;
    conversationId?: string;
    /** #831: Rápido = modelo pequeno, Pensar = raciocínio, Pesquisar = web. */
    modo?: "rapido" | "pensar" | "pesquisar";
  },
  signal?: AbortSignal
): AsyncGenerator<CortexStreamChunk, void, unknown> {
  const url = apiPath("/cortex");
  const body = JSON.stringify({
    message: payload.message,
    model: payload.model === "auto" ? "auto" : payload.model,
    tenantId: payload.tenantId || "nexia",
    stream: true,
    maxTokens: 0,
    conversationId: payload.conversationId || "default",
    ...(payload.modo ? { modo: payload.modo } : {}),
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAuth()) },
      body,
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    yield { token: `❌ Erro de rede: ${msg}`, done: true };
    return;
  }

  if (res.status === 401) {
    yield { token: "Faça login para usar o Cortex.", done: true };
    return;
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    yield { token: `Erro na API (${res.status}): ${txt}`, done: true };
    return;
  }

  if (!res.body) {
    yield { token: "Erro: resposta vazia do servidor", done: true };
    return;
  }

  // Respostas prontas (ação, imagem) vêm em JSON mesmo com stream: true; viram um pedaço só.
  if (/application\/json/i.test(res.headers.get("Content-Type") || "")) {
    const j = (await res.json().catch(() => ({}))) as Partial<CortexReply> & { error?: string; _meta?: { modelUsed?: string } };
    yield { token: String(j.reply ?? j.error ?? ""), done: true, model: j._meta?.modelUsed };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const leitor = criarLeitorSSE();
  const converter = (ev: EventoSSE): CortexStreamChunk | "fim" =>
    "fim" in ev ? "fim" : "json" in ev ? (ev.json as CortexStreamChunk) : { token: ev.texto, done: false };

  try {
    while (true) {
      const { done, value } = await reader.read();
      const eventos = done ? leitor.terminar() : leitor.empurrar(decoder.decode(value, { stream: true }));
      for (const ev of eventos) {
        const c = converter(ev);
        if (c === "fim") return;
        yield c;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function cortexChatSync(payload: {
  message: string;
  model?: string;
  tenantId?: string;
}): Promise<ApiResponse<CortexReply>> {
  return _fetch<CortexReply>(apiPath("/cortex"), {
    method: "POST",
    body: JSON.stringify({
      message: payload.message,
      model: payload.model === "auto" ? "auto" : payload.model,
      tenantId: payload.tenantId || "nexia",
      stream: false,
      maxTokens: 0,
      conversationId: "default",
    }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export const api = {
  health: () => _fetch<HealthStatus>(healthUrl()),
  // Sem token: pedir o token chamaria initFirebase(), que pede a config de novo (laço de centenas de pedidos por abertura).
  firebaseConfig: () => _fetch<FirebaseClientConfig>(firebaseConfigUrl(), { semLogin: true }),
  sentinelScan: () =>
    _fetch<SentinelReport>(apiPath("/sentinel-qa"), {
      method: "POST",
      body: JSON.stringify({ mode: "scan" }),
    }),
  sentinelPing: () =>
    _fetch<{ ok: boolean; ts?: string }>(apiPath("/sentinel-qa") + "?action=ping"),
  sentinelHeal: (issues: AnyObj[]) =>
    _fetch<AnyObj>(apiPath("/sentinel-qa"), {
      method: "POST",
      body: JSON.stringify({ mode: "heal", issues }),
    }),
  cortexChat: cortexChatSync,
  models: () => _fetch<unknown>(apiPath("/models")),
  usage: () => _fetch<unknown>(apiPath("/usage")),
  logs: () => _fetch<unknown>(apiPath("/logs")),
  swarmRun: (payload: AnyObj) =>
    _fetch<unknown>(apiPath("/swarm"), {
      method: "POST",
      body: JSON.stringify({ ...payload, tenantId: payload.tenantId || "nexia" }),
    }),
  authHealth: () =>
    _fetch<unknown>(apiPath("/auth"), {
      method: "POST",
      body: JSON.stringify({ action: "health" }),
    }),
  tenantInfo: (tenantId: string) =>
    _fetch<unknown>(apiPath("/tenant") + "?tenantId=" + encodeURIComponent(tenantId)),
  billingStatus: (tenantId: string) =>
    _fetch<unknown>(apiPath("/billing") + "?tenantId=" + encodeURIComponent(tenantId)),
  agentRun: (payload: AnyObj) =>
    _fetch<unknown>(apiPath("/agent-run"), {
      method: "POST",
      body: JSON.stringify({ ...payload, tenantId: payload.tenantId || "nexia" }),
    }),
  metrics: (tenantId: string) =>
    _fetch<unknown>(apiPath("/metrics") + "?tenantId=" + encodeURIComponent(tenantId)),
  observe: (tenantId: string) =>
    _fetch<unknown>(apiPath("/observe") + "?tenantId=" + encodeURIComponent(tenantId)),
  kpiSummary: (tenantId: string) =>
    _fetch<unknown>(apiPath("/kpi") + "?action=summary&tenantId=" + encodeURIComponent(tenantId)),
  automations: (tenantId?: string) =>
    _fetch<{ items: AutomationItem[] }>(apiPath("/automations") + (tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "")),
  createAutomation: (payload: { name: string; template?: string; scheduleTime: string; channel: string; tenantId?: string }) =>
    _fetch<{ record: AutomationItem }>(apiPath("/automations"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAutomation: (id: string, payload: Partial<AutomationItem> & { tenantId?: string }) =>
    _fetch<{ record: AutomationItem }>(apiPath(`/automations/${id}`), {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAutomation: (id: string, tenantId?: string) =>
    _fetch<{ ok: boolean }>(apiPath(`/automations/${id}`), {
      method: "DELETE",
      body: JSON.stringify({ tenantId }),
    }),
};

export default api;
