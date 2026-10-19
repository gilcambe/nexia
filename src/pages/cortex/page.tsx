import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePedidos, lerCache, guardarCache } from "../meu-cortex/api";
import type { Resumo } from "../meu-cortex/api";
import Composer from "./Composer";
import Conversa from "./Conversa";
import Pergunta from "./Pergunta";
import Lateral from "./Lateral";
import type { Vista } from "./Lateral";
import Logo from "./Logo";
import { mostrarAbertura } from "@/lib/abertura-nexia";
import { Artefatos, Config, Conexoes, Tarefas } from "./Paineis";

export type Tema = "auto" | "escuro" | "claro";

const CSS = `
.cx{--cx-bg:#0b0b10;--cx-side:#101017;--cx-card:#16161f;--cx-line:#26262f;--cx-txt:#ececf1;--cx-mut:#9a9aa8;--cx-ac:#00d4aa;--cx-hover:#1d1d28;--cx-user:#1b2a2b}
.cx[data-tema=claro]{--cx-bg:#f8f8f5;--cx-side:#efefea;--cx-card:#ffffff;--cx-line:#e2e2db;--cx-txt:#1c1c22;--cx-mut:#6b6b76;--cx-ac:#00a884;--cx-hover:#e6e6df;--cx-user:#dff3ec}
.cx{background:var(--cx-bg);color:var(--cx-txt);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
`;

type ModoInicio = "pedido" | "pergunta";
const lerModo = (): ModoInicio => { try { return localStorage.getItem("cx_modo") === "pergunta" ? "pergunta" : "pedido"; } catch { return "pedido"; } };

const lerTema = (): Tema => { try { const t = localStorage.getItem("cx_tema"); return t === "claro" || t === "escuro" ? t : "auto"; } catch { return "auto"; } };

// Cortex: o app de IA do dono da NEXIA. Menu lateral com histórico, conversa por pedido, conexões e publicação.
export default function CortexPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const { listar, agir } = usePedidos();
  const [tema, setTema] = useState<Tema>(lerTema);
  const [claroSistema, setClaroSistema] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches);
  const [vista, setVista] = useState<Vista>("chat");
  const [aberto, setAberto] = useState<number>(() => Number(location.hash.replace("#p", "")) || 0);
  const [menu, setMenu] = useState(false);
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Resumo[]>(() => lerCache<Resumo[]>("lista") || []);
  const [erro, setErro] = useState<string>();
  const [inicial, setInicial] = useState("");
  const [modo, setModo] = useState<ModoInicio>(lerModo);
  const mudarModo = (m: ModoInicio) => { setModo(m); try { localStorage.setItem("cx_modo", m); } catch { /* sem armazenamento */ } };
  const [instalar, setInstalar] = useState<(() => void) | null>(() => {
    const ev = (window as unknown as { __cxInstall?: Event & { prompt: () => void } }).__cxInstall;
    return ev ? () => ev.prompt() : null;
  });

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia("(prefers-color-scheme: light)");
    const f = () => setClaroSistema(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);

  // App instalável: o manifesto fica no index.html (escopo /cortex); aqui entram a cor da barra, o ícone e a abertura NEXIA.
  useEffect(() => {
    const cor = document.createElement("meta"); cor.name = "theme-color"; cor.content = "#000000";
    const ico = document.createElement("link"); ico.rel = "apple-touch-icon"; ico.href = "/cortex-icon-180.png";
    document.head.append(cor, ico);
    mostrarAbertura("CORTEX");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/cortex-sw.js", { scope: "/cortex" }).catch(() => undefined);
    const titulo = document.title; document.title = "Cortex · NEXIA";
    const pedido = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & { prompt: () => void };
      setInstalar(() => () => ev.prompt());
    };
    window.addEventListener("beforeinstallprompt", pedido);
    return () => { ico.remove(); cor.remove(); document.title = titulo; window.removeEventListener("beforeinstallprompt", pedido); };
  }, []);

  const mudarTema = (t: Tema) => { setTema(t); try { localStorage.setItem("cx_tema", t); } catch { /* sem armazenamento: vale só nesta sessão */ } };
  const temaFinal = tema === "auto" ? (claroSistema ? "claro" : "escuro") : tema;

  const buscar = useCallback((q: string) => {
    listar(q, "todos", 1).then((r) => { setItens(r.itens); setErro(undefined); if (!q) guardarCache("lista", r.itens.slice(0, 60)); }).catch((e: Error) => setErro(e.message));
  }, [listar]);
  useEffect(() => { if (!authLoading && user) { const t = setTimeout(() => buscar(busca), busca ? 350 : 0); return () => clearTimeout(t); } }, [authLoading, user, busca, buscar]);

  const abrir = (n: number) => { setAberto(n); setVista("chat"); setMenu(false); history.replaceState(null, "", n ? `#p${n}` : location.pathname); };
  const ir = (v: Vista) => { setVista(v); setMenu(false); };
  const novo = () => { setInicial(""); abrir(0); };

  const nome = user?.displayName || "";
  const email = user?.email || "";

  const lateral = <Lateral itens={itens} aberto={aberto} vista={vista} busca={busca} nome={nome} email={email} buscar={setBusca} novo={novo} abrir={abrir} ir={ir} />;

  return (
    <div className="cx h-[100dvh] flex overflow-hidden" data-tema={temaFinal} data-testid="cortex-app">
      <style>{CSS}</style>
      <aside className="hidden md:block w-72 shrink-0">{lateral}</aside>
      {menu && (
        <div className="md:hidden fixed inset-0 z-40 flex" onClick={() => setMenu(false)}>
          <div className="w-[82%] max-w-xs h-full shadow-2xl" onClick={(e) => e.stopPropagation()}>{lateral}</div>
          <div className="flex-1 bg-black/50" />
        </div>
      )}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden flex items-center gap-3 px-3 h-14 border-b border-[var(--cx-line)] shrink-0">
          <button onClick={() => setMenu(true)} className="w-11 h-11 flex items-center justify-center" aria-label="Abrir menu" data-testid="cx-menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          </button>
          <Logo tamanho={28} /><span className="font-semibold">Cortex</span>
          <button onClick={novo} className="ml-auto w-11 h-11 flex items-center justify-center" aria-label="Novo pedido"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
        </header>

        {authLoading && (
          <div className="flex-1 flex flex-col p-4 gap-3 animate-pulse" data-testid="cx-esqueleto" aria-busy="true">
            {[70, 90, 55, 80].map((w, i) => <div key={i} className="h-4 rounded bg-[var(--cx-card)]" style={{ width: `${w}%` }} />)}
            <div className="mt-auto h-14 rounded-2xl bg-[var(--cx-card)]" />
          </div>
        )}

        {!authLoading && !user && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <Logo tamanho={64} /><h1 className="text-2xl font-semibold">Cortex</h1>
            <p className="text-[var(--cx-mut)]">Entre como dono da NEXIA para abrir o Cortex.</p>
            <button onClick={() => navigate("/login")} className="h-12 px-8 rounded-xl bg-[var(--cx-ac)] text-black font-semibold">Entrar</button>
          </div>
        )}

        {user && vista === "chat" && aberto > 0 && <div className="flex-1 min-h-0"><Conversa n={aberto} voltar={novo} /></div>}
        {user && vista === "chat" && aberto === 0 && (
          <div className="flex justify-center pt-3 shrink-0" role="tablist" aria-label="Tipo de conversa">
            {([["pedido", "Pedir tarefa"], ["pergunta", "Perguntar agora"]] as const).map(([m, rotulo]) => (
              <button key={m} role="tab" aria-selected={modo === m} onClick={() => mudarModo(m)} data-testid={`cx-modo-${m}`}
                className={`h-9 px-4 text-sm border border-[var(--cx-line)] first:rounded-l-xl last:rounded-r-xl ${modo === m ? "bg-[var(--cx-card)] font-semibold" : "text-[var(--cx-mut)]"}`}>{rotulo}</button>
            ))}
          </div>
        )}
        {user && vista === "chat" && aberto === 0 && modo === "pergunta" && <Pergunta virarPedido={(t) => { setInicial(t); mudarModo("pedido"); }} />}
        {user && vista === "chat" && aberto === 0 && modo === "pedido" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 text-center">
              <Logo tamanho={64} />
              {instalar && (
                <button onClick={instalar} className="mt-6 h-11 px-6 rounded-xl border border-[var(--cx-line)] text-sm font-medium" data-testid="cx-instalar-topo">Instalar o app Cortex</button>
              )}
              {!instalar && /Android/i.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches && (
                <p className="mt-6 text-sm text-[var(--cx-mut)]" data-testid="cx-instalar-dica">Para instalar: Chrome, menu ⋮, Instalar app.</p>
              )}
              {erro && <p className="text-sm text-red-400 mt-4" role="alert">{erro}</p>}
            </div>
            <Composer modo="pedido" inicial={inicial} enviar={async (texto) => { const r = await agir({ acao: "pedir", texto }); buscar(busca); if (r.numero) abrir(r.numero); }} />
          </div>
        )}
        {user && vista === "conexoes" && <div className="flex-1 overflow-y-auto"><Conexoes email={email} /></div>}
        {user && vista === "tarefas" && <div className="flex-1 overflow-y-auto"><Tarefas abrir={abrir} /></div>}
        {user && vista === "artefatos" && <div className="flex-1 overflow-y-auto"><Artefatos abrir={abrir} /></div>}
        {user && vista === "config" && <div className="flex-1 overflow-y-auto"><Config tema={tema} mudarTema={mudarTema} email={email} instalar={instalar} sair={async () => { await logout(); navigate("/login"); }} /></div>}
      </main>
    </div>
  );
}
