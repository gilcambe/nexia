import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";
import type { Dados, Tarefa } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Numero, Botao, Carregando, Sinal } from "./ui";

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
  const gratisOk = !d.cotas?.frear;
  const temTravadas = (x?.travadas?.length || 0) > 0;
  const degrauAtivo = !gratisOk ? 3 : temTravadas ? 2 : 1;

  return (
    <div className="space-y-4">
      <Cartao titulo="Escada das IAs" icone="ia" resumo={`Degrau ${degrauAtivo} de 3 ativo agora`}>
        <p className="text-xs text-nexia-muted">
          Regra: primeiro o Cortex, depois as IAs grátis ajudantes, e só por último o Claude Code.
        </p>
        <ol className="space-y-2 text-sm font-medium">
          <li className="flex items-center justify-between rounded-xl bg-nexia-surface2 p-3">
            <span className="flex items-center gap-2">
              <span className="text-nexia-muted font-normal">1.</span>
              <span>Cortex</span>
            </span>
            {degrauAtivo === 1 && <span className="text-xs font-bold text-nexia-cyan">← agora</span>}
          </li>
          <li className="flex items-center justify-between rounded-xl bg-nexia-surface2 p-3">
            <span className="flex items-center gap-2">
              <span className="text-nexia-muted font-normal">2.</span>
              <span>IAs grátis</span>
              <Sinal cor={gratisOk ? "verde" : "vermelho"} />
            </span>
            {degrauAtivo === 2 && <span className="text-xs font-bold text-nexia-cyan">← agora</span>}
          </li>
          <li className="flex items-center justify-between rounded-xl bg-nexia-surface2 p-3">
            <span className="flex items-center gap-2">
              <span className="text-nexia-muted font-normal">3.</span>
              <span>Claude Code</span>
              <span className="text-xs text-nexia-muted font-normal">(se as grátis acabarem)</span>
            </span>
            {degrauAtivo === 3 && <span className="text-xs font-bold text-nexia-cyan">← agora</span>}
          </li>
        </ol>
      </Cartao>
      <Cartao titulo="Pedir ao Cortex" aberto>
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
          <Cartao titulo="Fazendo agora" icone="cortex" resumo={x.fazendo.length ? x.fazendo[0].titulo : "Nada rodando"}><Lista itens={x.fazendo} vazio="Nada rodando neste momento." /></Cartao>
          <Cartao titulo="Travadas (precisam de ajuda)" icone="alerta" resumo={x.travadas.length ? `${x.travadas.length} travada(s)` : "Nenhuma travada"}><Lista itens={x.travadas} vazio="Nenhuma travada. 🎉" /></Cartao>
          <Cartao titulo="Últimas entregas" icone="ok" resumo={`${x.feitas7} entregues em 7 dias`}><Lista itens={x.ultimas} vazio="Nenhuma entrega nos últimos 7 dias." /></Cartao>
          <Cartao titulo="Próximas da fila" icone="lista" resumo={`${x.naFila} esperando`}><Lista itens={x.proximas} vazio="Fila vazia." /></Cartao>
          <ContasReserva />
        </>
      )}
    </div>
  );
}
