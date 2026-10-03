import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// NEXIA AI — Fase 11: observabilidade, auditoria e custos. Lê /api/nexia/metrics (agregado
// do Vault) e a trilha de chamadas de ferramenta do projeto. Só leitura.

interface Me { uid: string; role: string; tenantSlug: string | null; canUseVault: boolean }
interface Project { id: string; name: string }
interface ToolStat { risk: string; total: number; succeeded: number; failed: number; denied: number; avg_duration_ms: number | null }
interface Metrics {
  truncated: boolean;
  executions: { total: number; by_status: Record<string, number>; by_intent: Record<string, number>; input_tokens: number; output_tokens: number;
    tool_calls: number; cost_usd: number; cost_unknown: number; success_rate: number | null; avg_duration_ms: number | null };
  tools: Record<string, ToolStat>;
  decisions: Record<string, number>;
  approvals: { pending: number; approved: number; rejected: number; expired: number };
  deployments: { total: number; by_environment: Record<string, { total: number; by_status: Record<string, number>; last: { release: string; status: string; started_at: string; approved_by?: string } | null }> };
}
interface ToolCall { id: string; tool: string; risk: string; decision: string; status: string; requested_by: { type: string; id: string };
  decided_by?: { type: string; id: string }; requested_at: string; input_summary?: string; output_summary?: string; error_code?: string; duration_ms?: number }

const fmt = (n: number) => n.toLocaleString("pt-BR");
const secs = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);

export default function AuditoriaPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [m, setM] = useState<Metrics | null>(null);
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async <T,>(path: string): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath(`/nexia${path}`), { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body as T;
  }, [getToken]);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const me = await call<Me>("/me");
        setMe(me);
        if (!me.canUseVault) return;
        const p = await call<{ items: Project[] }>("/projects");
        setProjects(p.items);
        if (p.items[0]) setProjectId(p.items[0].id);
      } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar"); }
    })();
  }, [authLoading, user, call]);

  useEffect(() => {
    if (!projectId) return;
    setError(null);
    Promise.all([
      call<Metrics>(`/metrics?project_id=${encodeURIComponent(projectId)}`),
      call<{ items: ToolCall[] }>(`/tool-calls?project_id=${encodeURIComponent(projectId)}&limit=100`),
    ]).then(([mm, c]) => { setM(mm); setCalls(c.items); }).catch((e) => setError(e.message));
  }, [projectId, call]);

  const card = (label: string, value: string, hint?: string) => (
    <div key={label} className="rounded-xl border border-nexia-border bg-nexia-surface p-4">
      <div className="text-xs text-nexia-muted">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-xs text-nexia-muted">{hint}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/projetos")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Projetos
            </button>
            <h1 className="text-2xl font-bold" data-testid="auditoria-title">Auditoria e custos</h1>
          </div>
          <button onClick={() => navigate("/execucoes")} className="text-sm text-nexia-cyan cursor-pointer">Execuções</button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted" data-testid="auditoria-login">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> para ver auditoria e custos.
          </p>
        )}
        {me && !me.canUseVault && <p className="text-nexia-muted">Disponível só para master ou admin do tenant.</p>}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        {me?.canUseVault && (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Projeto"
            className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {m && (
          <>
            {m.truncated && <p className="text-xs text-yellow-300">Mostrando os 200 registros mais recentes de cada tipo.</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {card("Execuções", fmt(m.executions.total), Object.entries(m.executions.by_status).map(([k, v]) => `${k} ${v}`).join(" · "))}
              {card("Custo estimado", `US$ ${m.executions.cost_usd.toFixed(4)}`, m.executions.cost_unknown ? `${m.executions.cost_unknown} sem preço conhecido` : "todas com preço conhecido")}
              {card("Tokens", fmt(m.executions.input_tokens + m.executions.output_tokens), `${fmt(m.executions.tool_calls)} chamadas de ferramenta`)}
              {card("Sucesso / duração média", m.executions.success_rate === null ? "—" : `${Math.round(m.executions.success_rate * 100)}%`, secs(m.executions.avg_duration_ms))}
              {card("Aprovações", `${m.approvals.pending} pendente(s)`, `${m.approvals.approved} aprovada(s) · ${m.approvals.rejected} rejeitada(s) · ${m.approvals.expired} expirada(s)`)}
              {card("Decisões da política", Object.entries(m.decisions).map(([k, v]) => `${k} ${v}`).join(" · ") || "—")}
              {Object.entries(m.deployments.by_environment).map(([env, d]) => card(`Deploys ${env}`, fmt(d.total),
                d.last ? `último: ${d.last.status} (${new Date(d.last.started_at).toLocaleString("pt-BR")})${d.last.approved_by ? ` · aprovado por ${d.last.approved_by}` : ""}` : undefined))}
            </div>

            <h2 className="text-lg font-semibold pt-2">Ferramentas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-nexia-muted text-left"><tr><th className="py-1">Ferramenta</th><th>Risco</th><th>Total</th><th>OK</th><th>Falhas</th><th>Negadas</th><th>Média</th></tr></thead>
                <tbody>
                  {Object.entries(m.tools).sort((a, b) => b[1].total - a[1].total).map(([name, t]) => (
                    <tr key={name} className="border-t border-nexia-border"><td className="py-1 font-mono">{name}</td><td>{t.risk}</td><td>{t.total}</td><td>{t.succeeded}</td><td>{t.failed}</td><td>{t.denied}</td><td>{secs(t.avg_duration_ms)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-lg font-semibold pt-2">Trilha de auditoria</h2>
            <div className="space-y-1">
              {calls.map((c) => (
                <div key={c.id} className="text-xs border-t border-nexia-border py-1" data-testid="auditoria-item">
                  <span className="text-nexia-muted">{new Date(c.requested_at).toLocaleString("pt-BR")}</span>{" · "}
                  <span className="font-mono">{c.tool}</span> [{c.risk}] {c.status}{c.error_code ? ` (${c.error_code})` : ""}{" · "}
                  pedido por {c.requested_by.type} {c.requested_by.id}{c.decided_by ? ` · decidido por ${c.decided_by.type} ${c.decided_by.id}` : ""}
                  {c.input_summary && <div className="text-nexia-muted">{c.input_summary}{c.output_summary ? ` → ${c.output_summary}` : ""}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
