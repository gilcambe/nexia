import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// Suporte NEXIA: o administrador (master) entra no painel de qualquer cliente sem a senha da dona,
// para ajudar quando ela precisar. Cada entrada abre uma sessão de 8 h e fica registrada na conta do cliente.

interface Agenda { site: string; nome: string; painel: string; leilao: boolean }

export default function ClientesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, getToken } = useAuth();
  const [agendas, setAgendas] = useState<Agenda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const call = useCallback(async <T,>(init: RequestInit & { query?: string } = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath("/agenda") + (init.query || ""), { ...init, headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body as T;
  }, [getToken]);

  const load = useCallback(async () => {
    setError(null);
    try { setAgendas((await call<{ agendas: Agenda[] }>({ query: "?suporte=lista" })).agendas); } catch (e) { setError((e as Error).message); }
  }, [call]);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const entrar = async (a: Agenda) => {
    // Abre a aba já (o celular bloqueia abas abertas depois de esperar a rede) e manda o endereço quando chegar.
    const aba = window.open("about:blank", "_blank");
    setAbrindo(a.site); setError(null);
    try {
      const r = await call<{ token: string; painel: string }>({ method: "POST", body: JSON.stringify({ acao: "suporte", site: a.site }) });
      const url = `${r.painel}#suporte=${r.token}`;
      if (aba) aba.location.href = url; else window.location.href = url;
    } catch (e) { aba?.close(); setError((e as Error).message); }
    finally { setAbrindo(null); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/projetos")} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Projetos
            </button>
            <h1 className="text-2xl font-bold" data-testid="clientes-title">Clientes</h1>
          </div>
          <button onClick={load} className="text-sm text-nexia-cyan cursor-pointer">Atualizar</button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-nexia-muted">
          Entre no painel de qualquer cliente para dar suporte, sem pedir a senha. Cada entrada vale 8 horas e fica registrada na conta do cliente.
        </p>
        {!authLoading && !user && (
          <p className="text-nexia-muted">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> como administrador.
          </p>
        )}
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
        {agendas && agendas.length === 0 && <p className="text-nexia-muted text-sm">Nenhum cliente com painel ainda.</p>}
        <div className="space-y-2">
          {(agendas || []).map((a) => (
            <div key={a.site} className="rounded-xl border border-nexia-border bg-nexia-surface p-4 text-sm flex flex-wrap items-center justify-between gap-3" data-testid="cliente-item">
              <div>
                <div className="font-semibold">{a.nome}{a.leilao && <span className="ml-2 text-xs text-nexia-muted font-normal">com Central de Leilões (botão "Leilões" no painel)</span>}</div>
                <a className="text-xs text-nexia-muted underline break-all" href={a.painel.replace(/agenda\/?$/, "")} target="_blank" rel="noopener noreferrer">{a.painel.replace(/agenda\/?$/, "")}</a>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => entrar(a)} disabled={abrindo === a.site}
                  className="rounded-lg bg-nexia-cyan/10 border border-nexia-cyan text-nexia-cyan px-3 py-2 cursor-pointer disabled:opacity-50" data-testid={`suporte-${a.site}`}>
                  {abrindo === a.site ? "Abrindo…" : "Entrar no painel"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
