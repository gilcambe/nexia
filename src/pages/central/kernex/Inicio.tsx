import { useCallback, useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import { useCentral, type Maquina } from "../api";
import Bloco from "./Bloco";
import Icone, { LogoK } from "./Icone";
import { corSemaforo, haQuanto, hora, type TelaId } from "./regras";

// #3219 Início no jeito do "Painel Executivo" que o dono mandou: saudação, 4 números grandes coloridos,
// atalhos para os módulos, controles com 1 toque, assistente para pedir ao Cortex e os painéis do dia.
// Só número com fonte real; sem fonte, "sem dados" ou "—".
export interface Ias { ias: { nome: string; situacao: string; ativa: boolean; texto: string; tarefa?: { numero: number; titulo: string } | null; desde?: string | null }[]; resumo: string; contagens: Record<string, number>; conferidoEm: string; origem: string }
export interface Painel { ias: Ias | null; saude: { fora: number; total: number; em: string } | null; erro: string | null; recarregar?: () => void }
interface Item { numero: number; titulo: string; texto?: string; motivo?: string; quando: string; ia?: string | null; link?: string }
interface Projeto { id: string; nome: string; definido: boolean; pct: number; faltam: unknown[] }

const MODULOS: { id: TelaId; nome: string; frase: string; icone: string; fundo: string }[] = [
  { id: "projetos", nome: "Projetos", frase: "Avaya, Bezsan, Cortex e mais", icone: "pasta", fundo: "linear-gradient(135deg,#2563eb,#1e3a8a)" },
  { id: "maquinas", nome: "Máquinas", frase: "PCs e Operários locais", icone: "pc", fundo: "linear-gradient(135deg,#059669,#065f46)" },
  { id: "ia", nome: "IA & Cortex", frase: "Quem está trabalhando agora", icone: "ia", fundo: "linear-gradient(135deg,#7c3aed,#4c1d95)" },
  { id: "tarefas", nome: "Tarefas", frase: "Fila, travadas e concluídas", icone: "lista", fundo: "linear-gradient(135deg,#ea580c,#9a3412)" },
  { id: "publicacoes", nome: "Publicações", frase: "GitHub, Cloudflare e deploy", icone: "foguete", fundo: "linear-gradient(135deg,#0891b2,#155e75)" },
  { id: "config", nome: "Configurações", frase: "Avisos e jeito da Central", icone: "engrenagem", fundo: "linear-gradient(135deg,#334155,#1e293b)" },
];
const COR_IA: Record<string, string> = { ativa: "#22c55e", ociosa: "#64748b", "sem-cota": "#f59e0b", erro: "#ef4444" };
const NOME_IA: Record<string, string> = { ativa: "Trabalhando", ociosa: "Parada", "sem-cota": "Sem cota", erro: "Com erro" };

function Barras({ cor, n }: { cor: string; n: number }) {
  // Enfeite proporcional ao número real (até 6 barras); sem número, nada.
  if (!n) return null;
  const k = Math.min(6, n);
  return <span className="barras" aria-hidden>{Array.from({ length: k }, (_, i) => <i key={i} style={{ height: 8 + i * 5, background: cor }} />)}</span>;
}

export default function Inicio({ irPara, painel, nome }: { irPara: (t: TelaId) => void; painel: Painel; nome: string }) {
  const { listar, projetos, agir } = usePedidos();
  const { buscar } = useCentral();
  const [maq, setMaq] = useState<{ ligado: boolean; maquinas: Maquina[]; em: string } | null>(null);
  const [precisa, setPrecisa] = useState<{ itens: Item[]; em: string } | null>(null);
  const [feitas, setFeitas] = useState<{ itens: Item[]; em: string } | null>(null);
  const [proj, setProj] = useState<{ projetos: Projeto[]; conferidoEm: string; origem: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pedido, setPedido] = useState("");

  const carregar = useCallback(async () => {
    const agora = new Date().toISOString();
    const [m, p, f, pr] = await Promise.allSettled([buscar("maquinas"), listar("", "precisa", 1), listar("", "concluidas", 1), projetos<{ projetos: Projeto[]; conferidoEm: string; origem: string }>()]);
    if (m.status === "fulfilled" && m.value) setMaq({ ligado: !!m.value.ligado, maquinas: m.value.maquinas || [], em: agora });
    if (p.status === "fulfilled") setPrecisa({ itens: (p.value.itens as unknown as Item[]).slice(0, 4), em: agora });
    if (f.status === "fulfilled") setFeitas({ itens: (f.value.itens as unknown as Item[]).slice(0, 5), em: agora });
    if (pr.status === "fulfilled") setProj(pr.value);
  }, [buscar, listar, projetos]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 8000); return () => clearTimeout(t); }, [aviso]);

  const fazer = async (id: string, corpo: Record<string, unknown>, pergunta?: string) => {
    if (pergunta && !confirm(pergunta)) return;
    setOcupado(id);
    try {
      const r = await agir(corpo);
      setAviso(r.mensagem + (r.assumiu && r.assumiu.length ? " " + r.assumiu.map((a) => `${a.ia} pegou #${a.numero}.`).join(" ") : ""));
      painel.recarregar?.(); carregar();
    } catch (e) { setAviso("Não deu certo: " + (e as Error).message); }
    setOcupado(null);
  };
  const enviarPedido = async () => {
    const t = pedido.trim();
    if (t.length < 10) { setAviso("Escreva o pedido com pelo menos 10 letras."); return; }
    await fazer("pedir", { acao: "pedir", texto: t });
    setPedido("");
  };

  const ver = (t: TelaId, texto?: string) => ({ texto, ir: () => irPara(t) });
  const ias = painel.ias;
  const c = ias?.contagens || {};
  const sinal = corSemaforo({ precisa: c.precisaVoce || 0, travadas: c.travada || 0, servicosFora: painel.saude?.fora || 0 });
  const online = (maq?.maquinas || []).filter((x) => x.online).length;
  const temMaq = !!(maq && maq.ligado && maq.maquinas.length);
  const saude = painel.saude;
  const pctNoAr = saude && saude.total ? Math.round(((saude.total - saude.fora) / saude.total) * 100) : 0;
  const fraseHeroi = !ias ? "Conferindo como está tudo…" : sinal.cor === "verde" ? "Sua Central está funcionando: nada travado e nada esperando você." : sinal.cor === "amarelo" ? `Atenção: ${c.travada} tarefa(s) travada(s). As IAs podem tentar de novo.` : `${c.precisaVoce || 0} coisa(s) precisam de você${saude && saude.fora ? ` e ${saude.fora} serviço(s) estão fora do ar` : ""}.`;
  const iasLista = (ias?.ias || []).slice().sort((a, b) => Number(b.ativa) - Number(a.ativa)).slice(0, 5);

  return (
    <div className="kx-inicio" data-testid="kx-inicio">
      <section className="kx-heroi">
        <span className="kx-esconde-cel"><LogoK tam={72} /></span>
        <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <h1>Olá{nome ? ", " + nome : ""}!</h1>
          <p data-testid="kx-resumo">{fraseHeroi}</p>
          {ias && <span className="kx-heroi-faixa">{ias.resumo}</span>}
        </div>
        <div className="kx-controles" data-testid="kx-controles">
          <button type="button" className="kx-btn roxo" disabled={!!ocupado} onClick={() => fazer("socorro", { acao: "socorro", jules: true })} title="Passa as tarefas travadas para as IAs grátis e o Jules"><Icone nome="raio" tam={16} />Ativar ajuda das IAs</button>
          <button type="button" className="kx-btn verde" disabled={!!ocupado} onClick={() => fazer("publicar", { acao: "publicar" }, "Publicar no ar o que já entrou no código?")}><Icone nome="foguete" tam={16} />Publicar agora</button>
          <button type="button" className="kx-btn" disabled={!!ocupado} onClick={() => fazer("pausar", { acao: "pausar-fila" }, "Pausar a fila do Cortex? Nada novo começa até você tocar em Voltar a rodar.")}><Icone nome="pausa" tam={16} />Pausar fila</button>
          <button type="button" className="kx-btn" disabled={!!ocupado} onClick={() => fazer("voltar", { acao: "voltar-fila" })}><Icone nome="play" tam={16} />Voltar a rodar</button>
        </div>
      </section>

      <button type="button" className="kx-kpi az" onClick={() => irPara("maquinas")} data-testid="kx-kpi-maquinas">
        <span className="ico" style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}><Icone nome="pc" tam={26} cor="#fff" /></span>
        <span><b>{temMaq ? `${online} de ${maq!.maquinas.length}` : "—"}</b><span>Máquinas ativas</span><small style={{ color: "#93c5fd" }}>{temMaq ? "sinal " + haQuanto(maq!.em) : "sem sinal dos PCs ainda"}</small></span>
      </button>
      <button type="button" className="kx-kpi vd" onClick={() => irPara("tarefas")} data-testid="kx-kpi-feitas">
        <span className="ico" style={{ background: "linear-gradient(135deg,#22c55e,#15803d)" }}><Icone nome="check" tam={28} cor="#fff" /></span>
        <span><b>{ias ? c.concluida || 0 : "—"}</b><span>Tarefas concluídas hoje</span><small style={{ color: "#86efac" }}>{ias ? `${(c.andamento || 0) + (c["aguardando-ia"] || 0)} em andamento` : "conferindo"}</small></span>
        <Barras cor="#22c55e" n={c.concluida || 0} />
      </button>
      <button type="button" className="kx-kpi rx" onClick={() => irPara("tarefas")} data-testid="kx-kpi-travadas">
        <span className="ico" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}><Icone nome="raio" tam={26} cor="#fff" /></span>
        <span><b>{ias ? c.travada || 0 : "—"}</b><span>Tarefas travadas</span>
          <small style={{ color: c.travada ? "#fcd34d" : "#86efac" }}>{!ias ? "conferindo" : c.travada ? "as IAs podem tentar de novo" : "Tudo OK!"}</small></span>
      </button>
      <button type="button" className={"kx-kpi " + (saude && saude.fora ? "vm" : "lj")} onClick={() => irPara("publicacoes")} data-testid="kx-kpi-servicos">
        <span className="ico" style={{ background: "linear-gradient(135deg,#f59e0b,#c2410c)" }}><Icone nome="servidor" tam={26} cor="#fff" /></span>
        <span style={{ flex: 1, minWidth: 0 }}><b>{saude ? `${saude.total - saude.fora} de ${saude.total}` : "—"}</b><span>Serviços no ar</span>
          {saude ? <span className="kx-barra" style={{ display: "block", marginTop: 8 }}><i style={{ width: pctNoAr + "%", background: "linear-gradient(90deg,#f59e0b,#fb923c)" }} /></span> : <small>conferindo</small>}</span>
      </button>

      <section className="kx-bloco" style={{ gridColumn: "span 9" }}>
        <header className="kx-bloco-topo"><h2><Icone nome="foguete" cor="#60a5fa" />Acesso rápido aos módulos</h2></header>
        <div className="kx-modulos">
          {MODULOS.map((m) => (
            <button key={m.id} type="button" className="kx-mod" style={{ background: m.fundo }} onClick={() => irPara(m.id)} data-testid={"kx-mod-" + m.id}>
              <Icone nome={m.icone} tam={28} cor="#fff" /><b>{m.nome}</b><span>{m.frase}</span><span className="seta"><Icone nome="seta" tam={14} cor="#fff" /></span>
            </button>
          ))}
        </div>
      </section>

      <Bloco className="kx-assist" titulo="Pedir ao Cortex" icone="ia" corIcone="#a5b4fc" ajuda="Escreva o que você quer em português. Vira uma tarefa na fila do Cortex; as IAs grátis ajudam se ele travar." fonte="fila do Cortex (issues cortex-fila)" atualizadoEm={null}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button type="button" className="kx-sugestao" onClick={() => irPara("maquinas")}><Icone nome="grafico" tam={16} cor="#a5b4fc" />Mostrar o status das máquinas</button>
          <button type="button" className="kx-sugestao" onClick={() => irPara("projetos")}><Icone nome="pasta" tam={16} cor="#a5b4fc" />Ver quanto falta em cada projeto</button>
          <button type="button" className="kx-sugestao" onClick={() => irPara("tarefas")}><Icone nome="lista" tam={16} cor="#a5b4fc" />Ver as últimas tarefas</button>
          <button type="button" className="kx-sugestao" onClick={() => { document.getElementById("kx-busca")?.focus(); }}><Icone nome="busca" tam={16} cor="#a5b4fc" />Buscar uma tela ou tarefa</button>
          <textarea placeholder="Digite seu pedido… (ex.: corrigir o botão de login do Body Coach)" value={pedido} onChange={(e) => setPedido(e.target.value)} aria-label="Pedido para o Cortex" data-testid="kx-pedido" />
          <button type="button" className="kx-btn forte" style={{ justifyContent: "center" }} disabled={ocupado === "pedir"} onClick={enviarPedido}><Icone nome="enviar" tam={16} />Mandar para o Cortex</button>
        </div>
      </Bloco>

      <Bloco className="kx-span5" titulo="IAs trabalhando agora" icone="ia" corIcone="#a78bfa" ver={ver("ia", "Ver detalhes")}
        ajuda="Cada IA: trabalhando, parada, sem cota ou com erro, e em qual tarefa." fonte={ias ? ias.origem : null} atualizadoEm={ias?.conferidoEm || null}>
        <table className="kx-tabela" data-testid="kx-ias">
          <thead><tr><th style={{ width: "34%" }}>Nome</th><th style={{ width: "24%" }}>Status</th><th>Tarefa atual</th></tr></thead>
          <tbody>{iasLista.map((x) => (
            <tr key={x.nome}><td><span className="kx-bola" style={{ display: "inline-block", marginRight: 8, background: COR_IA[x.situacao] || "#64748b" }} />{x.nome}</td>
              <td><span className="kx-selo" style={{ background: COR_IA[x.situacao] || "#64748b" }}>{NOME_IA[x.situacao] || x.situacao}</span></td>
              <td title={x.tarefa ? x.tarefa.titulo : x.texto}>{x.tarefa ? `#${x.tarefa.numero} ${x.tarefa.titulo}` : x.texto}</td></tr>
          ))}</tbody>
        </table>
      </Bloco>

      <Bloco className="kx-span4" titulo="Projetos" icone="pasta" corIcone="#60a5fa" ver={ver("projetos")}
        ajuda="A barra só anda quando um item tem prova (PR juntado, teste ou link)." fonte={proj ? proj.origem : null} atualizadoEm={proj?.conferidoEm || null}>
        <ul className="kx-lista" data-testid="kx-projetos-inicio">
          {(proj?.projetos || []).slice(0, 5).map((p) => (
            <li key={p.id} style={{ minHeight: 30 }}>
              <span className="kx-titulo" style={{ flex: "0 0 42%" }}>{p.nome || p.id}</span>
              {p.definido ? <><span className="kx-barra"><i style={{ width: p.pct + "%" }} /></span><b style={{ width: 40, textAlign: "right" }}>{p.pct}%</b></> : <span className="kx-mut">roteiro não definido</span>}
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco className="kx-span4" titulo="Precisa de você" icone="sino" corIcone="#f87171" ver={ver("tarefas")}
        ajuda="Só o que depende de você. As outras travadas as IAs resolvem." fonte={precisa ? "issues abertas que só o dono resolve" : null} atualizadoEm={precisa?.em || null}>
        {precisa && precisa.itens.length === 0 ? <p style={{ display: "flex", gap: 8, alignItems: "center" }}><Icone nome="check" cor="#22c55e" />Nada esperando você.</p> : (
          <div data-testid="kx-precisa">{(precisa?.itens || []).map((t) => (
            <div key={t.numero} className="kx-alerta">
              <Icone nome="alerta" cor="#f87171" />
              <span className="kx-titulo"><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.numero} {t.titulo}</b><span className="kx-mut">{t.motivo || t.texto || ""} · {haQuanto(t.quando)}</span></span>
              <button type="button" className="kx-btn vermelho" style={{ minHeight: 32 }} onClick={() => irPara("tarefas")}>Resolver</button>
            </div>
          ))}</div>
        )}
      </Bloco>

      <Bloco className="kx-span4" titulo="Atividade recente" icone="relogio" corIcone="#60a5fa" ver={ver("relatorios", "Ver tudo")}
        ajuda="As últimas tarefas concluídas, com a hora e quem fez." fonte={feitas ? "issues concluídas da fila do Cortex" : null} atualizadoEm={feitas?.em || null}>
        {feitas && feitas.itens.length === 0 ? <p className="kx-sem">Nenhuma concluída ainda.</p> : (
          <ul className="kx-lista">{(feitas?.itens || []).map((t) => (
            <li key={t.numero} style={{ minHeight: 30 }}><span className="kx-bola" style={{ background: "#22c55e" }} /><span className="kx-mut" style={{ width: 40 }}>{hora(t.quando)}</span>
              <span className="kx-titulo">#{t.numero} {t.titulo}{t.ia ? ` · ${t.ia}` : ""}</span></li>
          ))}</ul>
        )}
      </Bloco>

      <Bloco className="kx-span4" titulo="Status das máquinas" icone="pc" corIcone="#34d399" ver={ver("maquinas", "Ver detalhes")}
        ajuda="PC 1 e PC 2 aparecem quando mandarem sinal (Operário instalado)." fonte={temMaq ? "batimento dos PCs (banco maquinas)" : null} atualizadoEm={maq?.em || null}>
        <table className="kx-tabela">
          <thead><tr><th>Nome</th><th>Status</th><th className="kx-esconde-cel">Último sinal</th></tr></thead>
          <tbody>{(maq?.maquinas || []).slice(0, 4).map((m) => (
            <tr key={m.nome}><td>{m.nome}</td><td><span className="kx-selo" style={{ background: m.online ? "#16a34a" : "#64748b" }}>{m.online ? "Online" : "Desligado"}</span></td><td className="kx-esconde-cel">{haQuanto(m.visto_em)}</td></tr>
          ))}</tbody>
        </table>
      </Bloco>

      {aviso && <div className="kx-aviso" role="status" data-testid="kx-aviso">{aviso}</div>}
    </div>
  );
}
