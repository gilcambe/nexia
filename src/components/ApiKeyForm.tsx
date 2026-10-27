import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

interface ApiKeyFormProps {
  onCriado?: (id: string) => void;
}

export default function ApiKeyForm({ onCriado }: ApiKeyFormProps) {
  const { getToken } = useAuth();
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [chave, setChave] = useState<string | null>(null); // exibida uma única vez
  const [chaveId, setChaveId] = useState<string | null>(null);

  const call = useCallback(async (init: RequestInit): Promise<Response> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    return fetch(apiPath("/api-keys"), {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  }, [getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setChave(null);
    setCarregando(true);
    try {
      const res = await call({ method: "POST", body: JSON.stringify({ nome }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setChaveId(body.id || null);
      setChave(body.chave || null); // exibida uma única vez
      if (body.chave) setSucesso("Chave criada. Copie agora: não será mostrada novamente.");
      else setSucesso("Chave criada com sucesso.");
      if (body.id) onCriado?.(body.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar chave.");
    } finally {
      setCarregando(false);
    }
  };

  const copiar = async () => {
    if (!chave) return;
    try {
      await navigator.clipboard.writeText(chave);
      setSucesso("Chave copiada para a área de transferência.");
    } catch {
      setErro("Não foi possível copiar a chave.");
    }
  };

  return (
    <div className="rounded-xl border border-nexia-border bg-nexia-surface p-6 md:p-8 space-y-4">
      <h2 className="text-lg font-bold text-white">Nova chave de API</h2>
      <p className="text-sm text-nexia-muted">
        Dê um nome para identificar onde esta chave será usada.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm text-white font-medium" htmlFor="api-key-nome">
          Nome da chave
        </label>
        <input
          id="api-key-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: integração site"
          required
          className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-white focus:border-nexia-cyan focus:outline-none"
        />
        <button
          type="submit"
          disabled={carregando}
          aria-label="Criar chave de API"
          className="w-full md:w-auto bg-nexia-cyan text-black font-semibold px-4 py-2 rounded-lg hover:bg-nexia-cyan-dim disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {carregando ? "Criando..." : "Criar chave"}
        </button>
      </form>

      {erro && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-3 text-red-400 text-sm" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="rounded-lg bg-green-900/20 border border-green-500/30 p-3 text-green-400 text-sm" role="status">
          {sucesso}
        </div>
      )}

      {chave && chaveId && (
        <div className="rounded-xl border border-nexia-cyan/30 bg-nexia-cyan/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-nexia-cyan font-semibold uppercase tracking-wider">Chave exibida uma única vez</p>
              <p className="text-sm text-white break-all font-mono">{chave}</p>
            </div>
            <button
              onClick={copiar}
              aria-label="Copiar chave de API para a área de transferência"
              className="text-xs bg-white text-black px-3 py-1.5 rounded-lg hover:bg-nexia-cyan transition"
            >
              Copiar
            </button>
          </div>
          <p className="text-xs text-nexia-muted">
            Guarde esta chave em local seguro. Depois de fechar esta tela, não será possível exibi-la novamente.
          </p>
        </div>
      )}
    </div>
  );
}
