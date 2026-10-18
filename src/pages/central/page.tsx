import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCentral, PARTES } from "./api";
import type { Dados, Parte } from "./api";
import { calcularAvisos } from "./avisos";
import type { Aba } from "./avisos";
import Inicio from "./Inicio";
import Produtos from "./Produtos";
import Dinheiro from "./Dinheiro";
import Divulgar from "./Divulgar";
import CortexAba from "./CortexAba";
import Mais from "./Mais";

// Central NEXIA: o dono vê e controla toda a NEXIA numa página só, feita para o celular.
const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: "inicio", nome: "Início", icone: "🏠" },
  { id: "dinheiro", nome: "Dinheiro", icone: "💰" },
  { id: "produtos", nome: "Produtos", icone: "🧩" },
  { id: "divulgar", nome: "Divulgar", icone: "📣" },
  { id: "cortex", nome: "Cortex", icone: "🧠" },
  { id: "mais", nome: "Mais", icone: "☰" },
];

export default function CentralPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { buscar } = useCentral();
  const [aba, setAba] = useState<Aba>(() => (location.hash.slice(1) as Aba) || "inicio");
  const [claro, setClaro] = useState<boolean>(() => {
    try { return localStorage.getItem("central-tema") === "claro"; } catch { return false; }
  });
  const [d, setD] = useState<Dados>({});
  const [erros, setErros] = useState<Partial<Record<Parte, string>>>({});
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("central-tema", claro ? "claro" : "escuro"); } catch { /* sem storage */ }
  }, [claro]);

  const conferir = useCallback(async () => {
    setCarregando(true); setErros({});
    await Promise.all(PARTES.map((p) => buscar(p)
      .then((v) => setD((x) => ({ ...x, [p]: v })))
      .catch((e: Error) => setErros((x) => ({ ...x, [p]: e.message })))));
    setCarregando(false);
  }, [buscar]);

  useEffect(() => { if (!authLoading && user) conferir(); }, [authLoading, user, conferir]);
  const ir = (a: Aba) => { setAba(a); history.replaceState(null, "", `#${a}`); window.scrollTo(0, 0); };
  const avisos = useMemo(() => calcularAvisos(d), [d]);

  // Com a Central aberta, confere de novo a cada 5 minutos e avisa no aparelho quando algo novo fica vermelho.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(conferir, 5 * 60000);
    return () => clearInterval(t);
  }, [user, conferir]);
  const vermelhosVistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!d.saude) return;
    const vermelhos = avisos.filter((a) => a.cor === "vermelho").map((a) => a.texto);
    if (vermelhosVistos.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const t of vermelhos) if (!vermelhosVistos.current.has(t)) new Notification("Central NEXIA", { body: t });
    }
    vermelhosVistos.current = new Set(vermelhos);
  }, [avisos, d.saude]);
  const semAcesso = erros.lista && /administrador/.test(erros.lista);

  return (
    <div className={`${claro ? "central-claro " : ""}min-h-screen bg-[#0a0a0f] text-white font-display antialiased pb-24`}>
      <header className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-nexia-border">
        <div className="px-4 py-3 max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold" data-testid="central-title">Central <span className="text-nexia-cyan">NEXIA</span></h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-nexia-muted truncate max-w-[50%]">{user?.email}</span>
            <button
              type="button"
              onClick={() => setClaro((v) => !v)}
              data-testid="btn-tema"
              aria-label="Alternar tema claro/escuro"
              className="text-xs cursor-pointer px-2 py-1 rounded border border-nexia-border"
            >
              {claro ? "☀️ Claro" : "🌙 Escuro"}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        {!authLoading && !user && (
          <p className="text-nexia-muted">Faça <button className="text-nexia-cyan underline cursor-pointer" onClick={() => navigate("/login")}>login</button> como administrador para abrir a Central.</p>
        )}
        {semAcesso && <p className="text-red-400" role="alert">{erros.lista}</p>}
        {user && !semAcesso && (
          <>
            {aba === "inicio" && <Inicio d={d} avisos={avisos} ir={ir} conferir={conferir} carregando={carregando} />}
            {aba === "produtos" && <Produtos d={d} />}
            {aba === "dinheiro" && <Dinheiro d={d} erro={erros.dinheiro} />}
            {aba === "divulgar" && <Divulgar d={d} erro={erros.divulga} />}
            {aba === "cortex" && <CortexAba d={d} erro={erros.cortex} />}
            {aba === "mais" && <Mais d={d} erro={erros.robos} />}
          </>
        )}
      </main>

      {user && !semAcesso && (
        <nav className="fixed bottom-0 inset-x-0 z-10 bg-nexia-surface border-t border-nexia-border" aria-label="Seções da Central">
          <div className="max-w-2xl mx-auto grid grid-cols-6">
            {ABAS.map((a) => (
              <button key={a.id} onClick={() => ir(a.id)} data-testid={`aba-${a.id}`}
                className={`relative py-2 flex flex-col items-center text-[11px] cursor-pointer ${aba === a.id ? "text-nexia-cyan" : "text-nexia-muted"}`}>
                <span className="text-xl leading-none">{a.icone}</span>{a.nome}
                {a.id === "inicio" && avisos.length > 0 && <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-amber-400" />}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
