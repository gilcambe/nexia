import { useCallback, useEffect, useState } from "react";
import { useCentral } from "../api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";

// Fase 8 (13/11/2026): a KERNEX como empresa — áreas com 3+ agentes, mural onde eles conversam, e o que precisa do dono.
// Servidor: netlify/functions/central/escritorio.js (escritorio-areas, -mural, -resumo, -ok, -postar, -viabilidade).
interface Agente { id: string; nome: string; ia: string; area: string }
interface Area { id: string; nome: string; faz: string; precisaOk: string[]; agentes: Agente[] }
interface Recado { id: string; area: string; agente: string; tipo: string; texto: string; para: string; status: string; em: string; resultado?: string }
interface Resumo { titulo: string; texto: string; precisaVoce: Recado[]; atrasados: Recado[]; feitos: number; porArea: Record<string, { nome: string; feitos: number; abertos: number; ultimo: string }> }
interface Viab { nivel: string; podeVender: boolean; motivos: string[]; faltam: string[]; resposta: string; buscando: string[] }

const NIVEL: Record<string, [string, string]> = { pronto: ["Dá para vender: já temos pronto", "#22c55e"], web: ["Dá para vender: com código pronto da web", "#22c55e"], arriscado: ["Arriscado: oferecer versão menor", "#f59e0b"], "nao-fazemos": ["Não fazemos: recusar com educação", "#ef4444"] };
const hora = (iso: string) => { try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function Empresa() {
  const { ler, agir } = useCentral();
  const [areas, setAreas] = useState<Area[]>([]);
  const [mural, setMural] = useState<Recado[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [recado, setRecado] = useState({ area: "comercial", texto: "" });
  const [pedido, setPedido] = useState({ ramo: "", precisa: "" });
  const [viab, setViab] = useState<Viab | null>(null);

  const carregar = useCallback(() => {
    ler<{ areas: Area[] }>("parte=escritorio-areas").then((x) => setAreas(x?.areas || [])).catch(() => setAreas([]));
    ler<{ recados: Recado[] }>("parte=escritorio-mural&limite=40").then((x) => setMural(x?.recados || [])).catch((e: Error) => setErro(e.message));
    ler<Resumo>("parte=escritorio-resumo").then((x) => setResumo(x ? { ...x, precisaVoce: x.precisaVoce || [], atrasados: x.atrasados || [], porArea: x.porArea || {} } : null)).catch(() => setResumo(null));
  }, [ler]);
  useEffect(() => { carregar(); const t = window.setInterval(carregar, 60000); return () => window.clearInterval(t); }, [carregar]);

  const decidir = async (id: string, aprovado: boolean) => {
    try { await agir({ acao: "escritorio-ok", id, aprovado }); setMsg(aprovado ? "Aprovado. A área continua o trabalho." : "Recusado. A área foi avisada."); carregar(); } catch (e) { setMsg((e as Error).message); }
  };
  const mandar = async () => {
    if (!recado.texto.trim()) return;
    try { await agir({ acao: "escritorio-postar", area: recado.area, texto: recado.texto, tipo: "pedido", para: recado.area }); setRecado({ ...recado, texto: "" }); setMsg("Recado enviado."); carregar(); } catch (e) { setMsg((e as Error).message); }
  };
  const analisar = async () => {
    if (!pedido.ramo.trim()) return;
    try { setViab(await agir<Viab>({ acao: "escritorio-viabilidade", ramo: pedido.ramo, precisa: pedido.precisa })); } catch (e) { setMsg((e as Error).message); }
  };
  const nomeArea = (id: string) => (areas.find((a) => a.id === id) || { nome: id }).nome;
  const precisa = resumo?.precisaVoce || [];

  return (
    <div data-testid="kx-empresa">
      <div className="kx-grade" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 12 }}>
        <Kpi cor="vm" icone="sino" valor={resumo ? precisa.length : null} rotulo="Esperando você" />
        <Kpi cor="vd" icone="check" valor={resumo ? resumo.feitos : null} rotulo="Feito nas últimas 24 h" />
        <Kpi cor="lj" icone="relogio" valor={resumo ? (resumo.atrasados || []).length : null} rotulo="Atrasado (Diretor cobrou)" />
        <Kpi cor="az" icone="ia" valor={areas.length ? areas.reduce((s, a) => s + (a.agentes || []).length, 0) : null} rotulo="Funcionários (IA)" sub={areas.length ? `${areas.length} áreas` : undefined} />
      </div>
      {erro && <p className="kx-sem">Escritório ainda não ligado: {erro}</p>}
      {msg && <p className="kx-mut">{msg}</p>}
      <div className="kx-grade" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Bloco titulo={resumo ? resumo.titulo : "Precisa de você"} icone="sino" corIcone="#f59e0b" ajuda="Só aparece aqui o que nenhum funcionário pode decidir sozinho: dinheiro, contrato, envio de mensagens, publicar." fonte="Mural da empresa" atualizadoEm={null}>
          {!precisa.length && <p className="kx-mut">Nada esperando você. 👍</p>}
          <ul className="kx-lista">
            {precisa.map((r) => (
              <li key={r.id} data-testid={"kx-ok-" + r.id} style={{ alignItems: "flex-start" }}>
                <span className="kx-titulo" style={{ whiteSpace: "normal" }}><b>{nomeArea(r.area)}:</b> {r.texto}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="kx-btn" onClick={() => decidir(r.id, true)}>Aprovar</button>
                  <button type="button" className="kx-btn" onClick={() => decidir(r.id, false)}>Recusar</button>
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo="Mandar recado para uma área" icone="enviar" ajuda="Ex.: Comercial, priorize as clínicas esta semana. O Diretor cobra se ninguém fizer." fonte={null} atualizadoEm={null}>
          <select value={recado.area} onChange={(e) => setRecado({ ...recado, area: e.target.value })} style={{ width: "100%", minHeight: 44, marginBottom: 8 }} aria-label="Área">
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <textarea value={recado.texto} onChange={(e) => setRecado({ ...recado, texto: e.target.value })} rows={3} style={{ width: "100%" }} placeholder="Escreva o recado…" aria-label="Recado" />
          <button type="button" className="kx-btn" onClick={mandar} disabled={!recado.texto.trim()} style={{ marginTop: 8 }}>Enviar</button>
        </Bloco>
      </div>
      <div className="kx-grade" style={{ gridTemplateColumns: "2fr 1fr", margin: "12px 0" }}>
        <Bloco titulo="Mural: o que os funcionários estão fazendo" icone="lista" ajuda="Cada área escreve aqui o que fez e o que pede para a outra. Atualiza a cada minuto." fonte="Mural da empresa" atualizadoEm={null}>
          {!mural.length && <p className="kx-mut">Ainda sem recados.</p>}
          <ul className="kx-lista">
            {mural.slice(0, 25).map((r) => (
              <li key={r.id} style={{ alignItems: "flex-start" }}>
                <span className="kx-titulo" style={{ whiteSpace: "normal" }}><b>{nomeArea(r.area)}</b>{r.agente ? ` · ${r.agente}` : ""}{r.para ? ` → ${nomeArea(r.para)}` : ""}: {r.texto}{r.resultado ? <><br /><span className="kx-mut">↳ {r.resultado}</span></> : null}</span>
                <span className="kx-mut">{r.status === "aberto" ? "aberto" : r.status} · {hora(r.em)}</span>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo="Dá para fazer?" icone="check" ajuda="Regra da KERNEX: nunca aceitar o que o Cortex não dá conta. Digite o pedido do cliente antes de prometer." fonte="Biblioteca do Cortex" atualizadoEm={null}>
          <input value={pedido.ramo} onChange={(e) => setPedido({ ...pedido, ramo: e.target.value })} placeholder="Ramo (ex.: clínica)" aria-label="Ramo" style={{ width: "100%", minHeight: 44, marginBottom: 6 }} />
          <input value={pedido.precisa} onChange={(e) => setPedido({ ...pedido, precisa: e.target.value })} placeholder="O que precisa (ex.: agenda, galeria)" aria-label="O que precisa" style={{ width: "100%", minHeight: 44 }} />
          <button type="button" className="kx-btn" onClick={analisar} disabled={!pedido.ramo.trim()} style={{ marginTop: 8 }} data-testid="kx-viabilidade">Analisar</button>
          {viab && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: (NIVEL[viab.nivel] || ["", "#94a3b8"])[1], fontWeight: 700, margin: 0 }}>{(NIVEL[viab.nivel] || [viab.nivel])[0]}</p>
              <p className="kx-mut" style={{ whiteSpace: "normal" }}>{(viab.motivos || []).join(" ")}</p>
              {viab.resposta && <p className="kx-mut" style={{ whiteSpace: "normal" }}>Resposta sugerida: “{viab.resposta}”</p>}
              {(viab.buscando || []).length > 0 && <p className="kx-mut">O Buscador já foi atrás de: {viab.buscando.join(", ")}.</p>}
            </div>
          )}
        </Bloco>
      </div>
      <Bloco titulo="Equipe" icone="ia" ajuda="Cada área tem no mínimo 3 funcionários de IA, em IAs diferentes: se um cai, os outros seguem." fonte="Escritório" atualizadoEm={null}>
        <div className="kx-grade" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {areas.map((a) => {
            const pa = (resumo?.porArea || {})[a.id];
            return (
              <div key={a.id} className="kx-cartao" style={{ border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, padding: 12 }}>
                <b>{a.nome}</b>
                <p className="kx-mut" style={{ whiteSpace: "normal", margin: "4px 0" }}>{a.faz}</p>
                <p className="kx-mut" style={{ margin: 0 }}>{(a.agentes || []).map((g) => g.nome).join(" · ")}</p>
                {pa && <p className="kx-mut" style={{ margin: "4px 0 0" }}>Feito 24 h: {pa.feitos} · aberto: {pa.abertos}</p>}
              </div>
            );
          })}
        </div>
      </Bloco>
    </div>
  );
}
