import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCentral, PARTES, haQuanto } from "./api";
import type { Dados, Parte } from "./api";
import { calcularAvisos } from "./avisos";
import type { Aba } from "./avisos";
import Painel from "./Painel";
import AvisoDetalhe from "./AvisoDetalhe";
import Clientes from "./Clientes";
import Dinheiro from "./Dinheiro";
import Divulgar from "./Divulgar";
import CortexAba from "./CortexAba";
import Sistema from "./Sistema";
import PrsAba from "./PrsAba";
import { Icone } from "./icones";
import InstalarApp from "./InstalarApp";
import { BotaoAvisar } from "./Painel";
import { Compacto, Grupo, useCelular } from "./celular";

// Central Kernex: painel de controle de toda a Kernex. No computador, menu lateral + cabeçalho; no celular, app com barra de abas embaixo e uma tela por assunto.
const ABAS: { id: Aba; nome: string; frase: string; icone: string }[] = [
  { id: "inicio", nome: "Início", frase: "Visão geral", icone: "inicio" },
  { id: "cortex", nome: "Cortex", frase: "Tarefas e IA", icone: "cortex" },
  { id: "clientes", nome: "Tenants", frase: "Clientes e produtos", icone: "tenants" },
  { id: "sistema", nome: "IA e Infraestrutura", frase: "IAs, chaves e robôs", icone: "ia" },
  { id: "prs", nome: "Entregas", frase: "Código e testes", icone: "prs" },
  { id: "dinheiro", nome: "Dinheiro", frase: "Assinaturas e Pix", icone: "dinheiro" },
  { id: "divulgar", nome: "Divulgar", frase: "Posts e ofertas", icone: "divulgar" },
];
// Barra de baixo no celular (nesta ordem). O resto fica na aba Mais.
const NO_CELULAR: { id: Aba; nome: string; icone: string }[] = [
  { id: "inicio", nome: "Início", icone: "inicio" },
  { id: "cortex", nome: "Cortex", icone: "cortex" },
  { id: "sistema", nome: "IA e Infra", icone: "ia" },
  { id: "clientes", nome: "Tenants", icone: "tenants" },
  { id: "mais", nome: "Mais", icone: "menu" },
];
const DO_MAIS: Aba[] = ["prs", "dinheiro", "divulgar"];

const ACESSO_RAPIDO = [
  { nome: "Abrir Cortex", href: "/cortex-app", logo: "/central/logos/cortex.svg" },
  { nome: "Abrir Vault", href: "/projetos", logo: null },
  { nome: "Abrir GitHub", href: "https://github.com/gilcambe/nexia", logo: "/central/logos/github.svg" },
  { nome: "Abrir Firebase", href: "https://console.firebase.google.com/project/nexia-c8710", logo: "/central/logos/firebase.svg" },
  { nome: "Abrir Cloudflare", href: "https://dash.cloudflare.com/", logo: "/central/logos/cloudflare.svg" },
];

export default function CentralPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { buscar } = useCentral();
  const [aba, setAba] = useState<Aba>(() => ({ produtos: "clientes" } as Record<string, Aba>)[location.hash.slice(1)] || (location.hash.slice(1) as Aba) || "inicio");
  const [d, setD] = useState<Dados>({});
  const [erros, setErros] = useState<Partial<Record<Parte, string>>>({});
  const [carregando, setCarregando] = useState(false);
  const [conferidoEm, setConferidoEm] = useState<string | null>(null);
  const celular = useCelular();
  const [busca, setBusca] = useState("");
  // Alerta aberto: undefined = fechado; null = lista de todos; número = um alerta.
  const [alerta, setAlerta] = useState<number | null | undefined>(undefined);
  const [versaoNova, setVersaoNova] = useState(false);

  const conferir = useCallback(async () => {
    setCarregando(true); setErros({});
    // No máximo 3 pedidos ao mesmo tempo: 11 de uma vez derrubavam as partes mais pesadas no celular ("Failed to fetch").
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
    // Aba aberta há muito tempo fica com a tela antiga: compara o script da página publicada com o desta aba.
    try {
      const html = await (await fetch(location.pathname, { cache: "no-store" })).text();
      const publicado = (html.match(/\/assets\/index-[\w-]+\.js/) || [])[0];
      const aqui = [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js/.test(s));
      if (publicado && aqui && !aqui.endsWith(publicado)) setVersaoNova(true);
    } catch { /* sem rede: confere na próxima */ }
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
      for (const t of vermelhos) if (!vermelhosVistos.current.has(t)) new Notification("Central Kernex", { body: t });
    }
    vermelhosVistos.current = new Set(vermelhos);
  }, [avisos, d.saude]);
  const semAcesso = erros.lista && /administrador/.test(erros.lista);
  const vermelho = avisos.some((a) => a.cor === "vermelho");
  const buscar2 = (texto: string) => {
    setBusca(texto);
    try { sessionStorage.setItem("central-busca", texto); } catch { /* sem storage */ }
    if (texto.trim()) ir("clientes");
  };

  const MenuLateral = (
    <nav className="flex flex-col h-full" aria-label="Módulos da Central">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/central/logos/kernex.svg" alt="" className="w-10 h-10" />
        <div className="leading-tight">
          <div className="text-xl font-bold text-slate-900">Kernex</div>
          <div className="text-sm text-slate-500">Central</div>
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
          <a key={l.nome} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {l.logo ? <img src={l.logo} alt="" className="w-5 h-5" /> : <Icone nome="vault" className="w-5 h-5 text-emerald-600" />}
            {l.nome}
          </a>
        ))}
      </div>
      <div className="mt-auto px-5 py-4 flex items-center gap-2 text-xs text-slate-400">
        <img src="/central/logos/kernex.svg" alt="" className="w-6 h-6" />
        <span><b className="text-slate-600">Kernex</b> Central</span>
      </div>
    </nav>
  );

  return (
    <div className="central-claro min-h-screen bg-[#f5f7fb] text-slate-900 font-display antialiased pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 overflow-y-auto z-20">{MenuLateral}</aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
            {DO_MAIS.includes(aba) && (
              <button className="lg:hidden p-2 -ml-2 text-indigo-600 cursor-pointer" onClick={() => ir("mais")} aria-label="Voltar para Mais" data-testid="central-voltar"><Icone nome="seta" className="w-5 h-5 rotate-180" /></button>
            )}
            <div className="lg:hidden flex items-center gap-2 flex-1 min-w-0" data-testid="central-title">
              {aba === "inicio"
                ? <><img src="/central/logos/kernex.svg" alt="" className="w-7 h-7" /><span className="font-bold">Kernex</span></>
                : <span className="font-semibold text-lg truncate">{aba === "mais" ? "Mais" : ABAS.find((a) => a.id === aba)?.nome}</span>}
            </div>
            <label className="hidden md:flex flex-1 max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-10 text-slate-400">
              <Icone nome="busca" className="w-5 h-5" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar2(busca)}
                placeholder="Buscar tenants, serviços, clientes…" className="flex-1 bg-transparent outline-none text-sm text-slate-700" data-testid="central-busca" />
            </label>
            <div className="hidden lg:flex ml-auto items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5" data-testid="central-estado">
              <span className={`w-2.5 h-2.5 rounded-full ${carregando && !conferidoEm ? "bg-slate-300" : vermelho ? "bg-red-500" : avisos.length ? "bg-amber-400" : "bg-emerald-500"}`} />
              <span className="leading-tight">
                <span className="block text-xs font-medium text-slate-700">{carregando && !conferidoEm ? "Conferindo…" : vermelho ? "Algo parou" : avisos.length ? `${avisos.length} pontos de atenção` : "Sistema online"}</span>
                <span className="block text-[11px] text-slate-400">Atualizado {haQuanto(conferidoEm)}</span>
              </span>
            </div>
            <button onClick={() => setAlerta(null)} className="relative p-2 text-slate-600 cursor-pointer lg:ml-0 ml-auto" aria-label={`${avisos.length} avisos`} data-testid="central-sino">
              <Icone nome="sino" className="w-6 h-6" />
              {avisos.length > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[#fff] text-[10px] leading-4 text-center">{avisos.length}</span>}
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-9 h-9 rounded-full bg-slate-800 text-[#fff] flex items-center justify-center text-sm font-semibold">{(user?.email || "?").charAt(0).toUpperCase()}</span>
              <span className="hidden xl:block text-sm text-slate-700 max-w-[180px] truncate">{user?.email}</span>
            </div>
          </div>
        </header>

        <main className="px-4 lg:px-8 py-6 max-w-[1600px]">
          {!authLoading && !user && (
            <p className="text-slate-500">Faça <button className="text-indigo-600 underline cursor-pointer" onClick={() => navigate("/login")}>login</button> como administrador para abrir a Central.</p>
          )}
          {semAcesso && <p className="text-red-600" role="alert">{erros.lista}</p>}
          {user && !semAcesso && (
            <Compacto.Provider value={celular}>
              {aba === "inicio" && <Painel d={d} erros={erros} avisos={avisos} ir={ir} conferir={conferir} carregando={carregando} abrirAlerta={setAlerta} conferidoEm={conferidoEm} />}
              {aba === "mais" && (
                <div className="max-w-3xl space-y-5" data-testid="tela-mais">
                  <Grupo titulo="Mais da Central">
                    {ABAS.filter((a) => DO_MAIS.includes(a.id)).map((a) => (
                      <button key={a.id} onClick={() => ir(a.id)} className="w-full flex items-center gap-3 px-4 py-3.5 bg-white text-left cursor-pointer active:bg-slate-50" data-testid={`mais-${a.id}`}>
                        <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Icone nome={a.icone} className="w-5 h-5" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium text-slate-900">{a.nome}</span><span className="block text-xs text-slate-500">{a.frase}</span></span>
                        <Icone nome="seta" className="w-4 h-4 text-slate-300" />
                      </button>
                    ))}
                  </Grupo>
                  <Grupo titulo="Acesso rápido">
                    {ACESSO_RAPIDO.map((l) => (
                      <a key={l.nome} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 bg-white active:bg-slate-50">
                        <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">{l.logo ? <img src={l.logo} alt="" className="w-6 h-6" /> : <Icone nome="vault" className="w-6 h-6 text-emerald-600" />}</span>
                        <span className="flex-1 text-[15px] font-medium text-slate-900">{l.nome}</span>
                        <Icone nome="externo" className="w-4 h-4 text-slate-300" />
                      </a>
                    ))}
                  </Grupo>
                  <Grupo titulo="Este aparelho">
                    <InstalarApp />
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-white">
                      <span className="w-10 h-10 rounded-full bg-slate-800 text-[#fff] flex items-center justify-center text-sm font-semibold shrink-0">{(user?.email || "?").charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium text-slate-900">Conta</span><span className="block text-xs text-slate-500 truncate">{user?.email}</span></span>
                    </div>
                  </Grupo>
                  <BotaoAvisar />
                </div>
              )}
              {aba !== "inicio" && aba !== "mais" && (
                <div className="max-w-3xl">
                  {aba === "clientes" && <Clientes d={d} erros={erros} />}
                  {aba === "dinheiro" && <Dinheiro d={d} erro={erros.dinheiro} />}
                  {aba === "divulgar" && <Divulgar d={d} erro={erros.divulga} />}
                  {aba === "cortex" && <CortexAba d={d} erro={erros.cortex} />}
                  {aba === "prs" && <PrsAba d={d} erro={erros.cortex} />}
                  {aba === "sistema" && <Sistema d={d} erros={erros} />}
                </div>
              )}
            </Compacto.Provider>
          )}
        </main>
        {alerta !== undefined && <AvisoDetalhe avisos={avisos} inicial={alerta} fechar={() => setAlerta(undefined)} ir={ir} />}
        {versaoNova && (
          <button onClick={() => location.reload()} className="fixed bottom-20 lg:bottom-6 right-4 z-40 rounded-xl bg-indigo-600 text-[#fff] px-4 py-3 text-sm font-medium shadow-lg cursor-pointer" data-testid="central-versao-nova">
            🔄 Tem versão nova da Central. Toque para atualizar.
          </button>
        )}
      </div>

      {user && !semAcesso && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]" aria-label="Seções da Central" data-testid="barra-abas">
          <div className="grid grid-cols-5">
            {NO_CELULAR.map((a) => {
              const ativa = aba === a.id || (a.id === "mais" && DO_MAIS.includes(aba));
              return (
                <button key={a.id} onClick={() => ir(a.id)} data-testid={`aba-${a.id}`} aria-current={ativa ? "page" : undefined}
                  className={`relative pt-2 pb-1.5 flex flex-col items-center gap-1 text-[11px] cursor-pointer ${ativa ? "text-indigo-700 font-semibold" : "text-slate-500"}`}>
                  <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${ativa ? "bg-indigo-100" : ""}`}><Icone nome={a.icone} className="w-6 h-6" /></span>
                  {a.nome}
                  {a.id === "inicio" && avisos.length > 0 && <span className="absolute top-1.5 left-1/2 ml-3 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" />}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
