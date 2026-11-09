import { useCallback, useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import { haQuanto } from "./regras";

// #3269: tela Homologação. Verde/vermelho por produto (último CI da develop) + GSD Lab (repo privado)
// + botão Rodar tudo. Regra do dono (09/11): nenhuma versão sai sem verde.
type Status = "verde" | "instavel" | "vermelho" | "falta-teste";
interface Falha { id: string; status: Status; titulo: string; origem: string | null; log?: string }
interface Produto { status: Status; total: number; verdes: number; falhas: Falha[] }
export interface Homolog {
  aprovado: boolean | null; produtos: Record<string, Produto>; quando: string | null; commit: string | null; rodandoAgora: boolean; link: string | null;
  gsdLab: { status: "verde" | "vermelho" | "nunca" | "sem-acesso"; quando: string | null; link: string | null }; conferidoEm: string; origem: string;
}
export const COR: Record<string, string> = { verde: "#22c55e", instavel: "#f59e0b", vermelho: "#ef4444", "falta-teste": "#ef4444", nunca: "#94a3b8", "sem-acesso": "#94a3b8" };
export const TEXTO: Record<string, string> = { verde: "VERDE", instavel: "INSTÁVEL", vermelho: "VERMELHO", "falta-teste": "FALTA TESTE", nunca: "NUNCA RODOU", "sem-acesso": "SEM ACESSO" };
const NOME: Record<string, string> = { central: "Central", cortex: "Cortex", "kernex-finance": "Kernex Finance", "body-coach": "Body Coach", "viajante-pro": "Viajante Pro", bezsan: "Bezsan", "studio-lima": "Studio Lima", "sites-clientes": "Sites de clientes", plataforma: "Plataforma (base)" };

export default function Homologacao() {
  const { agir, homologacao } = usePedidos();
  const [d, setD] = useState<Homolog | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => { homologacao<Homolog>().then(setD).catch((e: Error) => setErro(e.message)); }, [homologacao]);
  useEffect(() => { carregar(); }, [carregar]);
  const rodar = async () => { setMsg("Mandando…"); try { const r = await agir({ acao: "homologar" }); setMsg(r.mensagem); } catch (e) { setMsg((e as Error).message); } };
  const lista = d && d.produtos ? Object.entries(d.produtos).sort(([a], [b]) => (NOME[a] || a).localeCompare(NOME[b] || b)) : [];
  const det = aberto && d ? d.produtos[aberto] : null;
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "2fr 1fr" }} data-testid="kx-homologacao">
      <Bloco titulo={d?.aprovado === false ? "Versão BLOQUEADA" : d?.aprovado ? "Tudo homologado" : "Homologação"} icone="check" corIcone={d?.aprovado === false ? "#ef4444" : "#22c55e"}
        ajuda="Cada produto passa por todos os testes antes de qualquer versão. Vermelho = nada é publicado até corrigir."
        fonte={d ? d.origem : null} atualizadoEm={d?.conferidoEm || null}>
        {erro && <p className="kx-sem">{erro}</p>}
        {d && !lista.length && <p className="kx-sem">Ainda não rodou na develop. Aperte "Rodar tudo".</p>}
        <ul className="kx-lista">
          {lista.map(([id, p]) => (
            <li key={id} data-testid={"kx-homolog-" + id}>
              <button type="button" className="kx-btn" style={{ width: "100%", justifyContent: "space-between" }} onClick={() => setAberto(aberto === id ? null : id)}>
                <span className="kx-titulo">{NOME[id] || id}</span>
                <span><b style={{ color: COR[p.status] }}>{TEXTO[p.status]}</b> · {p.verdes}/{p.total}</span>
              </button>
            </li>
          ))}
        </ul>
        {d?.quando && <p className="kx-mut" style={{ whiteSpace: "normal" }}>Última rodada {haQuanto(d.quando)} · commit {String(d.commit || "").slice(0, 7)}{d.link && <> · <a href={d.link} target="_blank" rel="noreferrer">ver no GitHub</a></>}</p>}
      </Bloco>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <Bloco titulo="Rodar agora" icone="play" ajuda="Roda a homologação de todos os produtos (e do GSD Lab) na hora." fonte="GitHub Actions" atualizadoEm={d?.conferidoEm || null}>
          <button type="button" className="kx-btn" onClick={rodar} data-testid="kx-homolog-rodar">Rodar tudo</button>
          {d?.rodandoAgora && <p className="kx-mut">Rodando agora…</p>}
          {msg && <p className="kx-mut">{msg}</p>}
        </Bloco>
        <Bloco titulo="GSD Lab (repo privado)" icone="cadeado" ajuda="Portão próprio do repo privado: 15 testes de voz e telas. Aqui só aparece o resultado." fonte={d ? "workflow Homologacao do repo privado" : null} atualizadoEm={d?.gsdLab.quando || null}>
          <p className="kx-num" style={{ color: COR[d?.gsdLab.status || "nunca"] }}>{TEXTO[d?.gsdLab.status || "nunca"]}</p>
          {d?.gsdLab.link && <a href={d.gsdLab.link} target="_blank" rel="noreferrer">ver detalhes</a>}
        </Bloco>
        {det && (
          <Bloco titulo={"O que não passou: " + (NOME[aberto || ""] || aberto)} icone="alerta" corIcone="#f59e0b" ajuda="Casos com problema neste produto. Cada bug relatado vira caso permanente." fonte="Homologação" atualizadoEm={d?.quando || null}>
            {!det.falhas.length ? <p className="kx-mut">Tudo verde.</p> : (
              <ul className="kx-lista">{det.falhas.map((f) => <li key={f.id}><span className="kx-titulo"><b style={{ color: COR[f.status] }}>{TEXTO[f.status]}</b> {f.id} {f.titulo}</span></li>)}</ul>
            )}
          </Bloco>
        )}
      </div>
    </div>
  );
}
