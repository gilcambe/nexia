import { useCallback, useEffect, useState } from "react";
import { usePedidos, type Filtro } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import type { Painel } from "./Inicio";
import { CHIPS, COR_ESTADO, haQuanto, hora, type TelaId } from "./regras";
import { comoResolver } from "./comoResolver";
import PrecisaDeVoce from "./PrecisaDeVoce";

// #3219 parte 3: Tarefas. Lista com chips à esquerda, história da tarefa à direita, ações em lote.
interface Item { numero: number; titulo: string; estado?: string; texto?: string; icone?: string; cor?: string; ia?: string | null; motivo?: string; quando: string; link: string }
interface Passo { quando: string; icone: string; texto: string; link?: string }
interface Detalhe extends Item { linha?: Passo[]; prs?: { numero: number; link: string; estado: string }[] }

export function Selo({ t }: { t: Pick<Item, "texto" | "icone" | "cor"> }) {
  if (!t.texto) return null;
  return <span className="kx-selo" data-testid="kx-selo" style={{ background: COR_ESTADO[t.cor || "cinza"] || "#64748b" }}>{t.icone} {t.texto}</span>;
}

export default function Tarefas({ painel, ir }: { painel?: Painel; ir?: (t: TelaId) => void }) {
  const { listar, abrir, agir } = usePedidos();
  const [chip, setChip] = useState<Filtro>("meus");
  const [q, setQ] = useState("");
  const [itens, setItens] = useState<Item[] | null>(null);
  const [em, setEm] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Detalhe | null>(null);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await listar(q, chip, 1);
      setItens(r.itens as unknown as Item[]);
      setEm(new Date().toISOString());
    } catch (e) { setMsg((e as Error).message); setItens([]); }
  }, [listar, q, chip]);
  useEffect(() => { const t = setTimeout(carregar, 300); const i = setInterval(carregar, 60000); return () => { clearTimeout(t); clearInterval(i); }; }, [carregar]);

  const ver = async (n: number) => { try { setAberto((await abrir(n)) as unknown as Detalhe); } catch (e) { setMsg((e as Error).message); } };
  const fazer = async (acao: string, ns: number[]) => {
    setMsg("Fazendo…");
    try {
      const r = ns.length > 1 ? await agir({ acao: "lote", tipo: acao, ns }) : await agir({ acao, n: ns[0] });
      setMsg(r.mensagem + (r.assumiu && r.assumiu.length ? " " + r.assumiu.map((a) => `${a.ia} pegou #${a.numero}.`).join(" ") : ""));
    } catch (e) { setMsg((e as Error).message); }
    setMarcadas([]);
    carregar();
    if (aberto) ver(aberto.numero);
  };
  const marcar = (n: number) => setMarcadas((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));

  const c = painel?.ias?.contagens;
  return (
    <div className="kx-tela">
    <div className="kx-kpis" data-testid="kx-kpis-tarefas">
      <Kpi cor="az" icone="lista" valor={c ? (c.andamento || 0) + (c["aguardando-ia"] || 0) : null} rotulo="Em andamento" sub="toque para ver" ativo={chip === "andamento"} onClick={() => setChip("andamento")} />
      <Kpi cor="rx" icone="raio" valor={c ? c.travada || 0 : null} rotulo="Travadas" sub="as IAs tentam de novo" ativo={chip === "travadas"} onClick={() => setChip("travadas")} />
      <Kpi cor="vm" icone="sino" valor={painel?.dono ? painel.dono.length : null} rotulo="Precisam de você" sub="com o passo a passo" ativo={chip === "precisa"} onClick={() => setChip("precisa")} />
      <Kpi cor="vd" icone="check" valor={c ? c.concluida || 0 : null} rotulo="Concluídas hoje" ativo={chip === "concluidas"} onClick={() => setChip("concluidas")} />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "minmax(320px,2fr) 3fr" }}>
      <Bloco icone="lista" corIcone="#fb923c" titulo="Tarefas" ajuda="Escolha um filtro. Clique numa tarefa para ver a história dela ao lado." fonte={itens ? "issues do GitHub (fila do Cortex)" : null} atualizadoEm={em}>
        <div className="kx-chips" style={{ marginBottom: 8 }}>
          {CHIPS.map((c) => <button key={c.id} type="button" className="kx-chip" aria-pressed={chip === c.id} onClick={() => setChip(c.id as Filtro)} data-testid={"kx-chip-" + c.id}>{c.nome}</button>)}
        </div>
        <input className="kx-busca" style={{ width: "100%", maxWidth: "none", marginBottom: 8 }} placeholder="Procurar tarefa" value={q} onChange={(e) => setQ(e.target.value)} />
        {marcadas.length > 0 && (
          <div className="kx-chips" style={{ marginBottom: 8 }} data-testid="kx-lote">
            <b>{marcadas.length} marcadas:</b>
            <button type="button" className="kx-btn forte" onClick={() => fazer("tentar", marcadas)}>Tentar de novo</button>
            <button type="button" className="kx-btn" onClick={() => fazer("outra-ia", marcadas)}>Passar para outra IA</button>
            <button type="button" className="kx-btn" onClick={() => fazer("priorizar", marcadas)}>Priorizar</button>
            <button type="button" className="kx-btn" onClick={() => { if (confirm("Cancelar as tarefas marcadas?")) fazer("cancelar", marcadas); }}>Cancelar</button>
          </div>
        )}
        {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
        {chip === "precisa" && <PrecisaDeVoce acoes={painel?.dono || null} ir={(t) => ir?.(t)} />}
        {chip !== "precisa" && <ul className="kx-lista" data-testid="kx-tarefas">
          {(itens || []).slice(0, 14).map((t) => (
            <li key={t.numero}>
              <input type="checkbox" aria-label={"Marcar #" + t.numero} checked={marcadas.includes(t.numero)} onChange={() => marcar(t.numero)} style={{ width: 18, height: 18 }} />
              <button type="button" className="kx-linha-tarefa" aria-current={aberto?.numero === t.numero} onClick={() => ver(t.numero)}>
                <Selo t={t} /><span className="kx-titulo">#{t.numero} {t.titulo}</span><span className="kx-mut">{t.ia ? t.ia + " · " : ""}{haQuanto(t.quando)}</span>
              </button>
            </li>
          ))}
          {itens && itens.length === 0 && <li>Nenhuma tarefa aqui.</li>}
        </ul>}
      </Bloco>
      <Bloco icone="relogio" titulo={aberto ? `Tarefa #${aberto.numero}` : "História da tarefa"} ajuda="Quando entrou, qual IA pegou, tentativas, PR e como está agora." fonte={aberto ? "issue e timeline do GitHub" : null} atualizadoEm={aberto ? new Date().toISOString() : null}>
        {aberto && (
          <div data-testid="kx-detalhe" style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Selo t={aberto} /><b className="kx-titulo">{aberto.titulo}</b><a className="kx-btn" href={aberto.link} target="_blank" rel="noreferrer">Abrir no GitHub</a></div>
            {aberto.estado === "travada" && (
              <div className="kx-caixa-travada" data-testid="kx-travada">
                {(() => { const s = comoResolver(aberto.motivo); return (
                  <div data-testid="kx-como-resolver" style={{ marginBottom: 8, whiteSpace: "normal" }}>
                    <p style={{ margin: "0 0 4px" }}><b>Por que parou:</b> {s.causa}</p>
                    <p style={{ margin: "0 0 4px" }}><b>Como resolver</b>{s.precisaDono ? " (precisa de você):" : " (o Cortex resolve sozinho):"}</p>
                    <ol style={{ margin: 0, paddingLeft: 20 }}>{s.passos.map((p) => <li key={p}>{p}</li>)}</ol>
                  </div>
                ); })()}
                <div className="kx-chips">
                  <button type="button" className="kx-btn forte" onClick={() => fazer("tentar", [aberto.numero])}>Tentar de novo</button>
                  <button type="button" className="kx-btn" onClick={() => fazer("outra-ia", [aberto.numero])}>Passar para outra IA</button>
                  <button type="button" className="kx-btn" onClick={() => { if (confirm("Cancelar esta tarefa?")) fazer("cancelar", [aberto.numero]); }}>Cancelar</button>
                  <button type="button" className="kx-btn" onClick={() => fazer("resolvida", [aberto.numero])}>Marcar como resolvida</button>
                </div>
              </div>
            )}
            <ol className="kx-tempo" data-testid="kx-linha">
              {(aberto.linha || []).slice(-10).map((p, i) => (
                <li key={i}><span aria-hidden>{p.icone}</span> <span className="kx-mut">{hora(p.quando)}</span> {p.link ? <a href={p.link} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{p.texto}</a> : p.texto}</li>
              ))}
              {(!aberto.linha || aberto.linha.length === 0) && <li className="kx-mut">Ainda sem história para mostrar.</li>}
            </ol>
          </div>
        )}
      </Bloco>
    </div>
    </div>
  );
}
