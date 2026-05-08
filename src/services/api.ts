import { apiPath, healthUrl, firebaseConfigUrl } from "@/config/env";

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
  } = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      method: opts.method,
      body: opts.body,
      signal: opts.signal,
    });
    const status = res.status;
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
    conversationId: "default",
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    yield { token: `❌ Erro de rede: ${msg}`, done: true };
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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as CortexStreamChunk;
          yield parsed;
        } catch {
          yield { token: data, done: false };
        }
      }
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
  firebaseConfig: () => _fetch<FirebaseClientConfig>(firebaseConfigUrl()),
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
};

export default api;
