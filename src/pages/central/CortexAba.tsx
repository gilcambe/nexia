import { useState } from "react";
import type { Dados, Tarefa } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Numero, Botao, Carregando } from "./ui";
import ContasReserva from "../cortex/Reservas";

function Lista({ itens, vazio }: { itens: Tarefa[]; vazio: string }) {
  if (!itens.length) return <p className="text-sm text-nexia-muted">{vazio}</p>;
  return (
    <ul className="space-y-2">
      {itens.map((t) => (
        <li key={t.numero}>
          <a href={t.link} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-nexia-surface2 p-3 text-sm">
            <span className="text-nexia-muted">#{t.numero}</span> {t.titulo}
            <span className="block text-xs text-nexia-muted mt-1">{haQuanto(t.quando)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function CortexAba({ d, erro }: { d: Dados; erro?: string }) {
  const { agir } = useCentral();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pedir = async () => {
    setOcupado(true); setMsg(null);
    try { setMsg((await agir({ acao: "pedir", texto })).mensagem); setTexto(""); } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  const x = d.cortex;
  return (
    <div className="space-y-4">
      <Cartao titulo="Pedir ao Cortex">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Ex.: colocar um botão de WhatsApp no site do Studio Lima"
          className="w-full rounded-xl bg-nexia-surface2 border border-nexia-border p-3 text-sm text-white" data-testid="cortex-pedido" />
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={pedir} disabled={ocupado || texto.trim().length < 10} tipo="forte">🧠 Enviar pedido</Botao>
          <Botao href="/cortex">Abrir o Cortex</Botao>
        </div>
        {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
      </Cartao>
      {!x ? <Carregando erro={erro} /> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Numero valor={x.naFila} rotulo="esperando na fila" />
            <Numero valor={x.fazendo.length} rotulo="fazendo agora" />
            <Numero valor={x.travadas.length} rotulo="travadas" />
            <Numero valor={x.feitas7} rotulo="feitas em 7 dias" destaque />
          </div>
          <Cartao titulo="Fazendo agora"><Lista itens={x.fazendo} vazio="Nada rodando neste momento." /></Cartao>
          <Cartao titulo="Travadas (precisam de ajuda)"><Lista itens={x.travadas} vazio="Nenhuma travada. 🎉" /></Cartao>
          <Cartao titulo="Últimas entregas"><Lista itens={x.ultimas} vazio="Nenhuma entrega nos últimos 7 dias." /></Cartao>
          <Cartao titulo="Próximas da fila"><Lista itens={x.proximas} vazio="Fila vazia." /></Cartao>
          <ContasReserva />
        </>
      )}
    </div>
  );
}
