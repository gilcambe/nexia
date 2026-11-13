import { useState } from "react";
import Bloco from "./Bloco";
import Icone from "./Icone";
import { usePedidos } from "../../meu-cortex/api";

// #3219 parte 8: Configurações. Guardadas só neste aparelho.
const ler = (k: string, p: string) => { try { return localStorage.getItem("kx:" + k) || p; } catch { return p; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem("kx:" + k, v); } catch { /* bloqueado: segue sem guardar */ } };
const Ico = ({ nome, fundo }: { nome: string; fundo: string }) => <span style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: fundo, flexShrink: 0 }}><Icone nome={nome} tam={22} cor="#fff" /></span>;

// C2-E (13/11, dono: "o ligar avisos leva pra tela do cortex"): liga os avisos aqui mesmo, igual ao Cortex.
const b64ParaBytes = (b: string) => { const x = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4)); return Uint8Array.from(x, (c) => c.charCodeAt(0)); };
function LigarAvisos() {
  const { agir } = usePedidos();
  const [msg, setMsg] = useState("");
  const pode = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ligar = async () => {
    try {
      setMsg("Ligando…");
      if ((await Notification.requestPermission()) !== "granted") { setMsg("O aparelho não deixou mostrar avisos. Libere nas configurações do navegador e toque de novo."); return; }
      const reg = (await navigator.serviceWorker.getRegistration("/cortex")) || (await navigator.serviceWorker.register("/cortex-sw.js", { scope: "/cortex" }));
      const { chave } = (await agir({ acao: "avisos_chave" })) as unknown as { chave: string };
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaBytes(chave) }));
      await agir({ acao: "avisos_assinar", sub: sub.toJSON() });
      await agir({ acao: "avisos_testar" });
      setMsg("Pronto: chegou um aviso de teste. Você vai ser avisado quando uma tarefa terminar ou travar, e um resumo às 8h.");
    } catch (e) { setMsg((e as Error).message || "Não consegui ligar os avisos."); }
  };
  return (<div style={{ display: "grid", gap: 6 }}>
    {pode ? <button type="button" className="kx-btn forte" onClick={ligar} data-testid="kx-avisos-ligar">Ligar avisos</button> : <span className="kx-mut" style={{ whiteSpace: "normal" }}>Este navegador não aceita avisos. Use o Chrome.</span>}
    {msg && <span role="status" style={{ whiteSpace: "normal" }}>{msg}</span>}</div>);
}

export default function Config({ ir }: { ir?: (t: "iainfra") => void }) {
  const [densidade, setDensidade] = useState(() => ler("densidade", "normal"));
  const [ausente, setAusente] = useState(() => ler("ausente", "nao") === "sim");
  return (
    <div className="kx-ladrilhos" data-testid="kx-config">
      <Bloco icone="engrenagem" titulo="Jeito da tela" ajuda="Compacto mostra mais linhas na tela." fonte="este aparelho" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="lista" fundo="linear-gradient(135deg,#1d5fd0,#0a2468)" />
          <div className="kx-chips">{["normal", "compacto"].map((x) => <button key={x} type="button" className="kx-chip" aria-pressed={densidade === x} onClick={() => { setDensidade(x); gravar("densidade", x); }}>{x === "normal" ? "Normal" : "Compacto"}</button>)}</div></div>
      </Bloco>
      <Bloco icone="pausa" titulo="Estou ausente" ajuda="Ligado: só avisa você se for algo crítico." fonte="este aparelho" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="relogio" fundo="linear-gradient(135deg,#1d5fd0,#0a2468)" />
          <button type="button" className={"kx-btn" + (ausente ? " roxo" : "")} onClick={() => { setAusente(!ausente); gravar("ausente", ausente ? "nao" : "sim"); }}>{ausente ? "Ligado: só o crítico" : "Desligado"}</button></div>
      </Bloco>
      <Bloco icone="sino" titulo="Avisos no celular" ajuda="Receber aviso quando uma tarefa termina ou trava." fonte="avisos do Cortex" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="sino" fundo="linear-gradient(135deg,#1d5fd0,#0a2468)" /><LigarAvisos /></div>
      </Bloco>
      <Bloco icone="ia" titulo="IAs conectadas" ajuda="Colocar ou trocar as chaves das IAs grátis." fonte="Conectar IAs" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="ia" fundo="linear-gradient(135deg,#1d5fd0,#0a2468)" />{ir ? <button type="button" className="kx-btn" onClick={() => ir("iainfra")}>Abrir IAs, chaves e robôs</button> : <a className="kx-btn" href="/central?tela=iainfra">Abrir IAs, chaves e robôs</a>}</div>
      </Bloco>
      <Bloco icone="foguete" titulo="Central antiga" ajuda="A Central de antes continua funcionando enquanto esta é a nova." fonte="links fixos" atualizadoEm={null}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ico nome="casa" fundo="linear-gradient(135deg,#1d5fd0,#0a2468)" /><a className="kx-btn" href="/central?antiga=1">Abrir a Central antiga</a></div>
      </Bloco>
    </div>
  );
}
