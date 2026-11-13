import { useCallback, useEffect, useState } from "react";
import { useCentral } from "../api";
import { usePedidos } from "../../meu-cortex/api";
import { haQuanto } from "./regras";
import { listarServicos, resumoServicos, type Linha } from "./servicosRegras";

// C2-E (13/11): "9 de 11 o quê?". Aqui aparecem TODOS os sites e sistemas medidos, quais estão fora, por quê e como resolver.
const COR = { verde: "#2fd3c7", amarelo: "#f5b84a", vermelho: "#ff6b6b", cinza: "#6b7d96" } as const;

export default function Servicos() {
  const { buscar } = useCentral();
  const { agir } = usePedidos();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [resumo, setResumo] = useState("");
  const [em, setEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const ler = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([buscar("saude"), buscar("lista").catch(() => null)]);
      const prods = (l?.produtos || []).map((p) => ({ id: p.id, nome: p.nome, url: p.site || p.painel }));
      setLinhas(listarServicos(s?.produtos || [], prods)); setResumo(resumoServicos(s?.produtos || [])); setEm(s?.em || null); setErro(null);
    } catch (e) { setErro((e as Error).message); setLinhas([]); }
  }, [buscar]);
  useEffect(() => { ler(); }, [ler]);
  const consertar = async (x: Linha) => {
    setMsg((m) => ({ ...m, [x.id]: "Mandando…" }));
    try { const r = await agir({ acao: "pedir", texto: `O serviço "${x.nome}" (${x.url || x.id}) está ${x.situacao.toLowerCase()}. Motivo medido: ${x.porque} Conserte e publique de novo; mostre a prova de que voltou.` }) as { mensagem: string }; setMsg((m) => ({ ...m, [x.id]: r.mensagem })); }
    catch (e) { setMsg((m) => ({ ...m, [x.id]: "Não deu certo: " + (e as Error).message })); }
  };
  return (
    <div className="kx-tela" data-testid="kx-servicos">
      <section className="kx-bloco" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 18 }}>{resumo || "Conferindo…"}</b>
        <p className="kx-mut" style={{ whiteSpace: "normal", margin: "6px 0 0" }}>O vigia abre cada site e sistema da KERNEX a cada hora, como uma pessoa faria. {em ? `Última conferência ${haQuanto(em)}.` : ""}</p>
        <button type="button" className="kx-btn" style={{ marginTop: 10, alignSelf: "start" }} onClick={ler}>Conferir de novo</button>
      </section>
      {erro && <p className="kx-serve">Não deu para ler agora: {erro}</p>}
      <div style={{ display: "grid", gap: 10 }} data-testid="kx-servicos-lista">
        {(linhas || []).map((x) => (
          <section key={x.id} className="kx-bloco" style={{ borderLeft: `3px solid ${COR[x.cor]}` }} data-testid={"kx-servico-" + x.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="kx-bola" style={{ background: COR[x.cor] }} />
              <b style={{ flex: 1, minWidth: 160 }}>{x.nome}</b>
              <span style={{ color: COR[x.cor], fontWeight: 600 }}>{x.situacao}</span>
              {x.url && <a className="kx-btn" href={x.url} target="_blank" rel="noreferrer">Abrir</a>}
              {x.cor === "vermelho" && <button type="button" className="kx-btn forte" onClick={() => consertar(x)}>Pedir conserto ao Cortex</button>}
            </div>
            {x.cor !== "verde" && (
              <div style={{ whiteSpace: "normal", marginTop: 8 }}>
                <p style={{ margin: "0 0 4px" }}><b>Por quê:</b> {x.porque}</p>
                {x.passos.length > 0 && <><p style={{ margin: "0 0 4px" }}><b>Como resolver{x.precisaDono ? " (pode precisar de você)" : ""}:</b></p>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>{x.passos.map((p) => <li key={p}>{p}</li>)}</ol></>}
              </div>
            )}
            {msg[x.id] && <p className="kx-mut" style={{ whiteSpace: "normal", margin: "6px 0 0" }}>{msg[x.id]}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
