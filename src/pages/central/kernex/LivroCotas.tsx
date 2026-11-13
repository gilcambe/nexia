import { useEffect, useState } from "react";
import { useCentral } from "../api";
import Bloco from "./Bloco";

// #3377 (13/11/2026): livro de cotas por IA (o que o roteador gravou no D1). Sem dado = "sem dados", nunca número fixo.
interface Uso { pedidos: number; tokens: number; semCota: number }
interface Linha { provedor: string; hoje: Uso | null; ontem: Uso | null; bloqueados: { modelo: string; ate: string; motivo: string }[]; treina: string; dadoDeCliente: boolean; situacao: string }
interface Livro { linhas: Linha[]; atualizadoEm: string | null; fonte: string; aviso?: string }
const SIT: Record<string, [string, string]> = { ativa: ["Usando", "#22c55e"], ociosa: ["Parada, com cota", "#64748b"], parcial: ["Parte sem cota", "#f59e0b"], "sem-cota": ["Sem cota agora", "#ef4444"] };
const TREINA: Record<string, string> = { nao: "não treina com seus dados", sim: "treina com os dados: nunca mandar dado de cliente", depende: "depende do modelo: não mandar dado de cliente", "nao-informado": "sem informação: não mandar dado de cliente" };
const hora = (iso: string) => { try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function LivroCotas() {
  const { ler } = useCentral();
  const [l, setL] = useState<Livro | null>(null);
  useEffect(() => { ler<Livro>("parte=ias-livro").then((x) => setL({ linhas: x?.linhas || [], atualizadoEm: x?.atualizadoEm || null, fonte: x?.fonte || "sem dados", aviso: x?.aviso })).catch(() => setL({ linhas: [], atualizadoEm: null, fonte: "sem dados" })); }, [ler]);
  const linhas = l?.linhas || [];
  return (
    <Bloco icone="grafico" corIcone="#60a5fa" titulo="Livro de cotas (hoje)" ajuda="Quanto cada IA grátis já trabalhou hoje e qual está sem cota agora. Quando uma acaba, o Cortex troca sozinho para a próxima." fonte={l ? l.fonte : null} atualizadoEm={l ? l.atualizadoEm : null}>
      {l && !linhas.length && <p className="kx-mut">Sem dados ainda. {l.aviso || "Aparece depois que o Cortex usar as IAs."}</p>}
      <ul className="kx-lista">
        {linhas.map((x) => {
          const s = SIT[x.situacao] || [x.situacao, "#94a3b8"];
          return (
            <li key={x.provedor} style={{ alignItems: "flex-start" }}>
              <span className="kx-titulo" style={{ whiteSpace: "normal" }}>
                <b>{x.provedor}</b> <span style={{ color: s[1], fontWeight: 600 }}>· {s[0]}</span><br />
                <span className="kx-mut">Hoje: {x.hoje ? `${x.hoje.pedidos} pedidos, ${x.hoje.tokens} tokens${x.hoje.semCota ? `, ${x.hoje.semCota} vezes sem cota` : ""}` : "sem uso"}{x.ontem ? ` · ontem: ${x.ontem.pedidos} pedidos` : ""}</span><br />
                {x.bloqueados.map((b) => <span key={b.modelo} className="kx-mut">{b.modelo}: {b.motivo}, volta às {hora(b.ate)}<br /></span>)}
                <span className="kx-mut">{TREINA[x.treina] || x.treina}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Bloco>
  );
}
