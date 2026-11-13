import { useCallback, useEffect, useState } from "react";
import { useCentral } from "../api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";

// Fase 4 (13/11/2026): buscar clientes (negócios sem site), funil e WhatsApp com 1 toque. Pedidos do site = parte=leads.
// Servidor: netlify/functions/central/vendas.js. Regra: quem envia a mensagem é o dono (nada de disparo automático).
interface Prospect { id: string; nome: string; ramo: string; cidade: string; telefone: string; whatsapp: string; site: string; endereco: string; temSite: boolean; quente: boolean; etapa: string; mensagem: string; linkWhats: string }
interface Lista { prospects: Prospect[]; contagem: Record<string, number> }
interface LeadSite { id: string; nome: string; produto: string; status: string; whatsapp: string; email: string; quando: string }

const ETAPAS: [string, string][] = [["novo", "Novos"], ["contatado", "Contatados"], ["proposta", "Proposta"], ["fechado", "Fechados"]];

export default function Vendas() {
  const { ler, agir } = useCentral();
  const [ramos, setRamos] = useState<string[]>([]);
  const [busca, setBusca] = useState({ ramo: "barbearia", cidade: "" });
  const [lista, setLista] = useState<Lista | null>(null);
  const [etapa, setEtapa] = useState("novo");
  const [site, setSite] = useState<LeadSite[]>([]);
  const [msg, setMsg] = useState("");
  const [buscando, setBuscando] = useState(false);

  const carregar = useCallback(() => {
    ler<Lista>(`parte=vendas-prospects&etapa=${etapa}&limite=60`).then((x) => setLista({ prospects: x?.prospects || [], contagem: x?.contagem || {} })).catch((e: Error) => setMsg(e.message));
    ler<{ ultimos: LeadSite[] }>("parte=leads").then((x) => setSite(x?.ultimos || [])).catch(() => setSite([]));
  }, [ler, etapa]);
  useEffect(() => { ler<{ ramos: string[] }>("parte=vendas-ramos").then((x) => setRamos(x?.ramos || [])).catch(() => setRamos([])); }, [ler]);
  useEffect(() => { carregar(); }, [carregar]);

  const buscar = async () => {
    if (!busca.cidade.trim()) { setMsg("Escreva a cidade."); return; }
    setBuscando(true); setMsg("Procurando no mapa…");
    try {
      const r = await agir<{ achados: number; novos: number; quentes: number }>({ acao: "vendas-buscar", ramo: busca.ramo, cidade: busca.cidade.trim() });
      setMsg(`Achei ${r.achados} (${r.novos} novos). ${r.quentes} sem site e com WhatsApp: são os melhores para oferecer.`);
      setEtapa("novo"); carregar();
    } catch (e) { setMsg((e as Error).message); } finally { setBuscando(false); }
  };
  const mover = async (p: Prospect, nova: string) => {
    try { await agir({ acao: "vendas-etapa", id: p.id, etapa: nova }); carregar(); } catch (e) { setMsg((e as Error).message); }
  };
  const chamar = (p: Prospect) => { if (p.linkWhats) { window.open(p.linkWhats, "_blank", "noopener"); if (p.etapa === "novo") mover(p, "contatado"); } };
  const c = lista?.contagem || {};
  const tituloEtapa = (ETAPAS.find(([id]) => id === etapa) || ["", "Lista"])[1];

  return (
    <div data-testid="kx-vendas">
      <div className="kx-grade" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 12 }}>
        {ETAPAS.map(([id, nome]) => <Kpi key={id} cor={id === "fechado" ? "vd" : id === "proposta" ? "lj" : "az"} icone="troca" valor={lista ? c[id] || 0 : null} rotulo={nome} ativo={etapa === id} onClick={() => setEtapa(id)} />)}
        <Kpi cor="rx" icone="sino" valor={site.length} rotulo="Pedidos pelo site" />
      </div>
      {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
      <div className="kx-grade" style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 12 }}>
        <Bloco titulo="Buscar clientes" icone="busca" ajuda="Procura negócios do ramo na cidade (mapa aberto, grátis). Sem site = cliente ideal. Você envia a mensagem com 1 toque." fonte="OpenStreetMap" atualizadoEm={null}>
          <label className="kx-mut" htmlFor="kx-v-ramo">Ramo</label>
          <select id="kx-v-ramo" value={busca.ramo} onChange={(e) => setBusca({ ...busca, ramo: e.target.value })} style={{ width: "100%", minHeight: 44, margin: "4px 0 8px" }}>
            {ramos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="kx-mut" htmlFor="kx-v-cidade">Cidade</label>
          <input id="kx-v-cidade" value={busca.cidade} onChange={(e) => setBusca({ ...busca, cidade: e.target.value })} placeholder="Ex.: Recife" style={{ width: "100%", minHeight: 44, margin: "4px 0 8px" }} />
          <button type="button" className="kx-btn" onClick={buscar} disabled={buscando} data-testid="kx-vendas-buscar">{buscando ? "Procurando…" : "Buscar clientes"}</button>
        </Bloco>
        <Bloco titulo={tituloEtapa} icone="lista" ajuda="QUENTE = sem site e com WhatsApp. O botão abre o WhatsApp com a mensagem pronta (tem a opção 'sair'). Depois mova a etapa." fonte="Funil de vendas" atualizadoEm={null}>
          {lista && !lista.prospects.length && <p className="kx-mut">Ninguém nesta etapa. Use "Buscar clientes".</p>}
          <ul className="kx-lista">
            {(lista?.prospects || []).map((p) => (
              <li key={p.id} style={{ alignItems: "flex-start" }}>
                <span className="kx-titulo" style={{ whiteSpace: "normal" }}>
                  <b>{p.nome}</b> {p.quente && <span style={{ color: "#f59e0b", fontWeight: 700 }}>· QUENTE</span>}<br />
                  <span className="kx-mut">{p.ramo} · {p.cidade}{p.endereco ? ` · ${p.endereco}` : ""} · {p.temSite ? "tem site" : "sem site"}{p.telefone ? ` · ${p.telefone}` : ""}</span>
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {p.linkWhats && p.etapa === "novo" && <button type="button" className="kx-btn" onClick={() => chamar(p)}>WhatsApp</button>}
                  {p.etapa === "contatado" && <button type="button" className="kx-btn" onClick={() => mover(p, "proposta")}>Pediu proposta</button>}
                  {p.etapa === "proposta" && <button type="button" className="kx-btn" onClick={() => mover(p, "fechado")}>Fechou</button>}
                  {p.etapa !== "fechado" && <button type="button" className="kx-btn" onClick={() => mover(p, "perdido")}>Perdido</button>}
                  <button type="button" className="kx-btn" title="A pessoa pediu para não receber mais mensagens" onClick={() => mover(p, "nao-quer")}>Pediu para sair</button>
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      </div>
      <Bloco titulo="Pedidos de orçamento pelo site" icone="sino" ajuda="Quem preencheu o formulário no site da KERNEX ou de um cliente." fonte="Formulários dos sites" atualizadoEm={null}>
        {!site.length && <p className="kx-mut">Nenhum pedido ainda.</p>}
        <ul className="kx-lista">{site.map((l) => <li key={l.id}><span className="kx-titulo"><b>{l.nome || "Sem nome"}</b> · {l.produto}</span><span className="kx-mut">{l.whatsapp || l.email} · {l.status}</span></li>)}</ul>
      </Bloco>
    </div>
  );
}
