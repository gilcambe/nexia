import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";

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
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "2fr 3fr" }}>
      <Bloco titulo="Projetos" ajuda="A porcentagem só sobe quando um item tem prova: PR juntado, teste passando ou link." fonte={d ? d.origem : null} atualizadoEm={d?.conferidoEm || null}>
        {erro && <p className="kx-mut">{erro}</p>}
        <ul className="kx-lista" data-testid="kx-projetos">
          {(d?.projetos || []).map((x) => (
            <li key={x.id}>
              <button type="button" className="kx-linha-tarefa" aria-current={x.id === sel} onClick={() => setSel(x.id)}>
                <b className="kx-titulo">{x.nome || x.id}</b>
                {x.definido ? <><span style={{ width: 90, height: 8, background: "#1e2c55", borderRadius: 4, overflow: "hidden" }}><span style={{ display: "block", width: x.pct + "%", height: "100%", background: "#3b82f6" }} /></span><span className="kx-mut">{x.pct}% · faltam {x.faltam.length}</span></>
                  : <span className="kx-mut">roteiro não definido</span>}
              </button>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco titulo={p ? p.nome || p.id : "Projeto"} ajuda="O que já tem prova e o que falta, com quem faz." fonte={p ? "docs/roadmaps/" + p.id + ".md" : null} atualizadoEm={d?.conferidoEm || null}>
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
  );
}
