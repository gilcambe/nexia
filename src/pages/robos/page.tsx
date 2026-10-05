import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// NEXIA AI — ADR-AUTO-01: Robôs NEXIA. Um robô é um pedido ao Orchestrator que roda sozinho numa
// agenda (Cron do Cloudflare + GitHub Actions, de graça, com o computador desligado). Cada rodada é
// uma execução comum: autonomia do projeto, aprovações em /aprovacoes e deploy de produção só com aprovação.

interface Me { uid: string; role: string; tenantSlug: string | null; canUseVault: boolean }
interface Project { id: string; name: string; autonomy_level?: number }
type Kind = "hourly" | "interval" | "daily" | "weekly";
interface Schedule { kind: Kind; minute?: number; time?: string; days?: number[]; every_hours?: number }
interface Run { at: string; trigger: "schedule" | "manual"; status: string; execution_id?: string; error_code?: string }
interface Robot {
  id: string; version: number; project_id: string; name: string; task: string; template?: string; schedule: Schedule;
  timezone: string; enabled: boolean; next_run_at?: string; last_run_at?: string; recent_runs?: Run[]; owner: { type: string; id: string };
}
interface Template { id: string; name: string; description: string; task: string; schedule: Schedule }
interface Form { id?: string; version?: number; name: string; project_id: string; task: string; template?: string; schedule: Schedule; timezone: string; enabled: boolean }

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const EVERY = [2, 3, 4, 6, 8, 12];
const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Rio_Branco", "America/Noronha", "UTC"];
const STATUS_COLOR: Record<string, string> = {
  succeeded: "text-green-400", failed: "text-red-400", error: "text-red-400", cancelled: "text-red-400",
  waiting_approval: "text-yellow-300", needs_input: "text-yellow-300", running: "text-nexia-cyan", planned: "text-nexia-muted",
};
const STATUS_LABEL: Record<string, string> = {
  succeeded: "concluída", failed: "falhou", error: "erro", cancelled: "cancelada", waiting_approval: "aguardando aprovação",
  needs_input: "precisa de resposta", running: "rodando", planned: "na fila",
};
const empty = (projectId = ""): Form => ({ name: "", project_id: projectId, task: "", schedule: { kind: "daily", time: "08:00" }, timezone: "America/Sao_Paulo", enabled: true });

function describe(s: Schedule): string {
  const mm = String(s.minute ?? 0).padStart(2, "0");
  if (s.kind === "hourly") return `A cada hora (minuto ${mm})`;
  if (s.kind === "interval") return `A cada ${s.every_hours} horas (minuto ${mm})`;
  if (s.kind === "daily") return `Todo dia às ${s.time}`;
  return `${[...(s.days || [])].sort().map((d) => DAYS[d]).join(", ")} às ${s.time}`;
}
// Só os campos do tipo escolhido (o servidor rejeita campo de outro tipo).
function cleanSchedule(s: Schedule): Schedule {
  if (s.kind === "hourly") return { kind: "hourly", minute: s.minute ?? 0 };
  if (s.kind === "interval") return { kind: "interval", every_hours: s.every_hours || 6, minute: s.minute ?? 0 };
  if (s.kind === "daily") return { kind: "daily", time: s.time || "08:00" };
  return { kind: "weekly", time: s.time || "08:00", days: [...(s.days?.length ? s.days : [1])].sort() };
}
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export default function RobosPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [live, setLive] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Form | null>(null);
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
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body as T;
  }, [getToken]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await call<Me>("/me");
      setMe(m);
      if (!m.canUseVault) return;
      const [p, r, t] = await Promise.all([call<{ items: Project[] }>("/projects"), call<{ items: Robot[] }>("/robots"), call<{ items: Template[] }>("/robots/templates")]);
      setProjects(p.items);
      setRobots(r.items);
      setTemplates(t.items);
      // Status atual das execuções das rodadas (uma consulta por projeto com robô).
      const pids = [...new Set(r.items.filter((x) => x.recent_runs?.length).map((x) => x.project_id))];
      const lists = await Promise.all(pids.map((pid) => call<{ items: { id: string; status: string }[] }>(`/executions?project_id=${encodeURIComponent(pid)}`).catch(() => ({ items: [] }))));
      setLive(Object.fromEntries(lists.flatMap((l) => l.items.map((x) => [x.id, x.status]))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [call]);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const save = useCallback(async () => {
    if (!form) return;
    setBusy("form"); setError(null); setNotice(null);
    const body = { name: form.name.trim(), project_id: form.project_id, task: form.task.trim(), schedule: cleanSchedule(form.schedule),
      timezone: form.timezone, enabled: form.enabled, ...(form.template && !form.id ? { template: form.template } : {}) };
    try {
      if (form.id) await call(`/robots/${form.id}`, { method: "PATCH", body: JSON.stringify(body), headers: { "If-Match": `"v${form.version}"` } });
      else await call("/robots", { method: "POST", body: JSON.stringify(body) });
      setNotice(form.id ? "Robô atualizado." : "Robô criado. Ele roda sozinho no horário marcado.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setBusy(null); }
  }, [call, form, load]);

  const toggle = useCallback(async (r: Robot) => {
    setBusy(r.id); setError(null);
    try { await call(`/robots/${r.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !r.enabled }), headers: { "If-Match": `"v${r.version}"` } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(null); }
  }, [call, load]);

  const runNow = useCallback(async (r: Robot) => {
    setBusy(r.id); setError(null); setNotice(null);
    try {
      const x = await call<{ execution?: { id: string }; status?: string; job?: { queued: boolean; error?: string } }>(`/robots/${r.id}/run`, { method: "POST" });
      if (!x.execution) setError(`${r.name}: não foi possível iniciar (${x.status || "erro"}).`);
      else if (x.job && !x.job.queued) setError(`${r.name}: execução registrada, mas a fila recusou (${x.job.error || "erro"}). A retomada automática tenta de novo.`);
      else setNotice(`${r.name}: rodada iniciada.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(null); }
  }, [call, load]);

  const remove = useCallback(async (r: Robot) => {
    if (!window.confirm(`Excluir o robô "${r.name}"? Ele para de rodar.`)) return;
    setBusy(r.id); setError(null);
    try { await call(`/robots/${r.id}`, { method: "DELETE", headers: { "If-Match": `"v${r.version}"` } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(null); }
  }, [call, load]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;
  const setSchedule = (patch: Partial<Schedule>) => form && setForm({ ...form, schedule: { ...form.schedule, ...patch } });
  const input = "w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/projetos")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Projetos
            </button>
            <h1 className="text-2xl font-bold" data-testid="robos-title">Robôs NEXIA</h1>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate("/execucoes")} className="text-sm text-nexia-cyan cursor-pointer">Execuções</button>
            <button onClick={() => navigate("/aprovacoes")} className="text-sm text-nexia-cyan cursor-pointer">Aprovações</button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted" data-testid="robos-login">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> para criar e acompanhar robôs.
          </p>
        )}
        {me && !me.canUseVault && <p className="text-nexia-muted">Disponível só para master ou admin do tenant.</p>}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
        {notice && <p className="text-nexia-cyan text-sm" role="status">{notice}</p>}

        {me?.canUseVault && (
          <p className="text-sm text-nexia-muted">
            Configure uma vez e o robô roda sozinho, 24 h, mesmo com o computador desligado. Ele só faz o que a autonomia do projeto permite;
            o que for arriscado espera sua aprovação em Aprovações.
          </p>
        )}

        {me?.canUseVault && !form && (
          <button onClick={() => setForm(empty(projects[0]?.id))} disabled={!projects.length} data-testid="robo-novo"
            className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">
            <i className="ri-robot-2-line" /> Novo robô
          </button>
        )}

        {form && (
          <div className="rounded-xl border border-nexia-border bg-nexia-surface p-4 space-y-3 text-sm" data-testid="robo-form">
            <h2 className="font-bold">{form.id ? "Editar robô" : "Novo robô"}</h2>
            {!form.id && templates.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-nexia-muted">Comece de um modelo (só preenche o formulário):</div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button key={t.id} title={t.description} onClick={() => setForm({ ...form, name: t.name, task: t.task, schedule: t.schedule, template: t.id })}
                      className={`px-3 py-1 text-xs border rounded-lg cursor-pointer ${form.template === t.id ? "border-nexia-cyan text-nexia-cyan" : "border-nexia-border"}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="block space-y-1"><span className="text-xs text-nexia-muted">Nome</span>
              <input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Ex.: Vigia do site" />
            </label>
            <label className="block space-y-1"><span className="text-xs text-nexia-muted">Projeto</span>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={input}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.autonomy_level !== undefined ? ` · autonomia ${p.autonomy_level}` : ""}</option>)}
              </select>
            </label>
            <label className="block space-y-1"><span className="text-xs text-nexia-muted">O que o robô deve fazer (em português, como você pediria)</span>
              <textarea value={form.task} rows={4} maxLength={4000} onChange={(e) => setForm({ ...form, task: e.target.value })} className={input}
                placeholder="Ex.: Verifique se o site está no ar e se os links funcionam; se algo quebrou, abra um PR com a correção." />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs text-nexia-muted">Quando</span>
                <select value={form.schedule.kind} onChange={(e) => setForm({ ...form, schedule: cleanSchedule({ ...form.schedule, kind: e.target.value as Kind }) })} className={input} aria-label="Agenda">
                  <option value="hourly">A cada hora</option>
                  <option value="interval">A cada N horas</option>
                  <option value="daily">Todo dia às HH:MM</option>
                  <option value="weekly">Dias da semana às HH:MM</option>
                </select>
              </label>
              {(form.schedule.kind === "daily" || form.schedule.kind === "weekly") && (
                <label className="block space-y-1"><span className="text-xs text-nexia-muted">Horário</span>
                  <input type="time" value={form.schedule.time || "08:00"} onChange={(e) => setSchedule({ time: e.target.value })} className={input} />
                </label>
              )}
              {form.schedule.kind === "interval" && (
                <label className="block space-y-1"><span className="text-xs text-nexia-muted">A cada (contando da meia-noite)</span>
                  <select value={form.schedule.every_hours || 6} onChange={(e) => setSchedule({ every_hours: Number(e.target.value) })} className={input}>
                    {EVERY.map((n) => <option key={n} value={n}>{n} horas</option>)}
                  </select>
                </label>
              )}
              {(form.schedule.kind === "hourly" || form.schedule.kind === "interval") && (
                <label className="block space-y-1"><span className="text-xs text-nexia-muted">No minuto</span>
                  <input type="number" min={0} max={59} value={form.schedule.minute ?? 0}
                    onChange={(e) => setSchedule({ minute: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })} className={input} />
                </label>
              )}
            </div>
            {form.schedule.kind === "weekly" && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
                {DAYS.map((d, i) => {
                  const on = (form.schedule.days || []).includes(i);
                  return (
                    <button key={d} onClick={() => setSchedule({ days: on ? (form.schedule.days || []).filter((x) => x !== i) : [...(form.schedule.days || []), i] })}
                      aria-pressed={on} className={`px-3 py-1 text-xs border rounded-lg cursor-pointer ${on ? "border-nexia-cyan text-nexia-cyan" : "border-nexia-border text-nexia-muted"}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <label className="block space-y-1"><span className="text-xs text-nexia-muted">Fuso horário</span>
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={input}>
                  {TIMEZONES.map((z) => <option key={z} value={z}>{z === "America/Sao_Paulo" ? "Brasília (America/Sao_Paulo)" : z}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 py-2 cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                <span>Ligado</span>
              </label>
            </div>
            <div className="text-xs text-nexia-muted">{describe(cleanSchedule(form.schedule))} · horário de {form.timezone}</div>
            <div className="flex gap-2">
              <button onClick={save} disabled={busy === "form" || !form.name.trim() || !form.task.trim() || !form.project_id || (form.schedule.kind === "weekly" && !form.schedule.days?.length)}
                className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">
                {busy === "form" ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm border border-nexia-border rounded-lg cursor-pointer">Cancelar</button>
            </div>
          </div>
        )}

        {me?.canUseVault && robots.length === 0 && !form && <p className="text-sm text-nexia-muted" data-testid="robos-vazio">Nenhum robô ainda.</p>}
        {robots.map((r) => (
          <div key={r.id} className="rounded-xl border border-nexia-border bg-nexia-surface p-4 space-y-2 text-sm" data-testid="robo">
            <div className="flex flex-wrap items-center gap-3">
              <i className="ri-robot-2-line text-nexia-cyan" />
              <span className="font-medium">{r.name}</span>
              <span className={`text-xs font-bold ${r.enabled ? "text-green-400" : "text-nexia-muted"}`}>{r.enabled ? "ligado" : "desligado"}</span>
              <span className="text-xs text-nexia-muted">{projectName(r.project_id)}</span>
            </div>
            <div className="text-nexia-muted whitespace-pre-wrap">{r.task}</div>
            <div className="text-xs text-nexia-muted">
              {describe(r.schedule)} ({r.timezone}) · próxima: {r.enabled ? fmt(r.next_run_at) : "—"} · última: {fmt(r.last_run_at)}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => runNow(r)} disabled={busy === r.id}
                className="px-3 py-1 text-xs font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">Rodar agora</button>
              <button onClick={() => toggle(r)} disabled={busy === r.id} className="px-3 py-1 text-xs border border-nexia-border rounded-lg disabled:opacity-50 cursor-pointer">
                {r.enabled ? "Desligar" : "Ligar"}
              </button>
              <button onClick={() => setForm({ id: r.id, version: r.version, name: r.name, project_id: r.project_id, task: r.task, schedule: r.schedule, timezone: r.timezone, enabled: r.enabled })}
                className="px-3 py-1 text-xs border border-nexia-border rounded-lg cursor-pointer">Editar</button>
              <button onClick={() => remove(r)} disabled={busy === r.id} className="px-3 py-1 text-xs border border-nexia-border rounded-lg text-red-400 disabled:opacity-50 cursor-pointer">Excluir</button>
            </div>
            {(r.recent_runs || []).length > 0 && (
              <ul className="pt-1 space-y-1">
                {(r.recent_runs || []).map((x, i) => {
                  const st = (x.execution_id && live[x.execution_id]) || x.status;
                  return (
                    <li key={`${x.at}-${i}`} className="text-xs flex flex-wrap gap-2">
                      <span className="text-nexia-muted w-32 shrink-0">{fmt(x.at)}</span>
                      <span className="text-nexia-muted w-16 shrink-0">{x.trigger === "manual" ? "manual" : "agenda"}</span>
                      <span className={STATUS_COLOR[st] || ""}>{STATUS_LABEL[st] || st}</span>
                      {x.execution_id && (
                        <button onClick={() => navigate(`/execucoes?projeto=${encodeURIComponent(r.project_id)}&abrir=${encodeURIComponent(x.execution_id!)}`)}
                          className="text-nexia-cyan underline cursor-pointer">ver execução</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
