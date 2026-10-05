import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// NEXIA AI — Fase 10: pedidos ao Orchestrator e acompanhamento das execuções.
// Mostra o plano (agente, passo, status), os gates de QA com evidência e o resultado.
// Nada aqui decide política: aprovações continuam em /aprovacoes.

interface Me { uid: string; role: string; tenantSlug: string | null; canUseVault: boolean }
interface Project { id: string; name: string; autonomy_level?: number }
interface Step { step: number; agent: string; goal: string; status: string; summary?: string; error_code?: string; model?: string }
interface Gate { gate: number; name: string; status: string; evidence?: string }
interface Execution {
  id: string; version: number; project_id: string; request_summary: string; intent: string; status: string;
  plan: Step[]; gates?: Gate[]; result_summary?: string; question?: string; error_code?: string;
  work_branch?: string; pull_request?: number; deployment_id?: string; started_at: string; finished_at?: string;
  usage?: { tool_calls: number; input_tokens: number; output_tokens: number; cost_usd_micros: number; cost_known: boolean };
}

const STATUS_COLOR: Record<string, string> = {
  succeeded: "text-green-400", passed: "text-green-400", done: "text-green-400", failed: "text-red-400",
  waiting_approval: "text-yellow-300", needs_input: "text-yellow-300", running: "text-nexia-cyan", pending: "text-nexia-muted",
};
const ACTIVE = ["planned", "running"];

export default function ExecucoesPage() {
  const navigate = useNavigate();
  // Link dos Robôs NEXIA: ?projeto=<id>&abrir=<execução> já abre a execução certa.
  const [search] = useSearchParams();
  const { user, loading: authLoading, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<Execution[]>([]);
  const [open, setOpen] = useState<string | null>(search.get("abrir"));
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath(`/nexia${path}`), {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body as T;
  }, [getToken]);

  const loadList = useCallback(async (pid: string) => {
    if (!pid) return;
    const r = await call<{ items: Execution[] }>(`/executions?project_id=${encodeURIComponent(pid)}`);
    setItems(r.items.sort((a, b) => b.started_at.localeCompare(a.started_at)));
  }, [call]);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const m = await call<Me>("/me");
        setMe(m);
        if (!m.canUseVault) return;
        const p = await call<{ items: Project[] }>("/projects");
        setProjects(p.items);
        const wanted = search.get("projeto");
        const pick = p.items.find((x) => x.id === wanted) || p.items[0];
        if (pick) setProjectId(pick.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
    })();
  }, [authLoading, user, call, search]);

  useEffect(() => { loadList(projectId).catch((e) => setError(e.message)); }, [projectId, loadList]);

  // Enquanto houver execução ativa, atualiza a lista a cada 5 s.
  useEffect(() => {
    if (!items.some((x) => ACTIVE.includes(x.status))) return;
    const t = setInterval(() => loadList(projectId).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [items, projectId, loadList]);

  const submit = useCallback(async () => {
    setBusy(true); setError(null); setQuestion(null);
    try {
      const r = await call<{ status?: string; question?: string; execution?: Execution; job?: { queued: boolean; error?: string } }>("/executions", {
        method: "POST", body: JSON.stringify({ message, project_id: projectId || undefined }),
      });
      // ADR-FREE-02: no Worker grátis a execução roda na fila do GitHub Actions.
      if (r.job && !r.job.queued) setError(`Execução registrada, mas a fila recusou (${r.job.error || "erro"}). A retomada automática tenta de novo.`);
      if (r.execution) { setMessage(""); setOpen(r.execution.id); await loadList(r.execution.project_id); }
      else setQuestion(r.question || "Preciso de mais detalhes.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar");
    } finally { setBusy(false); }
  }, [call, message, projectId, loadList]);

  const action = useCallback(async (id: string, what: "refresh" | "resume") => {
    setError(null);
    try { await call(`/executions/${id}/${what}`, { method: "POST" }); await loadList(projectId); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }, [call, loadList, projectId]);

  // Fase 11: retoma execuções paradas há mais de 10 min (ex.: o servidor reiniciou no meio).
  const sweep = useCallback(async () => {
    setError(null);
    try {
      const r = await call<{ items: { id: string }[]; job?: { queued: boolean; error?: string } }>("/executions/sweep", { method: "POST" });
      if (r.job) setQuestion(r.job.queued ? "Retomada enviada para a fila. A lista atualiza sozinha." : `A fila recusou a retomada (${r.job.error || "erro"}).`);
      else setQuestion(r.items.length ? `${r.items.length} execução(ões) retomada(s).` : "Nenhuma execução parada.");
      await loadList(projectId);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
  }, [call, loadList, projectId]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/projetos")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Projetos
            </button>
            <h1 className="text-2xl font-bold" data-testid="execucoes-title">Execuções</h1>
          </div>
          <div className="flex gap-4">
            {me?.canUseVault && <button onClick={sweep} className="text-sm text-nexia-muted hover:text-white cursor-pointer">Retomar paradas</button>}
            <button onClick={() => navigate("/aprovacoes")} className="text-sm text-nexia-cyan cursor-pointer">Aprovações</button>
            <button onClick={() => navigate("/auditoria")} className="text-sm text-nexia-cyan cursor-pointer">Auditoria</button>
            <button onClick={() => navigate("/robos")} className="text-sm text-nexia-cyan cursor-pointer">Robôs</button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted" data-testid="execucoes-login">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> para pedir e acompanhar execuções.
          </p>
        )}
        {me && !me.canUseVault && <p className="text-nexia-muted">Disponível só para master ou admin do tenant.</p>}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        {me?.canUseVault && (
          <div className="rounded-xl border border-nexia-border bg-nexia-surface p-4 space-y-3">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Projeto"
              className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.autonomy_level !== undefined ? ` · autonomia ${p.autonomy_level}` : ""}</option>)}
            </select>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={4000} aria-label="Pedido"
              placeholder="Ex.: Corrija o botão de enviar do formulário de contato"
              className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm" />
            {question && <p className="text-yellow-300 text-sm" role="status">{question}</p>}
            <button onClick={submit} disabled={busy || !message.trim()}
              className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">
              {busy ? "Enviando..." : "Enviar pedido"}
            </button>
          </div>
        )}

        {me?.canUseVault && items.length === 0 && <p className="text-sm text-nexia-muted">Nenhuma execução neste projeto.</p>}
        {items.map((x) => (
          <div key={x.id} className="rounded-xl border border-nexia-border bg-nexia-surface p-4 space-y-2 text-sm" data-testid="execucao">
            <button className="w-full text-left flex flex-wrap items-center gap-3 cursor-pointer" onClick={() => setOpen(open === x.id ? null : x.id)}>
              <span className={`text-xs font-bold ${STATUS_COLOR[x.status] || ""}`}>{x.status}</span>
              <span className="text-xs text-nexia-muted">{x.intent}</span>
              <span className="font-medium">{x.request_summary}</span>
            </button>
            {x.result_summary && <div className="text-nexia-muted whitespace-pre-wrap">{x.result_summary}</div>}
            {x.question && <div className="text-yellow-300">{x.question}</div>}
            {open === x.id && (
              <div className="space-y-3 pt-2">
                <div className="text-xs text-nexia-muted">
                  {[x.work_branch && `branch ${x.work_branch}`, x.pull_request && `PR #${x.pull_request}`, x.deployment_id && `deployment ${x.deployment_id}`, x.error_code && `erro ${x.error_code}`].filter(Boolean).join(" · ")}
                  {x.usage && ` · ${x.usage.tool_calls} ferramenta(s), ${x.usage.input_tokens + x.usage.output_tokens} tokens${x.usage.cost_known ? `, US$ ${(x.usage.cost_usd_micros / 1e6).toFixed(4)}` : ", custo desconhecido"}`}
                </div>
                <ol className="space-y-1">
                  {x.plan.map((s) => (
                    <li key={s.step} className="flex gap-2">
                      <span className={`text-xs w-28 shrink-0 ${STATUS_COLOR[s.status] || ""}`}>{s.status}</span>
                      <span className="text-xs w-20 shrink-0 text-nexia-muted">{s.agent}</span>
                      <span>{s.goal}{s.summary ? <span className="block text-xs text-nexia-muted whitespace-pre-wrap">{s.summary}</span> : null}</span>
                    </li>
                  ))}
                </ol>
                {x.gates && x.gates.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {x.gates.map((g) => (
                      <div key={g.gate} className="text-xs"><span className={STATUS_COLOR[g.status] || "text-nexia-muted"}>G{g.gate} {g.status}</span> · {g.name}{g.evidence ? ` (${g.evidence})` : ""}</div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  {x.status === "running" && <button onClick={() => action(x.id, "refresh")} className="px-3 py-1 text-xs border border-nexia-border rounded-lg cursor-pointer">Reavaliar gates</button>}
                  {x.status === "waiting_approval" && <button onClick={() => action(x.id, "resume")} className="px-3 py-1 text-xs border border-nexia-border rounded-lg cursor-pointer">Retomar após aprovação</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
