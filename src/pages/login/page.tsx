import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!email || !password) { setLocalError("Preencha e-mail e senha."); return; }
    setLocalError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate("/");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro na autenticação");
    }
    setSubmitting(false);
  }, [email, password, name, mode, login, register, navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4">
      <button onClick={() => navigate("/")} className="absolute top-6 left-6 flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
        <i className="ri-arrow-left-line" /> NEXIA OS
      </button>

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/20 border border-nexia-cyan/30">
            <i className="ri-brain-fill text-nexia-cyan text-xl" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span>
        </div>

        <div className="rounded-xl bg-nexia-surface border border-nexia-border p-6">
          <div className="flex mb-6 rounded-lg bg-nexia-surface2 border border-nexia-border p-1">
            <button onClick={() => setMode("login")} className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer ${mode === "login" ? "bg-nexia-cyan text-[#0a0a0f]" : "text-nexia-muted hover:text-white"}`}>Entrar</button>
            <button onClick={() => setMode("register")} className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer ${mode === "register" ? "bg-nexia-cyan text-[#0a0a0f]" : "text-nexia-muted hover:text-white"}`}>Cadastrar</button>
          </div>

          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="text-xs text-nexia-muted mb-1.5 block">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full px-3 py-2.5 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40" />
              </div>
            )}
            <div>
              <label className="text-xs text-nexia-muted mb-1.5 block">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full px-3 py-2.5 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40" />
            </div>
            <div>
              <label className="text-xs text-nexia-muted mb-1.5 block">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} className="w-full px-3 py-2.5 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40" />
            </div>

            {(localError || error) && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-300">{localError || error}</p>
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting || loading}
              className="w-full py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-colors disabled:opacity-60 cursor-pointer">
              {submitting ? <><i className="ri-loader-4-line animate-spin inline mr-2" />Aguarde...</> : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </div>

          <p className="text-center text-xs text-nexia-muted mt-4">
            {mode === "login" ? "Auth via Firebase — dados protegidos pela LGPD" : "Ao cadastrar você concorda com nossos Termos de Uso"}
          </p>
        </div>
      </div>
    </div>
  );
}
