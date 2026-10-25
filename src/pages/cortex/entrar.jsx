import { useState, useEffect, useRef } from "react";
import { initFirebase, auth as firebaseAuth } from "@/lib/firebase-lite";

export default function EntrarPage() {
  const [mode, setMode] = useState("login"); // "login" | "cadastro"
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [firebaseReady, setFirebaseReady] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    async function init() {
      try {
        const resposta = await fetch("/api/firebase-config", {
          cache: "no-store",
        });
        if (!resposta.ok) throw new Error("Não foi possível carregar a config do Firebase");
        const config = await resposta.json();
        if (!config || !config.apiKey) throw new Error("Config do Firebase incompleta");

        await initFirebase(config);
        if (!cancelado) {
          setFirebaseReady(true);
        }
      } catch (e) {
        if (!cancelado) setErro(e.message || "Erro ao iniciar a autenticação");
      }
    }
    init();
    return () => { cancelado = true; };
  }, []);

  async function handleGoogle() {
    if (!firebaseReady) return;
    setCarregando(true);
    setErro("");
    setSucesso("");
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
      if (clientId) {
        provider.setCustomParameters({ login_hint: "", hosted_domain: "" });
        provider.setCustomParameters({ client_id: clientId });
      }
      await signInWithPopup(firebaseAuth, provider);
      setSucesso("Login com Google realizado com sucesso.");
    } catch (e) {
      setErro(e.message || "Erro ao entrar com o Google");
    } finally {
      setCarregando(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!firebaseReady) {
      setErro("Autenticação ainda não está pronta. Tente novamente.");
      return;
    }
    setCarregando(true);
    setErro("");
    setSucesso("");

    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import("firebase/auth");
      if (mode === "login") {
        await signInWithEmailAndPassword(firebaseAuth, email, senha);
        setSucesso("Bem-vindo! Você entrou com sucesso.");
      } else {
        if (senha !== confirmarSenha) {
          setErro("A senha e a confirmação não são iguais.");
          return;
        }
        await createUserWithEmailAndPassword(firebaseAuth, email, senha);
        setSucesso("Cadastro realizado com sucesso. Você já está logado.");
      }
    } catch (e) {
      setErro(e.message || "Erro ao autenticar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-[#f5f5f5] px-4 sm:px-6 lg:px-8 pb-12">
      <form ref={formRef} onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div className="mx-auto max-w-sm text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-2 text-sm text-[#9ca3af]">
            Acesse o Cortex com seu e-mail e senha.
          </p>
        </div>

        {erro && (
          <div className="rounded-md bg-red-900/20 border border-red-500/30 px-4 py-3 text-sm text-red-300" role="alert">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="rounded-md bg-emerald-900/20 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300" role="status">
            {sucesso}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#d1d5db] mb-1">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-md border border-[#374151] bg-[#111827] px-3 py-2 text-white placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#22d3ee] focus:border-[#22d3ee] transition-colors w-full"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#d1d5db] mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={mode === "login" ? 1 : 6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="appearance-none rounded-md border border-[#374151] bg-[#111827] px-3 py-2 text-white placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#22d3ee] focus:border-[#22d3ee] transition-colors w-full"
              placeholder="••••••••"
            />
          </div>

          {mode === "cadastro" && (
            <div>
              <label className="block text-sm font-medium text-[#d1d5db] mb-1">Confirme a senha</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="appearance-none rounded-md border border-[#374151] bg-[#111827] px-3 py-2 text-white placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#22d3ee] focus:border-[#22d3ee] transition-colors w-full"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className={
              "w-full flex justify-center py-2.5 px-4 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
              (carregando
                ? "bg-[#374151] text-[#9ca3af]"
                : "bg-[#22d3ee] text-[#0a0a0f] hover:bg-[#67e8f9]"
              )
            }
          >
            {carregando ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#374151]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0a0a0f] px-2 text-[#9ca3af]"> Ou continue com </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={carregando || !firebaseReady}
          className={
            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border border-[#374151] bg-[#111827] text-sm font-semibold text-[#d1d5db] transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1f2937]"
          }
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12c0 1.78.43 3.45 1.18 4.84l3.66-2.75z"
            />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07h3.66c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Entrar com Google
        </button>

        <p className="mt-6 text-center text-sm text-[#9ca3af]">
          {mode === "login"
            ? "Não tem conta? "
            : "Já tem conta? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "cadastro" : "login");
              setErro("");
              setSucesso("");
            }}
            className="font-semibold text-[#22d3ee] hover:text-[#67e8f9] focus:outline-none focus:underline"
          >
            {mode === "login" ? "Criar uma conta" : "Fazer login"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-[#6b7280]">
          Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.
        </p>
      </form>
    </div>
  );
}
