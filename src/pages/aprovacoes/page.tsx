import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// NEXIA AI — Fase 6: fila de aprovações do Tool Gateway. Mostra as chamadas de
// ferramenta que o Policy Engine marcou como "requer confirmação" e permite aprovar
// (executa a ferramenta) ou rejeitar. O resumo da entrada vem do próprio registro
// no Vault; a entrada completa nunca chega ao navegador.

interface Me { uid: string; role: string; tenantSlug: string | null; canUseVault: boolean }
interface Project { id: string; name: string }
interface ToolCall {
  id: string; version: number; project_id: string; environment?: string; tool: string; risk: string;
  decision_reason: string; input_summary?: string; requested_by: { type: string; id: string }; requested_at: string;
}

const RISK_COLOR: Record<string, string> = { LOW: "text-green-400", MEDIUM: "text-yellow-300", HIGH: "text-orange-400", CRITICAL: "text-red-400" };

export default function AprovacoesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<ToolCall[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath(`/nexia${path}`), {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    // Resultado de aprovação com status de erro (ferramenta falhou, política proibiu) ainda traz o registro.
    if (!res.ok && !body.tool_call) throw new Error(body.error || `HTTP ${res.status}`);
    return body as T;
  }, [getToken]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await call<Me>("/me");
      setMe(m);
      if (!m.canUseVault) return;
      const [a, p] = await Promise.all([call<{ items: ToolCall[] }>("/approvals"), call<{ items: Project[] }>("/projects")]);
      setItems(a.items);
      setProjects(p.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [call]);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const act = useCallback(async (c: ToolCall, action: "approve" | "reject") => {
    setBusy(c.id);
    setError(null);
    setNotice(null);
    try {
      const r = await call<{ status: string; error?: { message: string }; reason?: string }>(`/approvals/${c.id}/${action}`, { method: "POST", headers: { "If-Match": `"v${c.version}"` } });
      const msg: Record<string, string> = { succeeded: "Executada com sucesso.", failed: `A ferramenta falhou: ${r.error?.message || "erro"}`, rejected: r.reason || "Rejeitada." };
      setNotice(`${c.tool}: ${msg[r.status] || r.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao decidir");
    } finally {
      setBusy(null);
    }
  }, [call, load]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/projetos")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Projetos
            </button>
            <h1 className="text-2xl font-bold" data-testid="aprovacoes-title">Aprovações pendentes</h1>
          </div>
          {me && <span className="text-xs text-nexia-muted">{me.role} · {me.tenantSlug || "sem tenant"}</span>}
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted" data-testid="aprovacoes-login">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> para ver a fila de aprovações.
          </p>
        )}
        {me && !me.canUseVault && <p className="text-nexia-muted">Disponível só para master ou admin do tenant.</p>}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
        {notice && <p className="text-nexia-cyan text-sm" role="status">{notice}</p>}

        {me?.canUseVault && items.length === 0 && <p className="text-sm text-nexia-muted" data-testid="aprovacoes-vazio">Nenhuma chamada aguardando aprovação.</p>}
        {me?.canUseVault && items.map((c) => (
          <div key={c.id} className="rounded-xl border border-nexia-border bg-nexia-surface p-4 space-y-2 text-sm" data-testid="aprovacao">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono font-medium">{c.tool}</span>
              <span className={`text-xs font-bold ${RISK_COLOR[c.risk] || ""}`}>{c.risk}</span>
              <span className="text-xs text-nexia-muted">{projectName(c.project_id)}{c.environment ? ` · ${c.environment}` : ""}</span>
            </div>
            {c.input_summary && <div className="text-nexia-muted">{c.input_summary}</div>}
            <div className="text-xs text-nexia-muted">{c.decision_reason}</div>
            <div className="text-xs text-nexia-muted">Pedido por {c.requested_by.type} {c.requested_by.id} em {new Date(c.requested_at).toLocaleString("pt-BR")}</div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => act(c, "approve")} disabled={busy === c.id}
                className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">
                {busy === c.id ? "Executando..." : "Aprovar e executar"}
              </button>
              <button onClick={() => act(c, "reject")} disabled={busy === c.id}
                className="px-4 py-2 text-sm border border-nexia-border rounded-lg disabled:opacity-50 cursor-pointer">
                Rejeitar
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
