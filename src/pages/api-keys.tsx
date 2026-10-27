import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";
import ApiKeyForm from "@/components/ApiKeyForm";

interface ApiKey {
  id: string;
  nome: string;
  chave?: string;
  criado_em?: string;
}

const fmt = (iso?: string) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function ApiKeysPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const [items, setItems] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [abrirForm, setAbrirForm] = useState(false);

  const call = useCallback(async (init: RequestInit = {}, path = "/api-keys"): Promise<Response> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    return fetch(apiPath(path), {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  }, [getToken]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await call();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setItems(body.itens || body || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  const remover = async (id: string) => {
    if (!window.confirm("Remover esta chave de API? Essa ação não pode ser desfeita.")) return;
    setError(null);
    try {
      const res = await call({ method: "DELETE" }, `/api-keys?id=${encodeURIComponent(id)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSucesso("Chave removida com sucesso.");
      setItems((xs) => (xs || []).filter((x) => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const aoCriado = (id: string) => {
    setAbrirForm(false);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-sm text-nexia-muted hover:text-white cursor-pointer">
              <i className="ri-arrow-left-line" /> Voltar
            </button>
            <h1 className="text-2xl font-bold" data-testid="api-keys-title">Chaves de API</h1>
          </div>
          <button
            onClick={() => setAbrirForm(true)}
            className="bg-nexia-cyan text-black font-semibold px-4 py-2 rounded-lg hover:bg-nexia-cyan-dim transition"
          >
            Nova chave
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted">
            Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => window.location.pathname = "/login"}>login</button> para gerenciar chaves.
          </p>
        )}

        {error && <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-3 text-red-400 text-sm" role="alert">{error}</div>}
        {sucesso && <div className="rounded-lg bg-green-900/20 border border-green-500/30 p-3 text-green-400 text-sm" role="status">{sucesso}</div>}

        {items && (
          <>
            {items.length === 0 && (
              <p className="text-nexia-muted text-sm">
                Nenhuma chave ainda. Crie a primeira chave abaixo.
              </p>
            )}

            <div className="space-y-2">
              {items.map((k) => (
                <div key={k.id} className="rounded-xl border border-nexia-border bg-nexia-surface p-4 text-sm space-y-2" data-testid="api-key-item">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{k.nome}</div>
                      <div className="text-xs text-nexia-muted">ID: {k.id} · criado em {fmt(k.criado_em)}</div>
                    </div>
                    <button
                      onClick={() => remover(k.id)}
                      className="text-xs text-red-400 underline hover:text-red-300 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {abrirForm && (
          <ApiKeyForm onCriado={aoCriado} />
        )}
      </main>
    </div>
  );
}
