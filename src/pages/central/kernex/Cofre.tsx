import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import { haQuanto } from "./regras";

// #3219 parte 8: Cofre. Só nomes e quando foram trocados. O valor nunca aparece.
export default function Cofre() {
  const { cofre } = usePedidos();
  const [d, setD] = useState<{ segredos: { name: string; updated_at: string }[]; conferidoEm: string; origem: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { cofre<NonNullable<typeof d>>().then(setD).catch((e) => setErro((e as Error).message)); }, [cofre]);
  const velho = (iso: string) => Date.now() - Date.parse(iso) > 180 * 864e5;
  const lista = d?.segredos || [];
  return (
    <div className="kx-tela">
    <div className="kx-kpis" data-testid="kx-kpis-cofre">
      <Kpi cor="az" icone="cadeado" valor={d ? lista.length : null} rotulo="Chaves guardadas" sub="só os nomes aparecem" />
      <Kpi cor="vd" icone="check" valor={d ? lista.filter((s) => !velho(s.updated_at)).length : null} rotulo="Trocadas há menos de 6 meses" />
      <Kpi cor="lj" icone="alerta" valor={d ? lista.filter((s) => velho(s.updated_at)).length : null} rotulo="Mais de 6 meses sem troca" sub="bom trocar" />
      <Kpi cor="rx" icone="relogio" valor={d && lista.length ? haQuanto(lista.map((s) => s.updated_at).sort().slice(-1)[0]) : null} rotulo="Última troca" />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr" }}>
      <Bloco icone="cadeado" corIcone="#fbbf24" titulo="Chaves guardadas" ajuda="Nomes das chaves do sistema e quando foram trocadas. Amarelo: mais de 6 meses sem troca." fonte={d ? d.origem : null} atualizadoEm={d?.conferidoEm || null}>
        <p className="kx-mut" style={{ whiteSpace: "normal" }}>O valor das chaves nunca aparece aqui. {erro}</p>
        <ul className="kx-lista" data-testid="kx-cofre" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 6 }}>
          {(d?.segredos || []).map((s) => <li key={s.name}><span className="kx-bola" style={{ width: 10, height: 10, background: velho(s.updated_at) ? "#f59e0b" : "#22c55e" }} /><b className="kx-titulo">{s.name}</b><span className="kx-mut">trocada {haQuanto(s.updated_at)}</span></li>)}
        </ul>
      </Bloco>
    </div>
    </div>
  );
}
