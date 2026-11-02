import { useCallback, useEffect, useState } from "react";
import { useCentral, haQuanto } from "./api";
import type { FaltaItem, OQueFaltaDados } from "./api";
import { Cartao, Numero, Carregando, Botao } from "./ui";

// #2873: Central Kernex, aba "O que falta". Tudo numa página: o que espera você, o que está com o Cortex e o que ficou pronto (72 h).
// Atualiza sozinha a cada 60 s.
function Linha({ x, children }: { x: FaltaItem; children?: React.ReactNode }) {
  return (
    <li>
      <a href={x.link} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-nexia-surface2 p-3 text-sm" data-testid={`falta-${x.numero}`}>
        <span className="text-nexia-muted">#{x.numero}</span> {x.urgente && <span title="Urgente">🔥 </span>}{x.titulo}
        {children}
        <span className="block text-xs text-nexia-muted mt-1">{x.motivo ? `${x.motivo} · ` : ""}{haQuanto(x.quando)}</span>
      </a>
    </li>
  );
}

export default function OQueFalta() {
  const { buscar } = useCentral();
  const [d, setD] = useState<OQueFaltaDados | null>(null);
  const [erro, setErro] = useState<string>();
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const carregar = useCallback(async () => {
    try { setD(await buscar("oQueFalta")); setErro(undefined); } catch (e) { setErro((e as Error).message); }
  }, [buscar]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  if (!d) return <Carregando erro={erro} />;
  const r = d.resumo;
  const lista = mostrarTudo ? d.comCortex : d.comCortex.slice(0, 25);
  return (
    <div className="space-y-4" data-testid="aba-o-que-falta">
      {r.pausada && <p className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm">⏸️ A fila do Cortex está pausada (alguma tarefa tem o rótulo fila-pausada). Nada novo começa até tirar.</p>}
      <div className="grid grid-cols-3 gap-2">
        <Numero valor={r.esperandoVoce} rotulo="🙋 Esperando você" destaque={r.esperandoVoce > 0} />
        <Numero valor={r.rodando} rotulo="🤖 Fazendo agora" />
        <Numero valor={r.prontos72h} rotulo="✅ Pronto (72 h)" />
      </div>
      <p className="text-xs text-nexia-muted">{r.pedidos} pedidos com o Cortex ({r.urgentes} urgentes), {r.partesNaFila} partes na fila, {r.travadas} travadas. Atualizado {haQuanto(d.em)}.</p>

      <Cartao titulo="🙋 Esperando você">
        {!d.esperandoVoce.length ? <p className="text-sm text-nexia-muted">Nada depende de você agora.</p> : (
          <ul className="space-y-2">{d.esperandoVoce.map((x) => <Linha key={x.numero} x={x} />)}</ul>
        )}
      </Cartao>

      <Cartao titulo="🤖 Com o Cortex">
        <ul className="space-y-2">
          {lista.map((x) => (
            <Linha key={x.numero} x={x}>
              {x.partes && (
                <span className="block mt-2">
                  <span className="block h-2 rounded-full bg-slate-200 overflow-hidden"><span className="block h-2 bg-emerald-500" style={{ width: `${Math.round((x.partes.prontas / Math.max(1, x.partes.total)) * 100)}%` }} /></span>
                  <span className="block text-xs text-nexia-muted mt-1">{x.partes.prontas} de {x.partes.total} partes prontas</span>
                </span>
              )}
            </Linha>
          ))}
        </ul>
        {d.comCortex.length > 25 && <Botao onClick={() => setMostrarTudo(!mostrarTudo)}>{mostrarTudo ? "Mostrar menos" : `Ver todos (${d.comCortex.length})`}</Botao>}
      </Cartao>

      <Cartao titulo="✅ Pronto nas últimas 72 h">
        {!d.prontos.length ? <p className="text-sm text-nexia-muted">Nada fechado nas últimas 72 h.</p> : (
          <ul className="space-y-2">{d.prontos.map((x) => <Linha key={`${x.tipo}-${x.numero}`} x={x} />)}</ul>
        )}
      </Cartao>
    </div>
  );
}
