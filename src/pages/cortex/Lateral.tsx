import type { Resumo } from "../meu-cortex/api";
import { agruparPorData } from "./agrupar";
import Logo from "./Logo";

export type Vista = "chat" | "conexoes" | "tarefas" | "artefatos" | "config" | "central";

const MENU: { id: Vista; nome: string; d: string }[] = [
  { id: "conexoes", nome: "Conexões", d: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" },
  { id: "tarefas", nome: "Tarefas", d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { id: "artefatos", nome: "Artefatos", d: "M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12v10M12 12L3 7" },
  { id: "central", nome: "Central de controle", d: "M12 2v20M2 12h20M6 6l12 12M18 6l-12 12" },
  { id: "config", nome: "Configurações", d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

const Icone = ({ d }: { d: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

interface Props {
  itens: Resumo[]; aberto: number; vista: Vista; busca: string; nome: string; email: string;
  buscar: (q: string) => void; novo: () => void; abrir: (n: number) => void; ir: (v: Vista) => void;
}

// Menu lateral: logo, Novo pedido, Procurar, atalhos, histórico por data e perfil do dono.
export default function Lateral({ itens, aberto, vista, busca, nome, email, buscar, novo, abrir, ir }: Props) {
  const item = "w-full flex items-center gap-3 px-3 h-11 rounded-xl text-left text-[15px] hover:bg-[var(--cx-hover)]";
  const isAdmin = email === "gcbezerra@gmail.com";
  const menuItens = MENU.filter((m) => m.id !== "central" || isAdmin);

  return (
    <div className="flex flex-col h-full bg-[var(--cx-side)] border-r border-[var(--cx-line)]">
      <div className="flex items-center gap-3 px-4 h-16 shrink-0">
        <Logo tamanho={34} />
        <div className="leading-tight"><p className="text-[11px] tracking-[.28em] text-[var(--cx-mut)]">KERNEX</p><p className="text-lg font-semibold">Cortex</p></div>
      </div>
      <div className="px-3 space-y-1">
        <button className={`${item} bg-[var(--cx-hover)] font-medium`} onClick={novo} data-testid="cx-novo">
          <Icone d="M12 5v14M5 12h14" />Novo pedido
        </button>
        <label className="flex items-center gap-3 px-3 h-11 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-bg)] text-[var(--cx-mut)]">
          <Icone d="M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
          <input value={busca} onChange={(e) => buscar(e.target.value)} placeholder="Procurar" aria-label="Procurar nos pedidos" data-testid="cx-busca"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[var(--cx-txt)] placeholder:text-[var(--cx-mut)]" />
        </label>
        {menuItens.filter((m) => m.id !== "config").map((m) => (
          <button key={m.id} className={`${item} ${vista === m.id ? "bg-[var(--cx-hover)]" : ""}`} onClick={() => ir(m.id)} data-testid={`cx-menu-${m.id}`}><Icone d={m.d} />{m.nome}</button>
        ))}
      </div>
      <p className="px-6 pt-5 pb-1 text-xs font-medium text-[var(--cx-mut)]">Recentes</p>
      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Histórico de pedidos" data-testid="cx-historico">
        {agruparPorData(itens).map((g) => (
          <div key={g.rotulo}>
            <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-[var(--cx-mut)]">{g.rotulo}</p>
            {g.itens.map((t) => (
              <button key={t.numero} onClick={() => abrir(t.numero)} data-testid="cx-item" title={t.titulo}
                className={`w-full text-left px-3 h-10 rounded-lg text-sm truncate hover:bg-[var(--cx-hover)] ${vista === "chat" && aberto === t.numero ? "bg-[var(--cx-hover)] font-medium" : ""}`}>
                {t.titulo.replace(/^\[Parte \d+\/\d+ de #\d+\]\s*/, "")}
              </button>
            ))}
          </div>
        ))}
        {!itens.length && <p className="px-3 text-sm text-[var(--cx-mut)]">Nenhum pedido ainda.</p>}
      </nav>
      <button onClick={() => ir("config")} className="flex items-center gap-3 px-4 h-16 border-t border-[var(--cx-line)] text-left hover:bg-[var(--cx-hover)] shrink-0" data-testid="cx-perfil">
        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00d4aa] to-[#7c6cf0] text-black font-bold flex items-center justify-center">{(nome || email || "N").charAt(0).toUpperCase()}</span>
        <span className="min-w-0"><span className="block text-sm font-medium truncate">{nome || "Dono"}</span><span className="block text-xs text-[var(--cx-mut)] truncate">{email}</span></span>
      </button>
    </div>
  );
}
