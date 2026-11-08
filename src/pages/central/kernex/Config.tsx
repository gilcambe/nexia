import { useState } from "react";
import Bloco from "./Bloco";

// #3219 parte 8: Configurações. Guardadas só neste aparelho.
const ler = (k: string, p: string) => { try { return localStorage.getItem("kx:" + k) || p; } catch { return p; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem("kx:" + k, v); } catch { /* bloqueado: segue sem guardar */ } };

export default function Config() {
  const [densidade, setDensidade] = useState(() => ler("densidade", "normal"));
  const [ausente, setAusente] = useState(() => ler("ausente", "nao") === "sim");
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <Bloco titulo="Jeito da tela" ajuda="Compacto mostra mais linhas na tela." fonte="este aparelho" atualizadoEm={null}>
        <div className="kx-chips">{["normal", "compacto"].map((x) => <button key={x} type="button" className="kx-chip" aria-pressed={densidade === x} onClick={() => { setDensidade(x); gravar("densidade", x); }}>{x === "normal" ? "Normal" : "Compacto"}</button>)}</div>
      </Bloco>
      <Bloco titulo="Estou ausente" ajuda="Ligado: só avisa você se for algo crítico." fonte="este aparelho" atualizadoEm={null}>
        <button type="button" className={"kx-btn" + (ausente ? " forte" : "")} onClick={() => { setAusente(!ausente); gravar("ausente", ausente ? "nao" : "sim"); }}>{ausente ? "Ligado: só o crítico" : "Desligado"}</button>
      </Bloco>
      <Bloco titulo="Avisos no celular" ajuda="Receber aviso quando uma tarefa termina ou trava." fonte="avisos do Cortex" atualizadoEm={null}>
        <a className="kx-btn forte" href="/cortex">Ligar avisos no Cortex</a>
      </Bloco>
      <Bloco titulo="IAs conectadas" ajuda="Colocar ou trocar as chaves das IAs grátis." fonte="Conectar IAs" atualizadoEm={null}>
        <a className="kx-btn" href="/central#sistema">Abrir Conectar IAs</a>
      </Bloco>
    </div>
  );
}
