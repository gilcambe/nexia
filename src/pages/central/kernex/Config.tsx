import { useState } from "react";
import Bloco from "./Bloco";
import Icone from "./Icone";

// #3219 parte 8: Configurações. Guardadas só neste aparelho.
const ler = (k: string, p: string) => { try { return localStorage.getItem("kx:" + k) || p; } catch { return p; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem("kx:" + k, v); } catch { /* bloqueado: segue sem guardar */ } };
const Ico = ({ nome, fundo }: { nome: string; fundo: string }) => <span style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: fundo, flexShrink: 0 }}><Icone nome={nome} tam={22} cor="#fff" /></span>;

export default function Config() {
  const [densidade, setDensidade] = useState(() => ler("densidade", "normal"));
  const [ausente, setAusente] = useState(() => ler("ausente", "nao") === "sim");
  return (
    <div className="kx-ladrilhos" data-testid="kx-config">
      <Bloco icone="engrenagem" titulo="Jeito da tela" ajuda="Compacto mostra mais linhas na tela." fonte="este aparelho" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="lista" fundo="linear-gradient(135deg,#3b82f6,#1d4ed8)" />
          <div className="kx-chips">{["normal", "compacto"].map((x) => <button key={x} type="button" className="kx-chip" aria-pressed={densidade === x} onClick={() => { setDensidade(x); gravar("densidade", x); }}>{x === "normal" ? "Normal" : "Compacto"}</button>)}</div></div>
      </Bloco>
      <Bloco icone="pausa" titulo="Estou ausente" ajuda="Ligado: só avisa você se for algo crítico." fonte="este aparelho" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="relogio" fundo="linear-gradient(135deg,#8b5cf6,#6d28d9)" />
          <button type="button" className={"kx-btn" + (ausente ? " roxo" : "")} onClick={() => { setAusente(!ausente); gravar("ausente", ausente ? "nao" : "sim"); }}>{ausente ? "Ligado: só o crítico" : "Desligado"}</button></div>
      </Bloco>
      <Bloco icone="sino" titulo="Avisos no celular" ajuda="Receber aviso quando uma tarefa termina ou trava." fonte="avisos do Cortex" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="sino" fundo="linear-gradient(135deg,#ef4444,#b91c1c)" /><a className="kx-btn forte" href="/cortex">Ligar avisos</a></div>
      </Bloco>
      <Bloco icone="ia" titulo="IAs conectadas" ajuda="Colocar ou trocar as chaves das IAs grátis." fonte="Conectar IAs" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="ia" fundo="linear-gradient(135deg,#22c55e,#15803d)" /><a className="kx-btn" href="/central?antiga=1#sistema">Abrir Conectar IAs</a></div>
      </Bloco>
      <Bloco icone="foguete" titulo="Central antiga" ajuda="A Central de antes continua funcionando enquanto esta é a nova." fonte="links fixos" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="casa" fundo="linear-gradient(135deg,#334155,#1e293b)" /><a className="kx-btn" href="/central?antiga=1">Abrir a Central antiga</a></div>
      </Bloco>
    </div>
  );
}
