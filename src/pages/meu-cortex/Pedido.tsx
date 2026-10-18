import { useCallback, useEffect, useState } from "react";
import { Cartao, Botao, Carregando } from "../central/ui";
import { haQuanto } from "../central/api";
import { usePedidos, NOME_SITUACAO } from "./api";
import PrsDoPedido from "./PrsDoPedido";
import type { Detalhe } from "./api";

// Um pedido: a conversa inteira com o Cortex, os PRs dele e o que o dono pode fazer.
export default function Pedido({ n, voltar }: { n: number; voltar: () => void }) {
  const { abrir, agir } = usePedidos();
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string>();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(() => { setErro(undefined); abrir(n).then(setD).catch((e: Error) => setErro(e.message)); }, [abrir, n]);
  useEffect(() => { carregar(); }, [carregar]);

  const fazer = async (corpo: Record<string, unknown>) => {
    setOcupado(true); setMsg(null);
    try { setMsg((await agir(corpo)).mensagem); setTexto(""); carregar(); } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={voltar} className="text-sm text-nexia-cyan cursor-pointer" data-testid="pedido-voltar">← Todos os pedidos</button>
      {!d ? <Carregando erro={erro} /> : (
        <>
          <Cartao>
            <p className="text-xs text-nexia-muted">#{d.numero} · {NOME_SITUACAO[d.situacao]}{d.tentativas ? ` · ${d.tentativas} tentativas` : ""}</p>
            <h2 className="font-semibold break-words" data-testid="pedido-titulo">{d.titulo}</h2>
            <div className="grid grid-cols-2 gap-2">
              {d.situacao === "travado" && <Botao tipo="forte" disabled={ocupado} onClick={() => fazer({ acao: "tentar", n })} testid="pedido-tentar">🔁 Tentar de novo</Botao>}
              {d.situacao !== "feito" && d.situacao !== "fechado"
                ? <Botao disabled={ocupado} onClick={() => confirm("Cancelar este pedido?") && fazer({ acao: "cancelar", n })} testid="pedido-cancelar">✖️ Cancelar</Botao>
                : <Botao disabled={ocupado} onClick={() => fazer({ acao: "reabrir", n })} testid="pedido-reabrir">↩️ Reabrir</Botao>}
              <Botao href={d.link}>Ver no GitHub</Botao>
            </div>
            {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
          </Cartao>

          <PrsDoPedido prs={d.prs} ocupado={ocupado} aprovar={(pr) => fazer({ acao: "juntar", pr })} />

          <Cartao titulo={`Conversa (${d.conversa.length})`}>
            <ol className="space-y-3">
              {d.conversa.map((c, k) => (
                <li key={k} className="rounded-xl bg-nexia-surface2 p-3 text-sm" data-testid="pedido-fala">
                  <p className="text-xs text-nexia-muted mb-1">{c.quem === "github-actions[bot]" ? "🤖 Fila do Cortex" : c.quem} · {haQuanto(c.quando)}</p>
                  <p className="whitespace-pre-wrap break-words">{c.texto}</p>
                </li>
              ))}
            </ol>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Anotação para o histórico. O Cortex lê só o pedido: para mudar o que ele faz, mande um pedido novo."
              className="w-full rounded-xl bg-nexia-surface2 border border-nexia-border p-3 text-sm text-white" data-testid="pedido-resposta" />
            <Botao tipo="forte" disabled={ocupado || texto.trim().length < 2} onClick={() => fazer({ acao: "comentar", n, texto })} testid="pedido-responder">Guardar anotação</Botao>
          </Cartao>
        </>
      )}
    </div>
  );
}
