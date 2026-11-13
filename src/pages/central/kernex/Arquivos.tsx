import { useEffect, useMemo, useState } from "react";
import { useCentral } from "../api";
import { haQuanto } from "./regras";

// C2-F3 (PC 2, 13/11): arquivos da empresa = só a pasta C:\KERNEX de cada PC (o agente manda o índice a cada 5 min).
// Busca por nome/pasta; "Mostrar no PC" abre o Explorador já com o arquivo marcado (nunca executa nada).
type Item = { c: string; t: number; m: string };
type Dados = { maquinas: { maquina: string; itens: Item[]; total: number; em: string | null }[] };

const sem = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : b >= 1024 ? Math.round(b / 1024) + " KB" : b + " B");
export function filtrar(itens: (Item & { maquina: string })[], busca: string) {
  const termos = sem(busca).split(/\s+/).filter(Boolean);
  return termos.length ? itens.filter((x) => termos.every((t) => sem(x.c).includes(t))) : itens;
}

export default function Arquivos() {
  const { ler, agir } = useCentral();
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { ler<Dados>("parte=arquivos").then((x) => setD({ maquinas: x?.maquinas || [] })).catch((e) => setErro((e as Error).message)); }, [ler]);
  const todos = useMemo(() => (d?.maquinas || []).flatMap((m) => (m.itens || []).map((i) => ({ ...i, maquina: m.maquina }))), [d]);
  const achados = useMemo(() => filtrar(todos, busca).slice(0, 200), [todos, busca]);
  const abrir = async (maquina: string, caminho: string) => {
    setMsg(null);
    try { const r = await agir<{ mensagem: string }>({ acao: "arquivos-abrir", maquina, caminho }); setMsg(r.mensagem); } catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
  };
  return (
    <div className="kx-tela" data-testid="kx-arquivos">
      <section className="kx-bloco" style={{ marginBottom: 12 }}>
        <input className="kx-busca" style={{ paddingLeft: 14 }} placeholder="Buscar por nome do arquivo, cliente ou pasta…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar arquivos" data-testid="kx-arquivos-busca" />
        <p className="kx-mut" style={{ whiteSpace: "normal", margin: "8px 0 0" }}>
          Aqui aparece só a pasta <b>C:\KERNEX</b> dos seus PCs (Clientes, Projetos, Marketing, Documentos-Kernex). Seus arquivos pessoais e Downloads ficam de fora.
          {(d?.maquinas || []).map((m) => ` ${m.maquina}: ${m.total} arquivo(s), atualizado ${haQuanto(m.em)}.`).join("")}
        </p>
        {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
      </section>
      {erro && <p className="kx-serve">Não deu para ler os arquivos: {erro}</p>}
      {d && !todos.length && (
        <section className="kx-bloco" data-testid="kx-arquivos-vazio" style={{ whiteSpace: "normal" }}>
          <b>Nenhum arquivo ainda</b>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
            <li>No PC, abra a pasta <b>C:\KERNEX</b> (o agente cria ela sozinho).</li>
            <li>Guarde lá os arquivos da empresa: cada cliente na sua pasta dentro de <b>Clientes</b>.</li>
            <li>Em até 5 minutos eles aparecem aqui para buscar.</li>
          </ol>
        </section>
      )}
      {achados.length > 0 && (
        <section className="kx-bloco">
          <ul className="kx-lista" data-testid="kx-arquivos-lista">
            {achados.map((x) => (
              <li key={x.maquina + x.c}>
                <span className="kx-titulo" style={{ whiteSpace: "normal" }}>{x.c}</span>
                <span className="kx-mut">{x.maquina} · {tamanho(x.t)} · {haQuanto(x.m)}</span>
                <button type="button" className="kx-btn" style={{ minHeight: 30 }} onClick={() => abrir(x.maquina, x.c)}>Mostrar no PC</button>
              </li>
            ))}
          </ul>
          {filtrar(todos, busca).length > 200 && <p className="kx-mut">Mostrando 200. Escreva mais palavras na busca para achar o que quer.</p>}
        </section>
      )}
    </div>
  );
}
