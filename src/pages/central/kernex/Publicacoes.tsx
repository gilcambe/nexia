import { useCallback, useEffect, useState } from "react";
import { usePedidos, type Deploy } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import { haQuanto, textoDeploy } from "./regras";

// #3219 parte 6: Publicações. PRs abertos, aprovar e juntar, situação do deploy e botão Publicar.
interface Pr { numero: number; titulo: string; link: string; ramo: string; doCortex: boolean; automerge: boolean; rascunho: boolean; quando: string }
const CHIPS = [{ id: "esperando", nome: "Esperando você" }, { id: "sozinho", nome: "Entram sozinhos" }, { id: "todos", nome: "Todos" }] as const;

export default function Publicacoes() {
  const { prs: pedirPrs, deploy, agir } = usePedidos();
  const [prs, setPrs] = useState<{ prs: Pr[]; conferidoEm: string; origem: string } | null>(null);
  const [dep, setDep] = useState<{ d: Deploy; em: string } | null>(null);
  const [chip, setChip] = useState<(typeof CHIPS)[number]["id"]>("esperando");
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const [a, b] = await Promise.allSettled([pedirPrs<{ prs: Pr[]; conferidoEm: string; origem: string }>(), deploy()]);
    if (a.status === "fulfilled") setPrs(a.value); else setMsg((a.reason as Error).message);
    if (b.status === "fulfilled") setDep({ d: b.value, em: new Date().toISOString() });
  }, [pedirPrs, deploy]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  const fazer = async (corpo: Record<string, unknown>) => { setMsg("Fazendo…"); try { setMsg((await agir(corpo)).mensagem); carregar(); } catch (e) { setMsg((e as Error).message); } };
  const lista = (prs?.prs || []).filter((p) => chip === "todos" || (chip === "sozinho" ? p.automerge : p.doCortex && !p.automerge && !p.rascunho));
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "3fr 2fr" }}>
      <Bloco titulo="Código esperando entrar (PRs)" ajuda="PRs abertos. 'Aprovar e juntar' faz o PR entrar sozinho quando os testes ficarem verdes." fonte={prs ? prs.origem : null} atualizadoEm={prs?.conferidoEm || null}>
        <div className="kx-chips" style={{ marginBottom: 8 }}>{CHIPS.map((c) => <button key={c.id} type="button" className="kx-chip" aria-pressed={chip === c.id} onClick={() => setChip(c.id)}>{c.nome}</button>)}</div>
        {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
        <ul className="kx-lista" data-testid="kx-prs">
          {lista.slice(0, 12).map((p) => (
            <li key={p.numero}>
              <a className="kx-titulo" href={p.link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>#{p.numero} {p.titulo}</a>
              <span className="kx-mut">{haQuanto(p.quando)}</span>
              {p.automerge ? <span className="kx-selo" style={{ background: "#22c55e" }}>Entra sozinho</span>
                : p.doCortex && <button type="button" className="kx-btn forte" onClick={() => fazer({ acao: "juntar", pr: p.numero })}>Aprovar e juntar</button>}
            </li>
          ))}
          {prs && lista.length === 0 && <li>Nada aqui. 🎉</li>}
        </ul>
      </Bloco>
      <Bloco titulo="No ar" ajuda="Se o que entrou no código já foi publicado no site." fonte={dep ? "robô de publicação (GitHub Actions)" : null} atualizadoEm={dep?.em || null}>
        <p style={{ fontSize: 18, margin: "4px 0 10px" }} data-testid="kx-deploy">{textoDeploy(dep?.d)}</p>
        {dep?.d.ultimoDeploy && <p className="kx-mut">Última publicação {haQuanto(dep.d.ultimoDeploy.quando)} · <a href={dep.d.ultimoDeploy.link} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>ver</a></p>}
        <div className="kx-chips" style={{ marginTop: 10 }}>
          <button type="button" className="kx-btn forte" onClick={() => fazer({ acao: "publicar" })}>🚀 Publicar agora</button>
          <button type="button" className="kx-btn" disabled title="Ainda não conectado">Reverter (em breve)</button>
        </div>
        <div className="kx-chips" style={{ marginTop: 10 }}>
          <a className="kx-btn" href="https://github.com/gilcambe/nexia/pulls" target="_blank" rel="noreferrer">PRs no GitHub</a>
          <a className="kx-btn" href="https://github.com/gilcambe/nexia/actions" target="_blank" rel="noreferrer">Robôs (Actions)</a>
          <a className="kx-btn" href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer">Cloudflare</a>
        </div>
      </Bloco>
    </div>
  );
}
