import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import type { Painel } from "./Inicio";
import { porDiaEIa } from "./regras";

// #3219 parte 8: Relatórios. Últimos 7 dias, por dia (colunas) e por IA (barras), e baixar CSV.
interface Item { numero: number; titulo: string; quando: string; ia?: string | null; estado?: string }
const CORES = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#22d3ee"];
export default function Relatorios({ painel }: { painel?: Painel }) {
  const { listar } = usePedidos();
  const [feitas, setFeitas] = useState<Item[] | null>(null);
  const [em, setEm] = useState<string | null>(null);
  useEffect(() => {
    listar("", "concluidas", 1).then((a) => { setFeitas(a.itens as unknown as Item[]); setEm(new Date().toISOString()); }).catch(() => setFeitas([]));
  }, [listar]);
  const r = porDiaEIa(feitas || []);
  const total = r.dias.reduce((s, d) => s + d.n, 0);
  const maior = Math.max(1, ...r.dias.map((d) => d.n));
  const maiorIa = Math.max(1, ...r.ias.map((d) => d.n));
  const c = painel?.ias?.contagens;
  const baixar = () => {
    const linhas = ["numero;titulo;ia;quando", ...(feitas || []).map((t) => `${t.numero};"${t.titulo.replace(/"/g, "'")}";${t.ia || ""};${t.quando}`)];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([linhas.join("\n")], { type: "text/csv" })); a.download = "kernex-tarefas.csv"; a.click();
  };
  const fonte = feitas ? "issues concluídas da fila do Cortex (última página)" : null;
  return (
    <div className="kx-tela">
      <div className="kx-kpis" data-testid="kx-kpis-relatorios">
        <Kpi cor="vd" icone="check" valor={feitas ? total : null} rotulo="Concluídas em 7 dias" />
        <Kpi cor="az" icone="grafico" valor={feitas ? (total / 7).toFixed(1).replace(".", ",") : null} rotulo="Média por dia" />
        <Kpi cor="rx" icone="ia" valor={feitas ? r.ias[0]?.ia || "ninguém" : null} rotulo="IA que mais fez" sub={r.ias[0] ? `${r.ias[0].n} tarefas` : undefined} />
        <Kpi cor="lj" icone="raio" valor={c ? c.travada || 0 : null} rotulo="Travadas agora" sub={c ? `${c.precisaVoce || 0} precisam de você` : undefined} />
      </div>
      <div className="kx-grade" style={{ gridTemplateColumns: "3fr 2fr" }}>
        <Bloco icone="grafico" titulo="Concluídas por dia" ajuda="Tarefas fechadas como feitas nos últimos 7 dias (hora de Brasília)." fonte={fonte} atualizadoEm={em}>
          <div className="kx-colunas" data-testid="kx-colunas">
            {r.dias.slice().reverse().map((d) => (
              <div key={d.dia}><b style={{ fontSize: 13 }}>{d.n}</b><i style={{ height: Math.round((d.n / maior) * 100) + "%" }} /><span>{d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}</span></div>
            ))}
          </div>
        </Bloco>
        <Bloco icone="ia" corIcone="#a78bfa" titulo="Por IA" ajuda="Quem fez as tarefas concluídas." fonte={fonte} atualizadoEm={em}>
          <ul className="kx-lista">{r.ias.map((d, i) => (
            <li key={d.ia} style={{ minHeight: 30 }}><span className="kx-titulo" style={{ flex: "0 0 36%" }}>{d.ia}</span>
              <span className="kx-barra"><i style={{ width: Math.round((d.n / maiorIa) * 100) + "%", background: CORES[i % CORES.length] }} /></span><b style={{ width: 28, textAlign: "right" }}>{d.n}</b></li>
          ))}</ul>
          {feitas && !r.ias.length && <p className="kx-sem">Nenhuma concluída nos últimos 7 dias.</p>}
          <button type="button" className="kx-btn" style={{ marginTop: 10 }} onClick={baixar}>Baixar planilha (CSV)</button>
        </Bloco>
      </div>
    </div>
  );
}
