import { useCallback, useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import { textoCota } from "./regras";

// #3219 parte 4: IA & Cortex. Escada, o que cada IA faz agora, cotas e o botão "Ativar ajuda das IAs".
interface Ia { nome: string; situacao: string; ativa: boolean; texto: string; tarefa: { numero: number; titulo: string } | null; desde: string | null }
interface Ias { ias: Ia[]; resumo: string; conferidoEm: string; origem: string }
const COR: Record<string, string> = { ativa: "#22c55e", ociosa: "#64748b", "sem-cota": "#f59e0b", erro: "#ef4444" };
const NOME: Record<string, string> = { ativa: "Trabalhando", ociosa: "Parada", "sem-cota": "Sem cota", erro: "Com erro" };

export default function IaCortex() {
  const { ias: pedirIas, agir } = usePedidos();
  const [d, setD] = useState<Ias | null>(null);
  const [assumiu, setAssumiu] = useState<{ ia: string; numero: number; titulo?: string; fazendo: string }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = useCallback(async () => { try { setD(await pedirIas<Ias>()); } catch (e) { setMsg((e as Error).message); } }, [pedirIas]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);
  const ativar = async () => {
    setMsg("Chamando as IAs…");
    try { const r = await agir({ acao: "socorro", jules: true }); setAssumiu(r.assumiu || []); setMsg(r.assumiu && r.assumiu.length ? null : "Nenhuma tarefa travada para passar agora."); carregar(); } catch (e) { setMsg((e as Error).message); }
  };
  const conta = (s: string) => (d ? d.ias.filter((x) => x.situacao === s).length : null);
  return (
    <div className="kx-tela">
    <div className="kx-kpis" data-testid="kx-kpis-ia">
      <Kpi cor="vd" icone="ia" valor={conta("ativa")} rotulo="IAs trabalhando" sub={d ? `de ${d.ias.length} conectadas` : undefined} />
      <Kpi cor="az" icone="pausa" valor={conta("ociosa")} rotulo="Paradas, com cota" sub="prontas para pegar tarefa" />
      <Kpi cor="lj" icone="relogio" valor={conta("sem-cota")} rotulo="Sem cota hoje" sub="voltam amanhã" />
      <Kpi cor="vm" icone="alerta" valor={conta("erro")} rotulo="Com erro" sub="trocar a chave em Conectar IAs" />
    </div>
    <div className="kx-grade" style={{ gridTemplateColumns: "2fr 1fr", gridTemplateRows: "auto 1fr" }}>
      <Bloco icone="ia" corIcone="#a78bfa" titulo="IAs trabalhando agora" ajuda="Uma linha por IA: trabalhando, parada, sem cota ou com erro, e em qual tarefa." fonte={d ? d.origem : null} atualizadoEm={d?.conferidoEm || null} className="kx-alto">
        <p style={{ margin: "0 0 8px" }} data-testid="kx-ia-resumo">{d?.resumo}</p>
        <ul className="kx-lista" data-testid="kx-ias">
          {(d?.ias || []).slice(0, 10).map((x) => (
            <li key={x.nome}>
              <span className="kx-selo" style={{ background: COR[x.situacao] || "#64748b" }}>{NOME[x.situacao] || x.situacao}</span>
              <b>{x.nome}</b><span className="kx-titulo kx-mut">{x.texto}{x.tarefa ? ` · ${x.tarefa.titulo}` : ""}</span>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco icone="raio" corIcone="#c4b5fd" titulo="Ativar ajuda das IAs" ajuda="Passa as tarefas travadas para as IAs grátis e para o Jules. Mostra na hora quem pegou o quê." fonte="ação do Cortex (socorro)" atualizadoEm={null}>
        <button type="button" className="kx-btn roxo" style={{ width: "100%", minHeight: 56, fontSize: 16, justifyContent: "center" }} onClick={ativar} data-testid="kx-ativar">⚡ Ativar ajuda das IAs</button>
        {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
        {assumiu && assumiu.length > 0 && (
          <ul className="kx-lista" style={{ marginTop: 8 }} data-testid="kx-assumiu">
            {assumiu.map((a) => <li key={a.numero}><b>{a.ia}</b><span className="kx-titulo">pegou #{a.numero}{a.titulo ? ": " + a.titulo : ""}</span></li>)}
          </ul>
        )}
      </Bloco>
      <Bloco icone="grafico" titulo="Escada de IAs" ajuda="A ordem em que o Cortex tenta. Se uma falhar, passa para a próxima." fonte="regra do Cortex" atualizadoEm={null}>
        <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>Operários nos seus PCs <span className="kx-mut">(não conectado)</span></li>
          <li>Cortex com as IAs grátis</li>
          <li>Jules</li>
          <li>Claude, só para tarefa difícil</li>
        </ol>
      </Bloco>
      <Bloco icone="relogio" corIcone="#fbbf24" titulo="Cotas" ajuda="Quanto cada IA ainda pode usar hoje. Só aparece o que o provedor informa." fonte={d ? "estado das vagas em Conectar IAs" : null} atualizadoEm={d?.conferidoEm || null}>
        <ul className="kx-lista">{(d?.ias || []).filter((x) => x.nome.startsWith("Vaga")).map((x) => <li key={x.nome}><b>{x.nome}</b><span className="kx-mut">{textoCota(x.situacao)}</span></li>)}</ul>
        <p className="kx-mut" style={{ marginTop: 8 }}>Tokens da Claude: não disponível (sem fonte real).</p>
        <a className="kx-btn" href="/central#sistema">Conectar IAs</a>
      </Bloco>
    </div>
    </div>
  );
}
