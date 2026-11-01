import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCentral, PARTES, haQuanto } from "./api";
import type { Dados, Parte } from "./api";
import { calcularAvisos } from "./avisos";
import type { Aba } from "./avisos";
import Painel from "./Painel";
import Clientes from "./Clientes";
import Dinheiro from "./Dinheiro";
import Divulgar from "./Divulgar";
import CortexAba from "./CortexAba";
import Sistema from "./Sistema";
import PrsAba from "./PrsAba";
import { Icone } from "./icones";

// Central Kernex: painel de controle de toda a Kernex. No computador, menu lateral fixo + cabeçalho à direita; no celular, barra inferior.
const ABAS: { id: Aba; nome: string; frase: string; icone: string }[] = [
  { id: "inicio", nome: "Início", frase: "Visão geral", icone: "inicio" },
  { id: "cortex", nome: "Cortex", frase: "Tarefas e IA", icone: "cortex" },
  { id: "clientes", nome: "Tenants", frase: "Clientes e produtos", icone: "tenants" },
  { id: "sistema", nome: "IA e Infraestrutura", frase: "IAs, chaves e robôs", icone: "ia" },
  { id: "prs", nome: "Entregas", frase: "Código e testes", icone: "prs" },
  { id: "dinheiro", nome: "Dinheiro", frase: "Assinaturas e Pix", icone: "dinheiro" },
  { id: "divulgar", nome: "Divulgar", frase: "Posts e ofertas", icone: "divulgar" },
];
const NO_CELULAR: Aba[] = ["inicio", "cortex", "clientes", "sistema"];

const ACESSO_RAPIDO = [
  { nome: "Abrir Cortex", href: "/cortex-app" },
  { nome: "Abrir Vault", href: "/projetos" },
  { nome: "Abrir GitHub", href: "https://github.com/gilcambe/nexia" },
  { nome: "Abrir Firebase", href: "https://console.firebase.google.com/project/nexia-c8710" },
];
const ABAS: { id: Aba; nome: string; frase: string; icone: string }[] = [
  { id: "inicio", nome: "Início", frase: "Visão geral", icone: "inicio" },
  { id: "cortex", nome: "Cortex", frase: "Tarefas e IA", icone: "cortex" },
  { id: "clientes", nome: "Tenants", frase: "Clientes e produtos", icone: "tenants" },
  { id: "sistema", nome: "IA e Infraestrutura", frase: "IAs, chaves e robôs", icone: "ia" },
  { id: "prs", nome: "Entregas", frase: "Código e testes", icone: "prs" },
  { id: "dinheiro", nome: "Dinheiro", frase: "Assinaturas e Pix", icone: "dinheiro" },
  { id: "divulgar", nome: "Divulgar", frase: "Posts e ofertas", icone: "divulgar" },
];
const NO_CELULAR: Aba[] = ["inicio", "cortex", "clientes", "sistema"];

const ACESSO_RAPIDO = [
  { nome: "Abrir Cortex", href: "/cortex-app" },
  { nome: "Abrir Vault", href: "/projetos" },
  { nome: "Abrir GitHub", href: "https://github.com/gilcambe/nexia" },
  { nome: "Abrir Firebase", href: "https://console.firebase.google.com/project/nexia-c8710" },
];

export default function CentralPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { buscar } = useCentral();
  const [tema, setTema] = useState<boolean>(() => {
    const savedChoice = sessionStorage.getItem("central-tema");
    if (savedChoice === null) return true; // Tema claro como padrão
    return savedChoice === "true";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("central-claro", tema);
    try { sessionStorage.setItem("central-tema", tema.toString()); } catch { /* sem storage */ }
  }, [tema]);

  const [aba, setAba] = useState<Aba>(() => {
    const savedChoice = sessionStorage.getItem("central-aba") as Aba | undefined;
    const hashAba = location.hash.slice(1) as Aba;
    if (savedChoice && !hashAba) return savedChoice;
    if (hashAba && ABAS.some(a => a.id === hashAba)) return hashAba;
    return "inicio";
  });
  const [d, setD] = useState<Dados>({});
  const [erros, setErros] = useState<Partial<Record<Parte, string>>>({});
  const [carregando, setCarregando] = useState(false);
  const [conferidoEm, setConferidoEm] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [busca, setBusca] = useState("");

  const conferir = useCallback(async () => {
    setCarregando(true); setErros({});
    const fila = [...PARTES];
    const trabalhador = async () => {
      for (let p = fila.shift(); p; p = fila.shift()) {
        const parte = p;
        await buscar(parte)
          .then((v) => setD((x) => ({ ...x, [parte]: v })))
          .catch((e: Error) => setErros((x) => ({ ...x, [parte]: e.message })));
      }
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
    setCarregando(false);
    setConferidoEm(new Date().toISOString());
  }, [buscar]);

  useEffect(() => { if (!authLoading && user) conferir(); }, [authLoading, user, conferir]);
  const ir = (a: Aba) => { setAba(a); setMenu(false); history.replaceState(null, "", `#${a}`); window.scrollTo(0, 0); };
  const avisos = useMemo(() => calcularAvisos(d), [d]);

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
      for (const t of vermelhos) if (!vermelhosVistos.current.has(t)) new Notification("Central Kernex", { body: t });
    }
    vermelhosVistos.current = new Set(vermelhos);
  }, [avisos, d.saude]);
  const semAcesso = erros.lista && /administrador/.test(erros.lista);
  const vermelho = avisos.some((a) => a.cor === "vermelho");
  const buscar2 = (texto: string) => {
    setBusca(texto);
    try {
      sessionStorage.setItem("central-busca", texto);
      location.hash = 'clientes';
    } catch { /* sem storage */ }
    if (texto.trim()) ir("clientes");
  };

  const MenuLateral = (
    <nav className="flex flex-col h-full" aria-label="Módulos da Central">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/central-icon.svg" alt="logo Kernex Central" className="w-10 h-10" />
        <div className="leading-tight">
          <div className="text-xl font-bold text-slate-900">Kernex Central</div>
        </div>
      </div>
      <div className="px-3 space-y-1">
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => ir(a.id)} data-testid={`menu-${a.id}`}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer transition-colors ${aba === a.id ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}>
            <Icone nome={a.icone} className="w-6 h-6 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{a.nome}</span>
              <span className="block text-xs text-slate-400 truncate">{a.frase}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="px-5 mt-6 text-xs font-medium text-slate-500">Acesso rápido</div>
      <div className="px-3 mt-2 space-y-0.5">
        {ACESSO_RAPIDO.map((l) => (
          <a key={l.nome} href={l.href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <Icone nome="vault" className="w-5 h-5 text-emerald-600" />
            {l.nome}
          </a>
        ))}
      </div>
      <div className="mt-auto px-5 py-4 flex items-center gap-2 text-xs text-slate-400">
        <img src="/central-icon.svg" alt="logo Kernex Central" className="w-6 h-6" />
        <span><b className="text-slate-600">Kernex</b> Central</span>
      </div>
    </nav>
  );

  return (
    <div className={`min-h-screen ${tema ? 'central-claro bg-slate-50 text-slate-900' : 'central-escuro bg-slate-900 text-slate-100'} font-display antialiased pb-20 lg:pb-0`}>
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 overflow-y-auto z-20">{MenuLateral}</aside>
      {menu && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/30" onClick={() => setMenu(false)}>
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>{MenuLateral}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
            <button className="lg:hidden p-2 -ml-2 text-slate-600 cursor-pointer" onClick={() => setMenu(true)} aria-label="Abrir menu"><Icone nome="menu" className="w-6 h-6" /></button>
            <div className="lg:hidden flex items-center gap-2 flex-1" data-testid="central-title">
              <img src="/central-icon.svg" alt="" className="w-7 h-7" /><span className="font-bold">Kernex</span>
            </div>
            <label className="hidden md:flex flex-1 max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-10 text-slate-400">
              <Icone nome="busca" className="w-5 h-5" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar2(busca)}
                placeholder="Buscar tenants, serviços, clientes…" className="flex-1 bg-transparent outline-none text-sm text-slate-700" data-testid="central-busca" />
            </label>
            <div className="hidden lg:flex ml-auto items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5" data-testid="central-estado">
              <span className={`w-2.5 h-2.5 rounded-full ${carregando && !conferidoEm ? "bg-slate-300" : vermelho ? "bg-red-500" : avisos.length ? "bg-amber-400" : "bg-emerald-500"}`} />
              <span className="leading-tight">
                <span className="block text-xs font-medium text-slate-700">
                  {carregando && !conferidoEm ? "Conferindo…" : 
                   avisos.length ? `${avisos.length} coisas precisam de você` : 
                   "Tudo funcionando"}
                </span>
                <span className="block text-[11px] text-slate-400">Atualizado {haQuanto(conferidoEm)}</span>
              </span>
            </div>
            <button onClick={() => ir("inicio")} className="relative p-2 text-slate-600 cursor-pointer lg:ml-0 ml-auto" aria-label={`${avisos.length} avisos`}>
              <Icone nome="sino" className="w-6 h-6" />
              {avisos.length > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[#fff] text-[10px] leading-4 text-center">{avisos.length}</span>}
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-9 h-9 rounded-full bg-slate-800 text-[#fff] flex items-center justify-center text-sm font-semibold">{(user?.email || "?").charAt(0).toUpperCase()}</span>
              <span className="hidden xl:block text-sm text-slate-700 max-w-[180px] truncate">{user?.email}</span>
              <button 
                onClick={() => setTema(!tema)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                aria-label={tema ? "Mudar para tema escuro" : "Mudar para tema claro"}
              >
                {tema ? (
                  <Icone nome="lua" className="w-5 h-5" />
                ) : (
                  <Icone nome="sol" className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 lg:px-8 py-6 max-w-7xl">
          {!authLoading && !user && (
            <p className="text-slate-500">Faça <button className="text-indigo-600 underline cursor-pointer" onClick={() => navigate("/login")}>login</button> como administrador para abrir a Central.</p>
          )}
          {semAcesso && <p className="text-red-600" role="alert">{erros.lista}</p>}
          {user && !semAcesso && (
            <>
              {aba === "inicio" && <Painel d={d} erros={erros} avisos={avisos} ir={ir} conferir={conferir} carregando={carregando} />}
              {aba !== "inicio" && (
                <div className="max-w-3xl">
                  {aba === "clientes" && <Clientes d={d} erros={erros} />}
                  {aba === "dinheiro" && <Dinheiro d={d} erro={erros.dinheiro} />}
                  {aba === "divulgar" && <Divulgar d={d} erro={erros.divulga} />}
                  {aba === "cortex" && <CortexAba d={d} erro={erros.cortex} />}
                  {aba === "prs" && <PrsAba d={d} erro={erros.cortex} />}
                  {aba === "sistema" && <Sistema d={d} erros={erros} />}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {user && !semAcesso && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-white border-t border-slate-200" aria-label="Seções da Central">
          <div className="grid grid-cols-5">
            {ABAS.filter((a) => NO_CELULAR.includes(a.id)).map((a) => (
              <button key={a.id} onClick={() => ir(a.id)} data-testid={`aba-${a.id}`}
                className={`relative py-2 flex flex-col items-center gap-0.5 text-[11px] cursor-pointer ${aba === a.id ? "text-indigo-600" : "text-slate-500"}`}>
                <Icone nome={a.icone} className="w-6 h-6" />{a.nome.split(" ")[0]}
                {a.id === "inicio" && avisos.length > 0 && <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-amber-400" />}
              </button>
            ))}
            <button onClick={() => setMenu(true)} className="py-2 flex flex-col items-center gap-0.5 text-[11px] text-slate-500 cursor-pointer" data-testid="aba-mais">
              <Icone nome="menu" className="w-6 h-6" />Mais
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
