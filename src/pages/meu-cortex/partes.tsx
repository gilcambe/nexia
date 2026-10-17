import { useState } from "react";
import { Cartao, Botao } from "../central/ui";
import { haQuanto } from "../central/api";
import { usePedidos, NOME_SITUACAO } from "./api";
import type { Filtro, Resumo } from "./api";

// Peças do Cortex no celular: a caixa de novo pedido e a lista de pedidos.
export function NovoPedido({ enviado }: { enviado: () => void }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { criarPedido } = usePedidos();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    try {
      setEnviando(true);
      await criarPedido(texto.trim());
      setTexto("");
      enviado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Novo Pedido ao Cortex
        </label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o que deseja solicitar..."
          rows={3}
          className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        <div className="flex justify-end">
          <Botao type="submit" disabled={enviando || !texto.trim()}>
            {enviando ? "Enviando..." : "Enviar Pedido"}
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}

export function ListaPedidos({ filtro }: { filtro: Filtro }) {
  const { pedidos, carregando, erro, atualizarStatus } = usePedidos(filtro);

  if (carregando) {
    return <div className="text-center py-8 text-slate-500 text-sm">Carregando pedidos...</div>;
  }

  if (erro) {
    return <div className="text-center py-8 text-rose-500 text-sm">{erro}</div>;
  }

  if (pedidos.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">Nenhum pedido encontrado.</div>;
  }

  return (
    <div className="space-y-3">
      {pedidos.map((p: Resumo) => (
        <Cartao key={p.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {NOME_SITUACAO[p.situacao] || p.situacao}
            </span>
            <span className="text-xs text-slate-400">{haQuanto(p.criadoEm)}</span>
          </div>
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{p.texto}</p>
          {p.resposta && (
            <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-xs text-indigo-900 dark:text-indigo-200">
              <span className="font-semibold block mb-1">Resposta do Cortex:</span>
              {p.resposta}
            </div>
          )}
        </Cartao>
      ))}
    </div>
  );
}
