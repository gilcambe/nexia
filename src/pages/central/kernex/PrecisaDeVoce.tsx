import Icone from "./Icone";
import type { Acao } from "./donos";
import type { TelaId } from "./regras";

// Lista do que só o dono pode fazer: cada item com os passos numerados e um botão. Vazio = "Nada esperando você".
export default function PrecisaDeVoce({ acoes, ir, max }: { acoes: Acao[] | null; ir: (t: TelaId) => void; max?: number }) {
  if (!acoes) return <p className="kx-mut">Conferindo…</p>;
  if (!acoes.length) return <p style={{ display: "flex", gap: 8, alignItems: "center" }}><Icone nome="check" cor="#22c55e" />Nada esperando você. As tarefas travadas as IAs resolvem sozinhas.</p>;
  return (
    <div data-testid="kx-precisa" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {acoes.slice(0, max || acoes.length).map((a) => (
        <div key={a.id} className="kx-passos">
          <b style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><Icone nome="alerta" cor="#f87171" />{a.titulo}</b>
          <ol>{a.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
          {a.botao.href
            ? <a className="kx-btn vermelho" href={a.botao.href} target="_blank" rel="noreferrer">{a.botao.texto}</a>
            : <button type="button" className="kx-btn vermelho" onClick={() => a.botao.tela && ir(a.botao.tela)}>{a.botao.texto}</button>}
        </div>
      ))}
      {max && acoes.length > max && <p className="kx-mut">E mais {acoes.length - max}. Veja todos em Tarefas.</p>}
    </div>
  );
}
