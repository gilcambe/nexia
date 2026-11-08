import { useEffect, useState } from "react";
import { TELAS, telaDaUrl, type TelaId } from "./regras";
import { CSS } from "./tema";
import Bloco from "./Bloco";
import Inicio from "./Inicio";
import Tarefas from "./Tarefas";

// #3219 parte 1: casca da Central nova. Menu lateral (no celular, embaixo), 1 clique por tela, sem rolagem.
const NO_CELULAR: TelaId[] = ["inicio", "tarefas", "ia", "projetos", "config"];

function EmBreve({ nome }: { nome: string }) {
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr" }}>
      <Bloco titulo={nome} ajuda="Esta tela ainda está sendo feita pelo Cortex." fonte={null} atualizadoEm={null}>{null}</Bloco>
    </div>
  );
}

export default function Casca() {
  const [tela, setTela] = useState<TelaId>(() => telaDaUrl(location.search));
  const ir = (id: TelaId) => {
    setTela(id);
    const u = new URL(location.href);
    u.searchParams.set("tela", id);
    history.replaceState(null, "", u.toString());
  };
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("kx-busca")?.focus(); } };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);
  const atual = TELAS.find((t) => t.id === tela) || TELAS[0];
  return (
    <div className="kx" data-testid="kx-casca">
      <style>{CSS}</style>
      <header className="kx-topo">
        <span className="kx-logo">KERNEX</span>
        <input id="kx-busca" className="kx-busca" placeholder="Buscar (Ctrl+K)" aria-label="Buscar" />
        <a className="kx-btn" href="/central">Central antiga</a>
      </header>
      <nav className="kx-menu" aria-label="Menu">
        {TELAS.map((t) => (
          <button key={t.id} type="button" className={NO_CELULAR.includes(t.id) ? "" : "kx-so-pc"} aria-current={t.id === tela ? "page" : undefined} onClick={() => ir(t.id)} data-testid={"kx-menu-" + t.id}>
            <span aria-hidden>{t.icone}</span>{t.nome}
          </button>
        ))}
      </nav>
      <main className="kx-area">
        <p className="kx-serve" data-testid="kx-serve"><b>{atual.nome}:</b> {atual.serve}</p>
        {tela === "inicio" ? <Inicio irPara={ir} /> : tela === "tarefas" ? <Tarefas /> : <EmBreve nome={atual.nome} />}
      </main>
    </div>
  );
}
