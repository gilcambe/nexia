import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";

// #3219 parte 5: Projetos. % só com prova (PR, teste ou link), e o que falta.
interface Projeto { id: string; nome: string; link: string; definido: boolean; pct: number; feitos: { texto: string; evidencia: string }[]; faltam: { texto: string; quem: string }[] }
interface Dados { projetos: Projeto[]; conferidoEm: string; origem: string }

export default function Projetos() {
  const { projetos } = usePedidos();
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { projetos<Dados>().then((x) => { setD(x); setSel(x.projetos[0]?.id || null); }).catch((e) => setErro((e as Error).message)); }, [projetos]);
  const p = d?.projetos.find((x) => x.id === sel);
  const lista = d?.projetos || [];
  const definidos = lista.filter((x) => x.definido);
  const media = definidos.length ? Math.round(definidos.reduce((s, x) => s + x.pct, 0) / definidos.length) : null;
  return (
    <div className="kx-tela">
    <div className="kx-kpis" data-testid="kx-kpis-projetos">
      <Kpi cor="az" icone="pasta" valor={d ? lista.length : null} rotulo="Projetos" />
      <Kpi cor="vd" icone="check" valor={d ? definidos.length : null} rotulo="Com roteiro aprovado" sub={d && !definidos.length ? "falta você aprovar os itens" : undefined} />
      <Kpi cor="rx" icone="grafico" valor={media === null ? null : media + "%"} rotulo="Média feita (com prova)" />
      <Kpi cor="lj" icone="lista" valor={d ? definidos.reduce((s, x) => s + x.faltam.length, 0) : null} rotulo="Itens faltando" />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "2fr 3fr" }}>
      <Bloco icone="pasta" titulo="Projetos" ajuda="A porcentagem só sobe quando um item tem prova: PR juntado, teste passando ou link." fonte={d ? d.origem : null} atualizadoEm={d?.conferidoEm || null}>
        {erro && <p className="kx-mut">{erro}</p>}
        <ul className="kx-lista" data-testid="kx-projetos">
          {(d?.projetos || []).map((x) => (
            <li key={x.id}>
              <button type="button" className="kx-linha-tarefa" aria-current={x.id === sel} onClick={() => setSel(x.id)}>
                <b className="kx-titulo">{x.nome || x.id}</b>
                {x.definido ? <><span style={{ width: 90, height: 8, background: "#1e2c55", borderRadius: 4, overflow: "hidden" }}><span style={{ display: "block", width: x.pct + "%", height: "100%", background: "linear-gradient(90deg,#22c55e,#10b981)" }} /></span><span className="kx-mut">{x.pct}% · faltam {x.faltam.length}</span></>
                  : <span className="kx-mut">roteiro não definido</span>}
              </button>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco icone="grafico" corIcone="#34d399" titulo={p ? p.nome || p.id : "Projeto"} ajuda="O que já tem prova e o que falta, com quem faz." fonte={p ? "docs/roadmaps/" + p.id + ".md" : null} atualizadoEm={d?.conferidoEm || null}>
        {p && !p.definido && <p data-testid="kx-sem-roteiro">Roteiro ainda não definido. Peça para montar a lista deste projeto e aprove de uma vez.</p>}
        {p && p.definido && (
          <>
            <p className="kx-num">{p.pct}%</p>
            <h3 style={{ fontSize: 14, margin: "6px 0" }}>O que falta</h3>
            <ul className="kx-lista">{p.faltam.slice(0, 8).map((f, i) => <li key={i}><span className="kx-titulo">{f.texto}</span><span className="kx-mut">{f.quem}</span></li>)}</ul>
          </>
        )}
        {p && <a className="kx-btn" style={{ marginTop: 8 }} href={p.link} target="_blank" rel="noreferrer">Ver roteiro no GitHub</a>}
      </Bloco>
    </div>
    </div>
  );
}
