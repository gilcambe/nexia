import { useState, type ReactNode } from "react";
import { hora } from "./regras";

// Card da Central nova. Todo número mostra de onde veio e a hora; sem fonte, aparece "sem dados".
export default function Bloco({ titulo, ajuda, fonte, atualizadoEm, children, className = "" }: { titulo: string; ajuda: string; fonte: string | null; atualizadoEm: string | null; children?: ReactNode; className?: string }) {
  const [verAjuda, setVerAjuda] = useState(false);
  return (
    <section className={"kx-bloco " + className} data-testid="kx-bloco">
      <header className="kx-bloco-topo">
        <h2>{titulo}</h2>
        <button type="button" className="kx-ajuda" aria-label={"O que é " + titulo} onClick={() => setVerAjuda((v) => !v)}>?</button>
      </header>
      {verAjuda && <p className="kx-ajuda-texto">{ajuda}</p>}
      <div className="kx-bloco-corpo">{fonte ? children : <p className="kx-sem">sem dados</p>}</div>
      <footer className="kx-fonte" title={fonte || ""}>{fonte ? `Fonte: ${fonte}${atualizadoEm ? " · às " + hora(atualizadoEm) : ""}` : "sem fonte conectada"}</footer>
    </section>
  );
}
