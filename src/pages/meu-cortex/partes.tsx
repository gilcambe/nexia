import { useState } from "react";
import { Cartao, Botao } from "../central/ui";
import { haQuanto } from "../central/api";
import { usePedidos, NOME_SITUACAO } from "./api";
import type { Filtro, Resumo } from "./api";

// Peças do Cortex no celular: a caixa de novo pedido e a lista de pedidos.
export function NovoPedido({ enviado }: { enviado: () => void }) {
  const { agir } = usePedidos();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const pedir = async () => {
    setMsg(null);
    try { const r = await agir({ acao: "pedir", texto }); setMsg(r.mensagem); setTexto(""); enviado(); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <Cartao titulo="Novo pedido ao Cortex">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={3500} data-testid="meu-cortex-pedido"
        placeholder="Diga o que o Cortex deve fazer, com o arquivo ou a página, se souber."
        className="w-full rounded-xl bg-nexia-surface2 border border-nexia-border p-3 text-sm text-white" />
      <Botao tipo="forte" onClick={pedir} disabled={texto.trim().length < 10} testid="meu-cortex-enviar">🧠 Mandar para a fila</Botao>
      {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
    </Cartao>
  );
}

export function Itens({ itens, abrir }: { itens: Resumo[]; abrir: (n: number) => void }) {
  return (
    <ul className="space-y-2">
      {itens.map((t) => (
        <li key={t.numero}>
          <button onClick={() => abrir(t.numero)} className="w-full text-left rounded-xl bg-nexia-surface p-3 text-sm border border-nexia-border" data-testid="meu-cortex-item">
            <span className="text-xs text-nexia-muted">#{t.numero} · {NOME_SITUACAO[t.situacao]} · {haQuanto(t.quando)}{t.comentarios ? ` · 💬 ${t.comentarios}` : ""}</span>
            <span className="block break-words mt-1">{t.titulo}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const FILTROS: { id: Filtro; nome: string }[] = [
  { id: "todos", nome: "Todos" }, { id: "abertos", nome: "Andando" }, { id: "travados", nome: "Travados" }, { id: "feitos", nome: "Feitos" },
];

export function Filtros({ filtro, mudar }: { filtro: Filtro; mudar: (f: Filtro) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {FILTROS.map((f) => (
        <button key={f.id} onClick={() => mudar(f.id)} data-testid={`filtro-${f.id}`}
          className={`shrink-0 rounded-full px-3 py-1 text-sm border ${filtro === f.id ? "bg-nexia-cyan text-black border-nexia-cyan" : "border-nexia-border"}`}>{f.nome}</button>
      ))}
    </div>
  );
}
