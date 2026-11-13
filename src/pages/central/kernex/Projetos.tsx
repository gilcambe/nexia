import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";

// #3219 parte 5: Projetos. % só com prova (PR, teste ou link), e o que falta.
interface Projeto { id: string; nome: string; link: string; definido: boolean; proposto?: boolean; pct: number; feitos: { texto: string; evidencia: string }[]; faltam: { texto: string; quem: string }[] }
interface Dados { projetos: Projeto[]; conferidoEm: string; origem: string }

export default function Projetos() {
  const { projetos, agir } = usePedidos();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // 09/11 (dono): o Cortex monta o roteiro sozinho; o dono só aprova.
  const pedir = async (acao: "montar-roteiro" | "aprovar-roteiro", x: Projeto) => {
    if (acao === "aprovar-roteiro" && !confirm("Aprovar o roteiro de " + (x.nome || x.id) + "? Daí a porcentagem passa a contar.")) return;
    setOcupado(true); setMsg("Fazendo…");
    try { const r = await agir({ acao, projeto: x.id, nome: x.nome || x.id }); setMsg(r.mensagem); } catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
    setOcupado(false);
  };
  const montarTodos = async () => {
    const faltam = (d?.projetos || []).filter((x) => !x.definido && !x.proposto);
    if (!faltam.length || !confirm("Pedir ao Cortex para montar o roteiro de " + faltam.length + " projeto(s)?")) return;
    setOcupado(true); setMsg("Pedindo…");
    let ok = 0;
    for (const x of faltam) { try { await agir({ acao: "montar-roteiro", projeto: x.id, nome: x.nome || x.id }); ok++; } catch { /* segue os outros */ } }
    setMsg(`Pedi ${ok} de ${faltam.length} roteiros ao Cortex. Cada um aparece aqui com o botão Aprovar quando ficar pronto.`);
    setOcupado(false);
  };
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { projetos<Dados>().then((x) => { setD(x); setSel((x?.projetos || [])[0]?.id || null); }).catch((e) => setErro((e as Error).message)); }, [projetos]);
  const p = (d?.projetos || []).find((x) => x.id === sel);
  const lista = d?.projetos || [];
  const definidos = lista.filter((x) => x.definido);
  const media = definidos.length ? Math.round(definidos.reduce((s, x) => s + x.pct, 0) / definidos.length) : null;
  return (
    <div className="kx-tela">
    <div className="kx-kpis" data-testid="kx-kpis-projetos">
      <Kpi cor="az" icone="pasta" valor={d ? lista.length : null} rotulo="Projetos" />
      <Kpi cor="vd" icone="check" valor={d ? definidos.length : null} rotulo="Com roteiro aprovado" sub={d && lista.some((x) => !x.definido && !x.proposto) ? "toque para o Cortex montar os que faltam" : undefined} onClick={montarTodos} />
      <Kpi cor="rx" icone="grafico" valor={media === null ? null : media + "%"} rotulo="Média feita (com prova)" />
      <Kpi cor="lj" icone="lista" valor={d ? definidos.reduce((s, x) => s + (x.faltam || []).length, 0) : null} rotulo="Itens faltando" />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "2fr 3fr" }}>
      <Bloco icone="pasta" titulo="Projetos" ajuda="A porcentagem só sobe quando um item tem prova: PR juntado, teste passando ou link." fonte={d ? d.origem : null} atualizadoEm={d?.conferidoEm || null}>
        {erro && <p className="kx-mut">{erro}</p>}
        <ul className="kx-lista" data-testid="kx-projetos">
          {(d?.projetos || []).map((x) => (
            <li key={x.id}>
              <button type="button" className="kx-linha-tarefa" aria-current={x.id === sel} onClick={() => setSel(x.id)}>
                <b className="kx-titulo">{x.nome || x.id}</b>
                {x.definido ? <><span style={{ width: 90, height: 8, background: "#1e2c55", borderRadius: 4, overflow: "hidden" }}><span style={{ display: "block", width: x.pct + "%", height: "100%", background: "linear-gradient(90deg,#22c55e,#10b981)" }} /></span><span className="kx-mut">{x.pct}% · faltam {(x.faltam || []).length}</span></>
                  : <span className="kx-mut">{x.proposto ? "pronto para você aprovar" : "sem roteiro ainda"}</span>}
              </button>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco icone="grafico" corIcone="#34d399" titulo={p ? p.nome || p.id : "Projeto"} ajuda="O que já tem prova e o que falta, com quem faz." fonte={p ? "docs/roadmaps/" + p.id + ".md" : null} atualizadoEm={d?.conferidoEm || null}>
        {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }} data-testid="kx-projetos-msg">{msg}</p>}
        {p && !p.definido && !p.proposto && (
          <div className="kx-passos" data-testid="kx-sem-roteiro">
            <b>Este projeto ainda não tem a lista do que falta.</b>
            <ol><li>Toque no botão abaixo. O Cortex lê o projeto e monta a lista sozinho.</li><li>Quando ficar pronta, ela aparece aqui com o botão "Aprovar roteiro".</li></ol>
            <button type="button" className="kx-btn forte" disabled={ocupado} onClick={() => pedir("montar-roteiro", p)}>Pedir ao Cortex para montar</button>
          </div>
        )}
        {p && p.proposto && (
          <div className="kx-passos" data-testid="kx-roteiro-proposto">
            <b>O Cortex montou esta lista. Está certa?</b>
            <ul className="kx-lista" style={{ margin: "6px 0" }}>{(p.faltam || []).slice(0, 15).map((f, i) => <li key={i}><span className="kx-titulo" style={{ whiteSpace: "normal" }}>{f.texto}</span><span className="kx-mut">{f.quem}</span></li>)}</ul>
            <button type="button" className="kx-btn verde" disabled={ocupado} onClick={() => pedir("aprovar-roteiro", p)}>Aprovar roteiro</button>
            <p className="kx-mut" style={{ whiteSpace: "normal" }}>Algo errado? Use "Pedir" no menu e diga o que mudar.</p>
          </div>
        )}
        {p && p.definido && (
          <>
            <p className="kx-num">{p.pct}%</p>
            <h3 style={{ fontSize: 14, margin: "6px 0" }}>O que falta</h3>
            <ul className="kx-lista">{(p.faltam || []).slice(0, 8).map((f, i) => <li key={i}><span className="kx-titulo">{f.texto}</span><span className="kx-mut">{f.quem}</span></li>)}</ul>
          </>
        )}
        {p && <a className="kx-btn" style={{ marginTop: 8 }} href={p.link} target="_blank" rel="noreferrer">Ver roteiro no GitHub</a>}
      </Bloco>
    </div>
    </div>
  );
}
