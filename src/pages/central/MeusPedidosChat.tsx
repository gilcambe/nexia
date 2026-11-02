import { useCallback, useEffect, useState } from "react";
import { Cartao, Botao } from "./ui";
import { haQuanto } from "./api";
import { usePedidos, lerCache, guardarCache } from "../meu-cortex/api";
import type { Detalhe } from "../meu-cortex/api";
import { obterPasso, PASSOS } from "./passoPedido";

// #2895: os pedidos do dono como um chat, com a linha do tempo e o botão Aprovar, sem sair da Central.
const CHAVE = "chat-pedidos";

export default function MeusPedidosChat({ recarregar = 0 }: { recarregar?: number }) {
  const { listar, abrir, agir } = usePedidos();
  const [itens, setItens] = useState<Detalhe[]>(() => lerCache<Detalhe[]>(CHAVE) || []);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const l = await listar("", "abertos", 1);
      const det = await Promise.all(l.itens.slice(0, 8).map((i) => abrir(i.numero)));
      setItens(det);
      guardarCache(CHAVE, det);
    } catch (e) { setMsg((e as Error).message); }
  }, [listar, abrir]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar, recarregar]);

  const fazer = async (corpo: Record<string, unknown>) => {
    setOcupado(true);
    try { const r = await agir(corpo); setMsg(r.mensagem); await carregar(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <Cartao titulo="Meus pedidos" aberto>
      {!itens.length && <p className="text-sm text-nexia-muted">Nenhum pedido aberto. Escreva um pedido acima.</p>}
      <div className="space-y-4" data-testid="chat-pedidos">
        {itens.map((d) => {
          const passo = obterPasso(d);
          const atual = PASSOS.findIndex((x) => x.id === passo);
          const pronto = d.prs.find((p) => p.estado === "aberto" && p.ci === "verde");
          return (
            <div key={d.numero} className="space-y-2">
              <div className="ml-8 rounded-2xl rounded-br-sm bg-nexia-cyan/20 p-3 text-sm text-white break-words">
                {d.titulo}<span className="block text-xs text-nexia-muted mt-1">#{d.numero} · {haQuanto(d.criado)}</span>
              </div>
              <div className="mr-8 rounded-2xl rounded-bl-sm bg-nexia-surface2 p-3 text-sm space-y-2">
                {passo === "travado" ? (
                  <>
                    <p>🛑 Travado. O Cortex não conseguiu sozinho.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Botao disabled={ocupado} onClick={() => fazer({ acao: "tentar", n: d.numero })}>🔁 Tentar de novo</Botao>
                      <Botao disabled={ocupado} onClick={() => fazer({ acao: "jules", n: d.numero })}>🤝 Pedir ao Jules</Botao>
                    </div>
                  </>
                ) : (
                  <ol className="flex flex-wrap gap-1 text-xs" data-testid="chat-passos">
                    {PASSOS.map((x, i) => (
                      <li key={x.id} className={`rounded-full px-2 py-1 ${i === atual ? "bg-nexia-cyan text-black font-bold" : i < atual ? "bg-emerald-900 text-emerald-200" : "bg-nexia-surface text-nexia-muted"}`}>{x.nome}</li>
                    ))}
                  </ol>
                )}
                {pronto && !pronto.automerge && pronto.ramo.startsWith("nexia/") && (
                  <Botao tipo="forte" disabled={ocupado} testid="chat-aprovar"
                    onClick={() => confirm("Aprovar? Entra no app quando os testes passarem.") && fazer({ acao: "juntar", pr: pronto.numero })}>👍 Aprovar</Botao>
                )}
                {pronto?.automerge && <p className="text-xs text-emerald-400">Aprovado: entra sozinho em alguns minutos.</p>}
              </div>
            </div>
          );
        })}
      </div>
      {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
    </Cartao>
  );
}
