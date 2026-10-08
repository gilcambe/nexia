import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// NEXIA Leads: contatos que chegaram pelos sites e apps (formulário nexia-leads.js e Site Kit).
// Só master ou admin. Status simples para acompanhar até virar cliente; apagar = pedido LGPD.

interface Lead {
  id: string; nome: string; whatsapp?: string; email?: string; mensagem?: string; produto: string; site?: string;
  pagina?: string; utm?: Record<string, string>; status: string; nota?: string; criado_em: string;
}
const STATUS: { id: string; label: string; color: string }[] = [
  { id: "novo", label: "Novo", color: "text-nexia-cyan" },
  { id: "conversando", label: "Conversando", color: "text-yellow-300" },
  { id: "testando", label: "Testando", color: "text-purple-300" },
  { id: "cliente", label: "Cliente", color: "text-green-400" },
  { id: "perdido", label: "Perdido", color: "text-red-400" },
];
const wa = (n: string) => `https://wa.me/${n.length <= 11 ? "55" + n : n}`;
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function LeadsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, getToken } = useAuth();
  const [items, setItems] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todos");
  const [produto, setProduto] = useState("todos");

  const call = useCallback(async <T,>(init: RequestInit = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath("/leads"), { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body as T;
  }, [getToken]);

  const load = useCallback(async () => {
    setError(null);
    try { setItems((await call<{ items: Lead[] }>()).items); } catch (e) { setError((e as Error).message); }
  }, [call]);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const mudar = async (id: string, patch: { status?: string; nota?: string }) => {
    try {
      await call({ method: "PATCH", body: JSON.stringify({ id, ...patch }) });
      setItems((xs) => (xs || []).map((l) => (l.id === id ? { ...l, ...patch } : l)));
    } catch (e) { setError((e as Error).message); }
  };
  const apagar = async (l: Lead) => {
    if (!window.confirm(`Apagar o contato de ${l.nome}? Não dá para desfazer.`)) return;
    try { await call({ method: "DELETE", body: JSON.stringify({ id: l.id }) }); setItems((xs) => (xs || []).filter((x) => x.id !== l.id)); }
    catch (e) { setError((e as Error).message); }
  };

  const produtos = useMemo(() => [...new Set((items || []).map((l) => l.produto))].sort(), [items]);
  const visiveis = (items || []).filter((l) => (filtro === "todos" || l.status === filtro) && (produto === "todos" || l.produto === produto));
  const conta = (s: string) => (items || []).filter((l) => l.status === s).length;
  const origens = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of items || []) { const k = l.utm?.source || "direto"; m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/projetos")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Projetos
            </button>
            <h1 className="text-2xl font-bold" data-testid="leads-title">Leads</h1>
          </div>
          <button onClick={load} className="text-sm text-nexia-cyan cursor-pointer">Atualizar</button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> para ver os leads.
          </p>
        )}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        {items && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {STATUS.map((s) => (
                <button key={s.id} onClick={() => setFiltro(filtro === s.id ? "todos" : s.id)}
                  className={`rounded-xl border p-3 text-left cursor-pointer ${filtro === s.id ? "border-nexia-cyan" : "border-nexia-border"} bg-nexia-surface`}>
                  <div className="text-xs text-nexia-muted">{s.label}</div>
                  <div className={`text-xl font-bold ${s.color}`}>{conta(s.id)}</div>
                </button>
              ))}
            </div>
            {origens.length > 0 && (
              <p className="text-xs text-nexia-muted">De onde vieram: {origens.map(([k, v]) => `${k} ${v}`).join(" · ")}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              <select value={produto} onChange={(e) => setProduto(e.target.value)} aria-label="Produto"
                className="bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2">
                <option value="todos">Todos os produtos</option>
                {produtos.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {filtro !== "todos" && <button onClick={() => setFiltro("todos")} className="text-nexia-cyan cursor-pointer">Mostrar todos</button>}
            </div>

            {visiveis.length === 0 && (
              <p className="text-nexia-muted text-sm">
                Nenhum lead ainda. Para receber, coloque o formulário em qualquer página:{" "}
                <code className="text-xs break-all">{`<div data-nexia-leads data-produto="body-coach"></div><script src="${typeof window !== "undefined" ? window.location.origin : ""}/core/nexia-leads.js" defer></script>`}</code>
              </p>
            )}

            <div className="space-y-2">
              {visiveis.map((l) => (
                <div key={l.id} className="rounded-xl border border-nexia-border bg-nexia-surface p-4 text-sm space-y-2" data-testid="lead-item">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{l.nome} <span className="text-xs text-nexia-muted font-normal">· {l.produto}{l.site ? ` · ${l.site}` : ""} · {fmt(l.criado_em)}</span></div>
                    <select value={l.status} onChange={(e) => mudar(l.id, { status: e.target.value })} aria-label={`Status de ${l.nome}`}
                      className="bg-[#0a0a0f] border border-nexia-border rounded-lg px-2 py-1 text-xs">
                      {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {l.whatsapp && <a className="text-green-400 underline" href={wa(l.whatsapp)} target="_blank" rel="noopener noreferrer"><i className="ri-whatsapp-line" /> WhatsApp {l.whatsapp}</a>}
                    {l.email && <a className="text-nexia-cyan underline" href={`mailto:${l.email}`}>{l.email}</a>}
                    {l.utm && Object.keys(l.utm).length > 0 && <span className="text-nexia-muted">origem: {Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(" ")}</span>}
                  </div>
                  {l.mensagem && <p className="text-nexia-muted whitespace-pre-wrap">{l.mensagem}</p>}
                  <div className="flex gap-2">
                    <input defaultValue={l.nota || ""} placeholder="Anotação (ex.: ligar sexta)" aria-label={`Anotação de ${l.nome}`} maxLength={1000}
                      onBlur={(e) => { if (e.target.value !== (l.nota || "")) mudar(l.id, { nota: e.target.value }); }}
                      className="flex-1 bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-1 text-xs" />
                    <button onClick={() => apagar(l)} className="text-xs text-red-400 underline cursor-pointer">Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
