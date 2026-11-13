import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePedidos } from "../../meu-cortex/api";
import { useCentral } from "../api";
import { TELAS, telaDaUrl, corSemaforo, haQuanto, type TelaId } from "./regras";
import { CSS } from "./tema";
import Bloco from "./Bloco";
import Icone, { LogoK } from "./Icone";
import Inicio, { type Painel } from "./Inicio";
import Tarefas from "./Tarefas";
import IaCortex from "./IaCortex";
import Publicacoes from "./Publicacoes";
import Projetos from "./Projetos";
import Maquinas from "./Maquinas";
import Cofre from "./Cofre";
import Relatorios from "./Relatorios";
import Homologacao from "./Homologacao";
import Config from "./Config";
import Busca from "./Busca";
import Pedir from "./Pedir";
import Clientes from "./Clientes";
import Fabrica from "./Fabrica";
import Store from "./Store";
import Vendas from "./Vendas";
import Empresa from "./Empresa";
import Ferramentas from "./Ferramentas";
import Conversar from "./Conversar";
import { montarAcoes } from "./donos";

// #3219: casca da Central nova, no jeito do "Painel Executivo" que o dono mandou.
// PC: menu lateral com as 10 telas. Celular: 5 telas embaixo + gaveta (☰) com todas.
const NO_CELULAR: TelaId[] = ["inicio", "pedir", "tarefas", "projetos", "maquinas"];
export const ICONE_TELA: Record<TelaId, string> = { inicio: "casa", conversar: "enviar", pedir: "enviar", clientes: "troca", fabrica: "foguete", store: "check", vendas: "grafico", empresa: "sino", ferramentas: "engrenagem", projetos: "pasta", maquinas: "servidor", ia: "ia", tarefas: "lista", arquivos: "arquivo", publicacoes: "foguete", homologacao: "check", cofre: "cadeado", relatorios: "grafico", config: "engrenagem" };
const COR_SINAL = { verde: "#22c55e", amarelo: "#f59e0b", vermelho: "#ef4444" };

function EmBreve({ nome }: { nome: string }) {
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr" }}>
      <Bloco titulo={nome} icone="arquivo" corIcone="#fbbf24" ajuda="Precisa do Operário instalado nos seus PCs (próxima fase, com o seu OK)." fonte={null} atualizadoEm={null}>{null}</Bloco>
      <section className="kx-bloco" style={{ alignItems: "center", textAlign: "center", justifyContent: "center", gap: 10, padding: 28 }}>
        <span style={{ width: 72, height: 72, borderRadius: 20, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#f59e0b,#c2410c)" }}><Icone nome="arquivo" tam={36} cor="#fff" /></span>
        <b style={{ fontSize: 18 }}>Os arquivos dos seus PCs aparecem aqui</b>
        <p className="kx-mut" style={{ whiteSpace: "normal", maxWidth: 520, fontSize: 14 }}>Para isso falta instalar o Operário no PC 1 e no PC 2. Isso mexe no seu computador, então só fazemos quando você der o OK.</p>
      </section>
    </div>
  );
}

// Dados que o topo e o Início usam juntos (lidos 1 vez por minuto).
function usePainel(): Painel {
  const { ias, projetos } = usePedidos();
  const { buscar } = useCentral();
  const [p, setP] = useState<Painel>({ ias: null, saude: null, erro: null, dono: null });
  const ler = useCallback(async () => {
    const [a, c, o, m, pr] = await Promise.allSettled([ias<NonNullable<Painel["ias"]>>(), buscar("saude"), buscar("oQueFalta"), buscar("maquinas"), projetos<{ projetos: { id: string; nome?: string; proposto?: boolean }[] }>()]);
    setP((v) => {
      const n: Painel = { ...v, erro: null };
      // 09/11: "Precisa de você" = só o que o dono pode fazer, cada um com passo a passo (donos.ts).
      if (o.status === "fulfilled" && o.value) n.tudo = o.value as NonNullable<Painel["tudo"]>;
      if (m.status === "fulfilled" && m.value && m.value.ligado) n.maq = { com: (m.value.maquinas || []).filter((x: { online?: boolean }) => x.online).length, total: (m.value.maquinas || []).length };
      n.dono = montarAcoes({
        esperando: o.status === "fulfilled" && o.value ? ((o.value as unknown as { esperandoVoce?: [] }).esperandoVoce || []) : [],
        maquinas: m.status === "fulfilled" && m.value ? (m.value.maquinas || []) : [],
        projetos: pr.status === "fulfilled" ? pr.value.projetos || [] : [],
      });
      if (a.status === "fulfilled") n.ias = a.value; else n.erro = (a.reason as Error).message;
      if (c.status === "fulfilled" && c.value && Array.isArray(c.value.produtos)) {
        const medidos = c.value.produtos.filter((x: { ok: boolean | null }) => x.ok !== null);
        n.saude = { fora: medidos.filter((x: { ok: boolean | null }) => x.ok === false).length, total: medidos.length, em: c.value.em || new Date().toISOString() };
      }
      return n;
    });
  }, [ias, buscar, projetos]);
  useEffect(() => { ler(); const t = setInterval(ler, 60000); return () => clearInterval(t); }, [ler]);
  return { ...p, recarregar: ler };
}

export default function Casca() {
  const { user } = useAuth();
  const [tela, setTela] = useState<TelaId>(() => telaDaUrl(location.search));
  const [gaveta, setGaveta] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const painel = usePainel();
  const ir = useCallback((id: TelaId) => {
    setTela(id);
    setGaveta(false);
    const u = new URL(location.href);
    u.searchParams.set("tela", id);
    history.replaceState(null, "", u.toString());
  }, []);
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscando(true); setTimeout(() => document.getElementById("kx-busca")?.focus(), 0); }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);
  const atual = TELAS.find((t) => t.id === tela) || TELAS[0];
  const c = painel.ias?.contagens || {};
  const sinal = corSemaforo({ precisa: painel.dono?.length || 0, travadas: c.travada || 0, servicosFora: painel.saude?.fora || 0 });
  const corSinal = COR_SINAL[sinal.cor];
  const precisa = painel.dono?.length || 0;
  const corSaude = !painel.saude ? "#64748b" : painel.saude.fora ? "#ef4444" : "#22c55e";
  const nome = (user?.displayName || "").split(" ")[0] || "";
  const abrirBusca = () => { setBuscando(true); setTimeout(() => document.getElementById("kx-busca")?.focus(), 0); };
  return (
    <div className={"kx" + (gaveta ? " gaveta" : "") + (buscando ? " buscando" : "")} data-testid="kx-casca">
      <style>{CSS}</style>
      <div className="kx-marca">
        <LogoK tam={38} />
        <span className="kx-logo">KERNEX<small>Controle. Automação. Evolução.</small></span>
      </div>
      <header className="kx-topo">
        <button type="button" className="kx-sino kx-so-cel" aria-label="Abrir menu" onClick={() => setGaveta(true)} data-testid="kx-abrir-menu"><Icone nome="menu" /></button>
        <span className="kx-so-cel" style={{ alignItems: "center", gap: 8, flex: 1 }}><LogoK tam={28} /><b style={{ letterSpacing: ".06em" }}>KERNEX</b></span>
        <Busca ir={ir} fechar={() => setBuscando(false)} />
        <button type="button" className="kx-sino kx-so-cel" aria-label="Buscar" onClick={abrirBusca}><Icone nome="busca" /></button>
        <button type="button" className="kx-btn forte kx-so-pc-flex" onClick={() => ir("pedir")} data-testid="kx-pedir-topo"><Icone nome="enviar" tam={16} />Pedir ao Cortex</button>
        <button type="button" className="kx-status" style={{ borderColor: corSinal + "99", background: corSinal + "1a" }} onClick={() => ir(precisa ? "tarefas" : "inicio")} data-testid="kx-status-topo"
          title={painel.ias?.resumo || ""}>
          <span className="kx-bola" style={{ background: painel.ias ? corSinal : "#64748b", width: 22, height: 22, display: "grid", placeItems: "center" }}>
            <Icone nome={sinal.cor === "verde" ? "check" : "alerta"} tam={14} cor="#fff" />
          </span>
          <span className="kx-status-txt"><b>{painel.ias ? sinal.texto : "Conferindo…"}</b><span>{painel.ias ? "conferido " + haQuanto(painel.ias.conferidoEm) : ""}</span></span>
        </button>
        <button type="button" className="kx-sino kx-so-pc-flex" aria-label={precisa + " coisas precisam de você"} onClick={() => ir("tarefas")} data-testid="kx-sino">
          <Icone nome="sino" />{precisa > 0 && <i>{precisa}</i>}
        </button>
      </header>
      <div className="kx-gaveta-fundo" onClick={() => setGaveta(false)} />
      <nav className="kx-menu" aria-label="Menu">
        <div className="kx-so-cel" style={{ alignItems: "center", gap: 10, padding: "0 6px 12px", display: gaveta ? "flex" : "none" }}>
          <LogoK tam={30} /><span className="kx-logo">KERNEX<small>Controle. Automação. Evolução.</small></span>
          <button type="button" className="kx-sino" style={{ marginLeft: "auto", width: 36, height: 36 }} aria-label="Fechar menu" onClick={() => setGaveta(false)}><Icone nome="x" /></button>
        </div>
        {TELAS.map((t) => (
          <button key={t.id} type="button" className={NO_CELULAR.includes(t.id) ? "" : "kx-so-pc"} aria-current={t.id === tela ? "page" : undefined} onClick={() => ir(t.id)} data-testid={"kx-menu-" + t.id}>
            <Icone nome={ICONE_TELA[t.id]} />{t.nome}
          </button>
        ))}
        <div className="kx-menu-rodape">
          <a className="kx-online" href="/central?antiga=1" style={{ borderColor: "#33415599", color: "#c7d2f0" }}>Abrir a Central antiga</a>
          <div className="kx-online" style={{ borderColor: corSaude + "88", background: corSaude + "14" }}>
            <span className="kx-bola" style={{ background: corSaude }} />
            <span><b style={{ display: "block" }}>{painel.saude ? `${painel.saude.total - painel.saude.fora} de ${painel.saude.total} serviços no ar` : "Serviços: conferindo"}</b>
              <span className="kx-mut">{nome ? nome + " · " : ""}administrador</span></span>
          </div>
        </div>
      </nav>
      <main className="kx-area">
        {tela !== "inicio" && <p className="kx-serve" data-testid="kx-serve"><b>{atual.nome}:</b> {atual.serve}</p>}
        {tela === "inicio" ? <Inicio irPara={ir} painel={painel} nome={nome} /> : tela === "tarefas" ? <Tarefas painel={painel} ir={ir} /> : tela === "ia" ? <IaCortex /> : tela === "publicacoes" ? <Publicacoes />
          : tela === "projetos" ? <Projetos /> : tela === "maquinas" ? <Maquinas /> : tela === "cofre" ? <Cofre /> : tela === "relatorios" ? <Relatorios painel={painel} /> : tela === "homologacao" ? <Homologacao /> : tela === "config" ? <Config /> : tela === "pedir" ? <Pedir /> : tela === "clientes" ? <Clientes /> : tela === "fabrica" ? <Fabrica /> : tela === "store" ? <Store /> : tela === "vendas" ? <Vendas /> : tela === "empresa" ? <Empresa /> : tela === "ferramentas" ? <Ferramentas /> : tela === "conversar" ? <Conversar /> : <EmBreve nome={atual.nome} />}
      </main>
    </div>
  );
}
