import { useCallback, useEffect, useState } from "react";
import { usePedidos, type Deploy } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import { haQuanto, textoDeploy } from "./regras";

// #3219 parte 6: Publicações. PRs abertos, aprovar e juntar, situação do deploy e botão Publicar.
interface Pr { numero: number; titulo: string; link: string; ramo: string; doCortex: boolean; automerge: boolean; rascunho: boolean; quando: string }
const CHIPS = [{ id: "esperando", nome: "Esperando você" }, { id: "sozinho", nome: "Entram sozinhos" }, { id: "todos", nome: "Todos" }] as const;

// Cockpit (12/11): "Aprovar e juntar" também para os PRs do PC 1 e do PC 2 (ramo nexia/...), não só os do Cortex.
// O servidor (acao "juntar") só aceita ramo nexia/ e só põe automerge: o PR entra quando o CI ficar verde.
export const podeJuntar = (p: Pick<Pr, "ramo" | "rascunho" | "automerge">) => !p.rascunho && !p.automerge && String(p.ramo || "").startsWith("nexia/");

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
  const lista = (prs?.prs || []).filter((p) => chip === "todos" || (chip === "sozinho" ? p.automerge : podeJuntar(p)));
  const todos = prs?.prs || [];
  const esperando = todos.filter(podeJuntar).length;
  const sozinhos = todos.filter((p) => p.automerge).length;
  return (
    <div className="kx-tela">
    <div className="kx-kpis" data-testid="kx-kpis-pub">
      <Kpi cor="az" icone="foguete" valor={prs ? todos.length : null} rotulo="PRs abertos" ativo={chip === "todos"} onClick={() => setChip("todos")} />
      <Kpi cor="vm" icone="sino" valor={prs ? esperando : null} rotulo="Esperando você" sub="Aprovar e juntar" ativo={chip === "esperando"} onClick={() => setChip("esperando")} />
      <Kpi cor="vd" icone="check" valor={prs ? sozinhos : null} rotulo="Entram sozinhos" sub="quando os testes passam" ativo={chip === "sozinho"} onClick={() => setChip("sozinho")} />
      <Kpi cor={dep?.d.falhou ? "vm" : dep?.d.mudancas ? "lj" : "ci"} icone="servidor" valor={!dep ? null : dep.d.emAndamento ? "Publicando" : dep.d.falhou ? "Falhou" : dep.d.mudancas ? dep.d.mudancas : "Em dia"} rotulo={dep && dep.d.mudancas && !dep.d.emAndamento && !dep.d.falhou ? "mudanças fora do ar" : "Site no ar"} sub={dep?.d.ultimoDeploy ? "publicado " + haQuanto(dep.d.ultimoDeploy.quando) : undefined} />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "3fr 2fr" }}>
      <Bloco icone="foguete" corIcone="#22d3ee" titulo="Código esperando entrar (PRs)" ajuda="PRs abertos. 'Aprovar e juntar' faz o PR entrar sozinho quando os testes ficarem verdes." fonte={prs ? prs.origem : null} atualizadoEm={prs?.conferidoEm || null}>
        <div className="kx-chips" style={{ marginBottom: 8 }}>{CHIPS.map((c) => <button key={c.id} type="button" className="kx-chip" aria-pressed={chip === c.id} onClick={() => setChip(c.id)}>{c.nome}</button>)}</div>
        {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
        <ul className="kx-lista" data-testid="kx-prs">
          {lista.slice(0, 12).map((p) => (
            <li key={p.numero}>
              <a className="kx-titulo" href={p.link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>#{p.numero} {p.titulo}</a>
              <span className="kx-mut">{haQuanto(p.quando)}</span>
              {p.automerge ? <span className="kx-selo" style={{ background: "#22c55e" }}>Entra sozinho</span>
                : podeJuntar(p) && <button type="button" className="kx-btn forte" onClick={() => fazer({ acao: "juntar", pr: p.numero })}>Aprovar e juntar</button>}
            </li>
          ))}
          {prs && lista.length === 0 && <li>Nada aqui. 🎉</li>}
        </ul>
      </Bloco>
      <Bloco icone="servidor" corIcone="#34d399" titulo="No ar" ajuda="Se o que entrou no código já foi publicado no site." fonte={dep ? "robô de publicação (GitHub Actions)" : null} atualizadoEm={dep?.em || null}>
        <p style={{ fontSize: 18, margin: "4px 0 10px" }} data-testid="kx-deploy">{textoDeploy(dep?.d)}</p>
        {dep?.d.ultimoDeploy && <p className="kx-mut">Última publicação {haQuanto(dep.d.ultimoDeploy.quando)} · <a href={dep.d.ultimoDeploy.link} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>ver</a></p>}
        <div className="kx-chips" style={{ marginTop: 10 }}>
          <button type="button" className="kx-btn verde" onClick={() => fazer({ acao: "publicar" })}>🚀 Publicar agora</button>
          <button type="button" className="kx-btn" disabled title="Ainda não conectado">Reverter (em breve)</button>
        </div>
        <div className="kx-chips" style={{ marginTop: 10 }}>
          <a className="kx-btn" href="https://github.com/gilcambe/nexia/pulls" target="_blank" rel="noreferrer">PRs no GitHub</a>
          <a className="kx-btn" href="https://github.com/gilcambe/nexia/actions" target="_blank" rel="noreferrer">Robôs (Actions)</a>
          <a className="kx-btn" href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer">Cloudflare</a>
        </div>
      </Bloco>
    </div>
    </div>
  );
}
