import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// NEXIA AI — Fase 3: lista clientes e projetos do Vault e mostra o snapshot
// mais recente de cada projeto. Permite cadastrar cliente/projeto e rodar o onboarding
// (lê o repositório no GitHub e grava no Vault). No Worker grátis o onboarding vai para a
// fila do GitHub Actions (ADR-FREE-02): a API responde 202 e a tela espera o snapshot.

const PROJECT_TYPES = ["website", "web_app", "landing_page", "saas", "api", "mobile_app", "automation", "library", "other"];
const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// ADR-CLONE-01: o que pode ser copiado ao duplicar um tenant (segredos, pessoas, execuções e cobrança nunca vão).
const DUP_OPTIONS: [string, string][] = [["settings", "Ajustes do tenant"], ["clients", "Clientes"], ["projects", "Projetos"], ["repositories", "Repositórios"],
  ["environments", "Ambientes"], ["tool-policies", "Políticas de ferramentas"], ["robots", "Robôs"]];
interface DupResult { dry_run: boolean; queued?: boolean; target: string; name: string; include: string[]; counts: Record<string, number>;
  created?: Record<string, number>; omitted_fields: string[]; never_copied: string[]; job?: { queued: boolean } }

interface Me { uid: string; role: string; tenantSlug: string | null; canUseVault: boolean }
interface Client { id: string; name: string; slug: string; status: string }
interface Project { id: string; client_id: string; name: string; slug: string; status: string; type: string; autonomy_level: number; primary_repository_id?: string }
interface Repo { id: string; owner: string; repo: string; default_branch: string; url: string }
interface Snapshot {
  id: string; generated_at: string; stack: string[]; frameworks: string[]; default_branch?: string;
  deploy_target?: string; firebase_project?: string; cloudflare_ref?: string; architecture?: string; patterns: string[];
  commands?: Record<string, string>; directory_structure: string[]; environment_ids: string[];
  open_task_ids: string[]; recent_error_ids: string[]; key_decision_ids: string[];
}

export default function ProjetosPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [newClient, setNewClient] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newType, setNewType] = useState("website");
  const [dupSource, setDupSource] = useState("");
  const [dupTarget, setDupTarget] = useState("");
  const [dupName, setDupName] = useState("");
  const [dupInclude, setDupInclude] = useState<string[]>(DUP_OPTIONS.map(([k]) => k));
  const [dupResult, setDupResult] = useState<DupResult | null>(null);

  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath(`/nexia${path}`), {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return { ...body, _status: res.status } as T;
  }, [getToken]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await call<Me>("/me");
      setMe(m);
      if (!m.canUseVault) return;
      const [c, p] = await Promise.all([call<{ items: Client[] }>("/clients"), call<{ items: Project[] }>("/projects")]);
      setClients(c.items);
      setProjects(p.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [call]);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const openProject = useCallback(async (id: string) => {
    setSelected(id);
    setSnapshot(null);
    setError(null);
    try {
      const r = await call<{ items: Repo[] }>(`/repos?project_id=${encodeURIComponent(id)}`);
      setRepos(r.items);
      if (r.items[0]) setRepoInput(`${r.items[0].owner}/${r.items[0].repo}`);
      const s = await call<{ record: Snapshot }>(`/projects/${id}/snapshot`).catch(() => null);
      setSnapshot(s ? s.record : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir projeto");
    }
  }, [call]);

  const onboard = useCallback(async () => {
    if (!selected) return;
    const [owner, repo] = repoInput.trim().split("/");
    if (!owner || !repo) { setError("Informe o repositório como dono/nome."); return; }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const before = await call<{ record: Snapshot }>(`/projects/${selected}/snapshot`).then((s) => s.record.generated_at).catch(() => "");
      const r = await call<{ _status: number; job?: { queued: boolean; error?: string } }>(`/projects/${selected}/onboard`, { method: "POST", body: JSON.stringify({ repository: { owner, repo } }) });
      if (r._status === 202) {
        // Fila do GitHub Actions: espera o snapshot novo (até ~5 min).
        setInfo("Onboarding enviado para a fila. Esperando o resultado (pode levar alguns minutos)...");
        for (let i = 0; i < 30; i++) {
          await sleep(10000);
          const s = await call<{ record: Snapshot }>(`/projects/${selected}/snapshot`).catch(() => null);
          if (s && s.record.generated_at !== before) { setInfo("Onboarding concluído."); break; }
          if (i === 29) setInfo("Ainda processando. Abra o projeto de novo daqui a pouco.");
        }
      }
      await openProject(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no onboarding");
    } finally {
      setBusy(false);
    }
  }, [call, openProject, repoInput, selected]);

  const createProject = useCallback(async () => {
    const cName = newClient.trim(), pName = newProject.trim();
    if (!cName || !pName || !slugify(cName) || !slugify(pName)) { setError("Informe o nome do cliente e do projeto."); return; }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let client = clients.find((c) => c.slug === slugify(cName) || c.name.toLowerCase() === cName.toLowerCase());
      if (!client) {
        const c = await call<{ record: Client }>("/clients", { method: "POST", body: JSON.stringify({ name: cName, slug: slugify(cName), status: "active" }) });
        client = c.record;
      }
      const p = await call<{ record: Project }>("/projects", { method: "POST", body: JSON.stringify({ client_id: client.id, name: pName, slug: slugify(pName), type: newType, status: "active" }) });
      setNewClient("");
      setNewProject("");
      setInfo(`Projeto "${p.record.name}" criado. Agora informe o repositório e rode o onboarding.`);
      await load();
      await openProject(p.record.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar o projeto");
    } finally {
      setBusy(false);
    }
  }, [call, clients, load, newClient, newProject, newType, openProject]);

  const duplicate = useCallback(async (dryRun: boolean) => {
    const source = (dupSource || me?.tenantSlug || "").trim();
    if (!source || !dupTarget.trim()) { setError("Informe o tenant de origem e o id do tenant novo."); return; }
    if (!dryRun && !window.confirm(`Duplicar a configuração de "${source}" para "${dupTarget.trim()}"? Segredos, usuários, execuções e cobrança não são copiados.`)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await call<DupResult>(`/tenants/${encodeURIComponent(source)}/duplicate`, { method: "POST",
        body: JSON.stringify({ new_tenant: dupTarget.trim(), name: dupName.trim() || undefined, include: dupInclude, dry_run: dryRun }) });
      setDupResult(r);
      setInfo(dryRun ? "Prévia pronta: nada foi gravado." : r.queued ? "Tenant criado; a cópia está na fila e termina em alguns minutos." : `Tenant "${r.target}" criado com a configuração copiada.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao duplicar o tenant");
    } finally {
      setBusy(false);
    }
  }, [call, dupInclude, dupName, dupSource, dupTarget, me]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name || id;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Voltar
            </button>
            <h1 className="text-2xl font-bold" data-testid="projetos-title">Projetos</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/execucoes")} className="text-sm text-nexia-cyan underline cursor-pointer" data-testid="link-execucoes">Execuções</button>
            <button onClick={() => navigate("/aprovacoes")} className="text-sm text-nexia-cyan underline cursor-pointer" data-testid="link-aprovacoes">Aprovações</button>
            <button onClick={() => navigate("/auditoria")} className="text-sm text-nexia-cyan underline cursor-pointer" data-testid="link-auditoria">Auditoria</button>
            {me && <span className="text-xs text-nexia-muted">{me.role} · {me.tenantSlug || "sem tenant"}</span>}
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-5">
        {!authLoading && !user && (
          <p className="text-nexia-muted" data-testid="projetos-login">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> para ver os projetos.
          </p>
        )}
        {me && !me.canUseVault && <p className="text-nexia-muted">Disponível só para master ou admin do tenant.</p>}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
        {info && <p className="text-nexia-cyan text-sm" role="status" data-testid="projetos-info">{info}</p>}

        {me?.role === "master" && (
          <details className="rounded-xl border border-nexia-border bg-nexia-surface p-4 text-sm" data-testid="duplicar-tenant">
            <summary className="cursor-pointer font-medium">Duplicar tenant (só master)</summary>
            <p className="text-xs text-nexia-muted mt-2">
              Copia a configuração para um tenant novo, com ids novos. Nunca copia segredos, usuários, execuções, auditoria, cobrança ou dados pessoais.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <input value={dupSource} onChange={(e) => setDupSource(e.target.value)} placeholder={`Origem (ex.: ${me.tenantSlug || "nexia"})`}
                className="px-3 py-2 rounded-lg bg-[#0a0a0f] border border-nexia-border text-sm" aria-label="Tenant de origem" />
              <input value={dupTarget} onChange={(e) => setDupTarget(e.target.value.toLowerCase())} placeholder="Id do tenant novo (ex.: ces-2027)"
                className="px-3 py-2 rounded-lg bg-[#0a0a0f] border border-nexia-border text-sm" aria-label="Id do tenant novo" />
              <input value={dupName} onChange={(e) => setDupName(e.target.value)} placeholder="Nome (opcional)"
                className="px-3 py-2 rounded-lg bg-[#0a0a0f] border border-nexia-border text-sm" aria-label="Nome do tenant novo" />
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {DUP_OPTIONS.map(([k, label]) => (
                <label key={k} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={dupInclude.includes(k)}
                    onChange={(e) => setDupInclude((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => duplicate(true)} disabled={busy}
                className="px-4 py-2 text-sm rounded-lg border border-nexia-border disabled:opacity-50 cursor-pointer">Prévia</button>
              <button onClick={() => duplicate(false)} disabled={busy}
                className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">Duplicar</button>
            </div>
            {dupResult && (
              <div className="mt-3 space-y-1 text-xs" data-testid="duplicar-resultado">
                <Row label={dupResult.dry_run ? "Seria criado" : "Tenant novo"} value={`${dupResult.target} (${dupResult.name})`} />
                <Row label={dupResult.created ? "Copiados" : "A copiar"} value={Object.entries(dupResult.created || dupResult.counts).map(([k, v]) => `${k}: ${v}`).join(" · ")} />
                <Row label="Campos deixados de fora" value={dupResult.omitted_fields.slice(0, 12).join(", ") || "nenhum"} />
                <Row label="Nunca copiado" value={dupResult.never_copied.join("; ")} />
              </div>
            )}
          </details>
        )}

        {me?.canUseVault && (
          <div className="grid md:grid-cols-3 gap-5">
            <section className="md:col-span-1 space-y-2">
              <h2 className="text-sm uppercase text-nexia-muted">Clientes e projetos</h2>
              <div className="p-3 rounded-lg border border-nexia-border bg-nexia-surface space-y-2" data-testid="novo-projeto">
                <div className="text-xs text-nexia-muted">Novo projeto</div>
                <input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Cliente (ex.: CES)" list="nexia-clients"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-nexia-border text-sm" />
                <datalist id="nexia-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                <input value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="Projeto (ex.: Site institucional)"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-nexia-border text-sm" />
                <select value={newType} onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-nexia-border text-sm">
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={createProject} disabled={busy}
                  className="w-full px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">
                  Criar projeto
                </button>
              </div>
              {projects.length === 0 && <p className="text-sm text-nexia-muted">Nenhum projeto cadastrado.</p>}
              {projects.map((p) => (
                <button key={p.id} onClick={() => openProject(p.id)}
                  className={`w-full text-left p-3 rounded-lg border cursor-pointer ${selected === p.id ? "border-nexia-cyan" : "border-nexia-border"} bg-nexia-surface`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-nexia-muted">{clientName(p.client_id)} · {p.type} · {p.status} · autonomia {p.autonomy_level}</div>
                </button>
              ))}
            </section>

            <section className="md:col-span-2 space-y-4">
              {!selected && <p className="text-sm text-nexia-muted">Selecione um projeto.</p>}
              {selected && (
                <>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="dono/repositório"
                      className="px-3 py-2 rounded-lg bg-nexia-surface border border-nexia-border text-sm" />
                    <button onClick={onboard} disabled={busy}
                      className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg disabled:opacity-50 cursor-pointer">
                      {busy ? "Processando..." : "Rodar onboarding (leitura)"}
                    </button>
                    {repos.map((r) => (
                      <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="text-xs text-nexia-cyan underline">
                        {r.owner}/{r.repo} ({r.default_branch})
                      </a>
                    ))}
                  </div>
                  {!snapshot && <p className="text-sm text-nexia-muted">Sem snapshot ainda.</p>}
                  {snapshot && (
                    <div className="rounded-xl border border-nexia-border bg-nexia-surface p-4 space-y-3 text-sm" data-testid="snapshot">
                      <div className="text-xs text-nexia-muted">Snapshot de {new Date(snapshot.generated_at).toLocaleString("pt-BR")}</div>
                      {snapshot.architecture && <p>{snapshot.architecture}</p>}
                      <Row label="Stack" value={snapshot.stack.join(", ")} />
                      <Row label="Frameworks" value={snapshot.frameworks.join(", ")} />
                      <Row label="Branch padrão" value={snapshot.default_branch} />
                      <Row label="Deploy" value={snapshot.deploy_target} />
                      <Row label="Firebase" value={snapshot.firebase_project} />
                      <Row label="Cloudflare" value={snapshot.cloudflare_ref} />
                      <Row label="Comandos" value={snapshot.commands ? Object.entries(snapshot.commands).map(([k, v]) => `${k}: ${v}`).join(" · ") : undefined} />
                      <Row label="Padrões" value={snapshot.patterns.join(", ")} />
                      <Row label="Ambientes" value={String(snapshot.environment_ids.length)} />
                      <Row label="Tarefas abertas / erros / decisões" value={`${snapshot.open_task_ids.length} / ${snapshot.recent_error_ids.length} / ${snapshot.key_decision_ids.length}`} />
                      <details>
                        <summary className="cursor-pointer text-nexia-muted">Estrutura ({snapshot.directory_structure.length})</summary>
                        <ul className="mt-2 text-xs font-mono">{snapshot.directory_structure.map((d) => <li key={d}>{d}</li>)}</ul>
                      </details>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="w-48 shrink-0 text-nexia-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
