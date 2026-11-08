import { useState, type ReactNode } from "react";
import { hora } from "./regras";
import Icone from "./Icone";

// Card da Central nova. Todo número mostra de onde veio e a hora; sem fonte, aparece "sem dados".
// Opcional: ícone colorido no título e um "Ver todos →" que leva à tela certa.
export default function Bloco({ titulo, ajuda, fonte, atualizadoEm, children, className = "", icone, corIcone = "#60a5fa", ver }: {
  titulo: string; ajuda: string; fonte: string | null; atualizadoEm: string | null; children?: ReactNode; className?: string;
  icone?: string; corIcone?: string; ver?: { texto?: string; ir: () => void };
}) {
  const [verAjuda, setVerAjuda] = useState(false);
  return (
    <section className={"kx-bloco " + className} data-testid="kx-bloco">
      <header className="kx-bloco-topo">
        <h2>{icone && <Icone nome={icone} cor={corIcone} />}{titulo}</h2>
        <div className="kx-bloco-acoes">
          {ver && <button type="button" className="kx-ver" onClick={ver.ir}>{ver.texto || "Ver todos"} <Icone nome="seta" tam={14} /></button>}
          <button type="button" className="kx-ajuda" aria-label={"O que é " + titulo} onClick={() => setVerAjuda((v) => !v)}>?</button>
        </div>
      </header>
      {verAjuda && <p className="kx-ajuda-texto">{ajuda}</p>}
      <div className="kx-bloco-corpo">{fonte ? children : <p className="kx-sem">sem dados</p>}</div>
      <footer className="kx-fonte" title={fonte || ""}>{fonte ? `Fonte: ${fonte}${atualizadoEm ? " · às " + hora(atualizadoEm) : ""}` : "sem fonte conectada"}</footer>
    </section>
  );
}
