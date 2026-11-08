import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import { porDiaEIa } from "./regras";

// #3219 parte 8: Relatórios. Últimos 7 dias, por dia e por IA, e baixar CSV.
interface Item { numero: number; titulo: string; quando: string; ia?: string | null; estado?: string }
export default function Relatorios() {
  const { listar } = usePedidos();
  const [feitas, setFeitas] = useState<Item[] | null>(null);
  const [travadas, setTravadas] = useState<Item[] | null>(null);
  const [em, setEm] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([listar("", "concluidas", 1), listar("", "travadas", 1)]).then(([a, b]) => { setFeitas(a.itens as unknown as Item[]); setTravadas(b.itens as unknown as Item[]); setEm(new Date().toISOString()); }).catch(() => setFeitas([]));
  }, [listar]);
  const r = porDiaEIa(feitas || []);
  const baixar = () => {
    const linhas = ["numero;titulo;ia;quando", ...(feitas || []).map((t) => `${t.numero};"${t.titulo.replace(/"/g, "'")}";${t.ia || ""};${t.quando}`)];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([linhas.join("\n")], { type: "text/csv" })); a.download = "kernex-tarefas.csv"; a.click();
  };
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
      <Bloco titulo="Concluídas por dia" ajuda="Tarefas fechadas como feitas nos últimos 7 dias." fonte={feitas ? "issues do GitHub (fila do Cortex)" : null} atualizadoEm={em}>
        <ul className="kx-lista">{r.dias.map((d) => <li key={d.dia}><span className="kx-titulo">{d.dia}</span><b>{d.n}</b></li>)}</ul>
      </Bloco>
      <Bloco titulo="Por IA" ajuda="Quem fez as tarefas concluídas." fonte={feitas ? "issues do GitHub (fila do Cortex)" : null} atualizadoEm={em}>
        <ul className="kx-lista">{r.ias.map((d) => <li key={d.ia}><span className="kx-titulo">{d.ia}</span><b>{d.n}</b></li>)}</ul>
        <button type="button" className="kx-btn" style={{ marginTop: 8 }} onClick={baixar}>Baixar planilha (CSV)</button>
      </Bloco>
      <Bloco titulo="Travadas agora" ajuda="Tarefas paradas neste momento." fonte={travadas ? "issues do GitHub (fila do Cortex)" : null} atualizadoEm={em}>
        <p className="kx-num" style={{ color: "#f59e0b" }}>{travadas?.length ?? 0}</p>
      </Bloco>
    </div>
  );
}
