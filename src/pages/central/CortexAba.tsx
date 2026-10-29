import { useState } from "react";
import type { Dados, Tarefa } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Numero, Botao, Carregando, Sinal } from "./ui";
import ContasReserva from "../cortex/Reservas";

// Tipo estendido para dados extras que podem vir da API
interface CortexEstendido {
  naFila: number;
  fazendo: Tarefa[];
  travadas: Tarefa[];
  feitas7: number;
  ultimas: Tarefa[];
  proximas: Tarefa[];
  porDia?: { dia: string; feitas: number }[];
  divididos?: { numero: number; titulo: string; pct: number; prontas: number; total: number }[];
}

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
  const x = d.cortex as unknown as CortexEstendido;
  const gratisOk = !d.cotas?.frear;
  const temTravadas = (x?.travadas?.length || 0) > 0;
  const degrauAtivo = !gratisOk ? 3 : temTravadas ? 2 : 1;

  // Dados para o gráfico de rosca
  const filaVal = x?.naFila || 0;
  const fazendoVal = x?.fazendo?.length || 0;
  const travadasVal = x?.travadas?.length || 0;
  const feitas7Val = x?.feitas7 || 0;
  const totalRosca = filaVal + fazendoVal + travadasVal + feitas7Val;

  return (
    <div className="space-y-4">
      {!x ? <Carregando erro={erro} /> : (
        <>
          <Cartao titulo="Como está o Cortex" icone="cortex" resumo={totalRosca === 0 ? "Sem tarefas agora" : `${totalRosca} itens no status atual`}>
            {totalRosca === 0 ? (
              <p className="text-sm text-nexia-muted text-center py-4">Sem tarefas agora</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {(() => {
                      let acumulado = 0;
                      const r = 15.9155;
                      const circ = 100;
                      const partes = [
                        { val: filaVal, color: "text-blue-500" },
                        { val: fazendoVal, color: "text-amber-500" },
                        { val: travadasVal, color: "text-rose-500" },
                        { val: feitas7Val, color: "text-emerald-500" },
                      ];
                      return partes.map((p, idx) => {
                        if (p.val <= 0) return null;
                        const pct = (p.val / totalRosca) * 100;
                        const strokeDasharray = `${pct} ${circ - pct}`;
                        const strokeDashoffset = -acumulado;
                        acumulado += pct;
                        return (
                          <circle
                            key={idx}
                            cx="18"
                            cy="18"
                            r={r}
                            fill="none"
                            className={p.color}
                            stroke="currentColor"
                            strokeWidth="3.8"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-white">{totalRosca}</span>
                    <span className="text-[10px] text-nexia-muted uppercase">total</span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 text-xs w-full">
                  <div className="flex items-center gap-2 bg-nexia-surface2 p-2 rounded-lg">
                    <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                    <span className="text-nexia-muted truncate">Fila:</span>
                    <span className="font-bold text-white ml-auto">{filaVal}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-nexia-surface2 p-2 rounded-lg">
                    <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0"></span>
                    <span className="text-nexia-muted truncate">Em execução:</span>
                    <span className="font-bold text-white ml-auto">{fazendoVal}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-nexia-surface2 p-2 rounded-lg">
                    <span className="w-3 h-3 rounded-full bg-rose-500 flex-shrink-0"></span>
                    <span className="text-nexia-muted truncate">Travadas:</span>
                    <span className="font-bold text-white ml-auto">{travadasVal}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-nexia-surface2 p-2 rounded-lg">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"></span>
                    <span className="text-nexia-muted truncate">Entregues (7d):</span>
                    <span className="font-bold text-white ml-auto">{feitas7Val}</span>
                  </div>
                </div>
              </div>
            )}
          </Cartao>

          {x.porDia && x.porDia.length > 0 && (
            <Cartao titulo="Produtividade nos últimos dias" icone="lista" resumo="Feitas por dia">
              <div className="flex items-end justify-between gap-2 h-32 pt-6 px-2 bg-nexia-surface2 rounded-xl">
                {x.porDia.map((dItem, i) => {
                  const maxFeitas = Math.max(...x.porDia!.map(item => item.feitas), 1);
                  const alturaPct = Math.round((dItem.feitas / maxFeitas) * 100);
                  const alturaPx = Math.max(alturaPct, 8); // mínimo de 8% para aparecer
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className="text-[10px] text-nexia-cyan mb-1 opacity-0 group-hover:opacity-100 transition-opacity font-bold">{dItem.feitas}</span>
                      <div className="w-full max-w-[28px] bg-nexia-surface rounded-t-md overflow-hidden flex items-end">
                        <div 
                          className="w-full bg-nexia-cyan transition-all duration-500 rounded-t-md" 
                          style={{ height: `${alturaPx}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-nexia-muted mt-2 font-medium">{dItem.dia}</span>
                    </div>
                  );
                })}
              </div>
            </Cartao>
          )}

          {x.divididos && x.divididos.length > 0 && (
            <Cartao titulo="Pedidos grandes em andamento" icone="cortex" resumo={`${x.divididos.length} pedido(s) dividido(s)`}>
              <div className="space-y-3">
                {x.divididos.map((item) => (
                  <div key={item.numero} className="bg-nexia-surface2 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <a href={`/meu-cortex#p${item.numero}`} className="font-medium text-white hover:text-nexia-cyan transition-colors">
                        #{item.numero} - {item.titulo}
                      </a>
                      <span className="text-xs text-nexia-muted">{item.prontas} de {item.total} partes prontas</span>
                    </div>
                    <div className="w-full bg-nexia-surface rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-nexia-cyan h-full rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(Math.max(item.pct, 0), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-end text-[10px] text-nexia-muted">
                      <span>{item.pct}% concluído</span>
                    </div>
                  </div>
                ))}
              </div>
            </Cartao>
          )}
        </>
      )}

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
