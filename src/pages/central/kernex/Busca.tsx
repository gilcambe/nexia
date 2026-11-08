import { useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import { buscarTelas, type TelaId } from "./regras";

// #3219 parte 9: busca Ctrl+K. Acha telas (sem acento também) e tarefas; 1 clique leva ao lugar.
export default function Busca({ ir }: { ir: (t: TelaId) => void }) {
  const { listar } = usePedidos();
  const [q, setQ] = useState("");
  const [tarefas, setTarefas] = useState<{ numero: number; titulo: string; link: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) { setTarefas([]); return; }
    const t = setTimeout(() => listar(q, "todos", 1).then((r) => setTarefas(r.itens.slice(0, 6))).catch(() => setTarefas([])), 300);
    return () => clearTimeout(t);
  }, [q, listar]);
  const telas = buscarTelas(q);
  const aberto = q.trim().length > 0;
  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 520 }}>
      <input id="kx-busca" className="kx-busca" style={{ width: "100%", maxWidth: "none" }} placeholder="Buscar telas e tarefas (Ctrl+K)" aria-label="Buscar" value={q}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && telas[0]) { ir(telas[0].id); setQ(""); } }} />
      {aberto && (
        <div data-testid="kx-busca-res" style={{ position: "absolute", top: 42, left: 0, right: 0, background: "var(--card)", border: "1px solid var(--linha)", borderRadius: 12, padding: 8, zIndex: 10 }}>
          {telas.length > 0 && <p className="kx-mut" style={{ margin: "0 0 4px" }}>Telas</p>}
          {telas.map((t) => <button key={t.id} type="button" className="kx-linha-tarefa" onClick={() => { ir(t.id); setQ(""); }}>{t.icone} {t.nome}</button>)}
          {tarefas.length > 0 && <p className="kx-mut" style={{ margin: "6px 0 4px" }}>Tarefas</p>}
          {tarefas.map((t) => <a key={t.numero} className="kx-linha-tarefa" href={t.link} target="_blank" rel="noreferrer">#{t.numero} {t.titulo}</a>)}
          {!telas.length && !tarefas.length && <p className="kx-mut" style={{ margin: 0 }}>{q.trim().length < 3 ? "Digite mais um pouco…" : "Nada encontrado."}</p>}
        </div>
      )}
    </div>
  );
}
