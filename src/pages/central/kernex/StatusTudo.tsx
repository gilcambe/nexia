import { useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import type { OQueFaltaDados } from "../api";
import Bloco from "./Bloco";
import Icone from "./Icone";
import { haQuanto, type TelaId } from "./regras";

// 09/11 (dono): "Onde eu vejo o status de tudo? Tem tarefas paradas há 1 dia." Painel no Início com dados reais
// (fila do Cortex, PRs, máquinas, seus pedidos), as paradas há mais de 1 dia com o MOTIVO e o botão Destravar.
const DIA = 864e5;
export function paradasHaMaisDeUmDia(tudo: OQueFaltaDados | null | undefined, agora = Date.now()) {
  return (tudo?.comCortex || []).filter((x) => !x.rodando && x.quando && agora - Date.parse(x.quando) > DIA);
}

export default function StatusTudo({ tudo, maq, meus, ir, recarregar }: {
  tudo: OQueFaltaDados | null | undefined; maq: { com: number; total: number } | null | undefined;
  meus: { estado?: string }[] | null; ir: (t: TelaId) => void; recarregar?: () => void;
}) {
  const { agir } = usePedidos();
  const [msg, setMsg] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<number[]>([]);
  const r = tudo?.resumo;
  const paradas = paradasHaMaisDeUmDia(tudo);
  const pedidos = meus ? meus.length : null;
  const prontos = meus ? meus.filter((x) => x.estado === "concluida").length : null;
  const destravar = async (n: number) => {
    setMsg("Destravando #" + n + "…");
    try { const x = await agir({ acao: "destravar", n }); setMsg(x.mensagem); setFeitos((f) => [...f, n]); recarregar?.(); } catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
  };
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v);
  const itens: [string, number | string, string, TelaId][] = [
    ["Sendo feitas agora", num(r?.rodando), "#8b5cf6", "ia"],
    ["Na fila", num(r?.pedidos), "#3b82f6", "tarefas"],
    ["Travadas (as IAs tentam de novo)", num(r?.travadas), "#f59e0b", "tarefas"],
    ["Prontas nas últimas 72 h", num(r?.prontos72h), "#22c55e", "publicacoes"],
    ["Esperando você", num(r?.esperandoVoce), "#ef4444", "tarefas"],
    ["Máquinas mandando sinal", maq ? `${maq.com} de ${maq.total}` : "—", "#06b6d4", "maquinas"],
  ];
  return (
    <Bloco className="kx-status-tudo" titulo="Status de tudo" icone="grafico" corIcone="#60a5fa"
      ajuda="Tudo num lugar só, com números reais e atualizado a cada minuto. Não precisa pedir status a ninguém." fonte={tudo ? "fila do Cortex, PRs e máquinas no GitHub e no banco" : null} atualizadoEm={tudo?.em || null}>
      {r?.pausada && <p className="kx-passos" style={{ marginBottom: 8 }}><b>A fila está PAUSADA.</b> Nada novo começa. Toque em "Voltar a rodar" lá em cima.</p>}
      <div className="kx-status-grade" data-testid="kx-status-tudo">
        {itens.map(([rotulo, valor, cor, tela]) => (
          <button key={rotulo} type="button" className="kx-status-item" onClick={() => ir(tela)} style={{ borderColor: cor + "66" }}>
            <b style={{ color: cor }}>{valor}</b><span>{rotulo}</span>
          </button>
        ))}
      </div>
      <p style={{ margin: "10px 0 4px" }} data-testid="kx-pedido-vs-feito"><b>Seus pedidos pela Central:</b> {pedidos === null ? "conferindo…" : `${prontos} prontos de ${pedidos} pedidos (os 30 mais recentes)`}</p>
      {pedidos ? <span className="kx-barra" style={{ display: "block", maxWidth: 420 }}><i style={{ width: Math.round(((prontos || 0) / pedidos) * 100) + "%" }} /></span> : null}
      <p style={{ margin: "12px 0 4px", whiteSpace: "normal" }}><b>Paradas há mais de 1 dia: {tudo ? paradas.length : "—"}</b>{paradas.length > 0 && <span className="kx-mut" style={{ whiteSpace: "normal" }}> · o motivo está em cada uma; "Destravar" põe na frente da fila</span>}</p>
      {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }} data-testid="kx-destravar-msg">{msg}</p>}
      <ul className="kx-lista" data-testid="kx-paradas">
        {paradas.slice(0, 6).map((x) => (
          <li key={x.numero}>
            <Icone nome="relogio" cor="#f59e0b" />
            <span className="kx-titulo" style={{ whiteSpace: "normal" }}><a href={x.link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>#{x.numero} {x.titulo}</a>
              <span className="kx-mut" style={{ display: "block", whiteSpace: "normal" }}>Motivo: {x.motivo || "esperando a vez na fila"} · parada {haQuanto(x.quando)}</span></span>
            <button type="button" className="kx-btn laranja" disabled={feitos.includes(x.numero)} onClick={() => destravar(x.numero)}>{feitos.includes(x.numero) ? "Destravada" : "Destravar"}</button>
          </li>
        ))}
        {tudo && paradas.length > 6 && <li className="kx-mut">E mais {paradas.length - 6}. Veja todas em Tarefas.</li>}
      </ul>
    </Bloco>
  );
}
