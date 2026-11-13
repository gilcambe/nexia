import { useCallback, useEffect, useRef, useState } from "react";
import { useCentral } from "../api";
import { usePedidos } from "../../meu-cortex/api";
import Icone from "./Icone";
import { MAX_BYTES, blocoDoAnexo, paraBase64, reduzirFoto } from "./anexo";
import type { Status } from "./fabricaRegras";
import { falta, fichaParaFabrica, intencao, lerFicha, pedidoDeMudanca, pergunta, previaNaMoldura, resumoFicha, type FichaChat } from "./conversaRegras";

// C2-F2 (PC 2, 13/11): "Conversar" = chat com o Cortex à esquerda e prévia ao vivo à direita.
// Projeto "Novo site": o Cortex pergunta o que falta, a Fábrica gera, a prévia aparece; [Gostei, publicar] / [Mudar].
// Projeto existente: a mensagem vira pedido na fila do Cortex, com o projeto e a prévia que o dono estava vendo.
type Msg = { de: "eu" | "cortex"; texto: string; link?: string };
const NOVO = "__novo__";
const OI: Msg = { de: "cortex", texto: "Oi! Me diga o que você quer. Ex.: \"crie um site para a barbearia do João em Recife, WhatsApp 81 99999-9999\". Para mexer num projeto que já existe, escolha ele lá em cima." };

export default function Conversar() {
  const { ler, agir } = useCentral();
  const pedidos = usePedidos();
  const [projetos, setProjetos] = useState<{ id: string; nome?: string }[]>([]);
  const [projeto, setProjeto] = useState(NOVO);
  const [msgs, setMsgs] = useState<Msg[]>([OI]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const [ficha, setFicha] = useState<FichaChat>({});
  const [id, setId] = useState<string | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { pedidos.projetos<{ projetos: { id: string; nome?: string }[] }>().then((d) => setProjetos(d?.projetos || [])).catch(() => setProjetos([])); }, [pedidos.projetos]);
  useEffect(() => { fim.current?.scrollIntoView?.({ block: "end" }); }, [msgs]);
  const diz = (m: Msg) => setMsgs((xs) => [...xs, m]);

  const acompanhar = useCallback(async (novo: string) => {
    for (let i = 0; i < 60; i++) {
      try {
        const s = await ler<Status>(`parte=fabrica-status&id=${encodeURIComponent(novo)}`);
        setSt(s);
        if (s.status === "previa") { diz({ de: "cortex", texto: "Prévia pronta, está ao lado. Gostou? Toque em \"Gostei, publicar\" ou me diga o que mudar.", link: s.previa }); return; }
        if (s.status === "reprovado") { diz({ de: "cortex", texto: "A prévia não passou nos testes automáticos. Já avisei o Cortex; tente de novo em alguns minutos ou mude o pedido." }); return; }
        if (s.status === "no-ar") return;
      } catch (e) { diz({ de: "cortex", texto: "Não consegui acompanhar: " + (e as Error).message }); return; }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }, [ler]);

  const gerar = async (f: FichaChat) => {
    setOcupado("gerar"); setSt({ status: "gerando" });
    try {
      const c = await agir<{ modelo?: { id: string; nome: string } | null }>({ acao: "fabrica-consultar", ficha: fichaParaFabrica(f) }).catch(() => null);
      const r = await agir<{ id: string; status: Status["status"] }>({ acao: "fabrica-criar", ficha: fichaParaFabrica(f), modelo: c?.modelo?.id || null });
      setId(r.id); setSt({ status: r.status });
      diz({ de: "cortex", texto: `Gerando${c?.modelo ? ` a partir do modelo "${c.modelo.nome}"` : ""}… leva uns minutos. Pode esperar aqui.` });
      await acompanhar(r.id);
    } catch (e) { setSt(null); diz({ de: "cortex", texto: "Não deu certo: " + (e as Error).message }); }
    setOcupado(null);
  };

  const publicar = async () => {
    if (!id || !window.confirm(`Publicar "${ficha.nome || "o site"}" para todo mundo ver?`)) return;
    setOcupado("publicar");
    try {
      const r = await agir<{ endereco?: string; reserva?: string }>({ acao: "fabrica-publicar", id });
      setSt((s) => ({ ...(s || { status: "previa" }), status: "no-ar" }));
      diz({ de: "cortex", texto: `Publicando (1 a 2 minutos).${r?.reserva ? ` Se o endereço ainda não abrir, use ${r.reserva}.` : ""}`, link: r?.endereco });
    } catch (e) { diz({ de: "cortex", texto: "Não deu certo: " + (e as Error).message }); }
    setOcupado(null);
  };

  const mandarMudanca = async (t: string) => {
    const nome = projeto === NOVO ? (ficha.nome || "site novo") : (projetos.find((p) => p.id === projeto)?.nome || projeto);
    setOcupado("pedir");
    try {
      const r = await pedidos.agir({ acao: "pedir", texto: pedidoDeMudanca(nome, t, st?.previa) }) as { mensagem: string; link?: string };
      diz({ de: "cortex", texto: r.mensagem + " Quando o Cortex terminar, a prévia nova aparece aqui para você aprovar.", link: r.link });
    } catch (e) { diz({ de: "cortex", texto: "Não deu certo: " + (e as Error).message }); }
    setOcupado(null);
  };

  const mandar = async () => {
    const t = [texto.trim(), ...anexos].filter(Boolean).join("\n\n");
    if (t.length < 2 || ocupado) return;
    diz({ de: "eu", texto: t }); setTexto(""); setAnexos([]);
    const temPrevia = !!st?.previa;
    const qual = intencao(t, temPrevia);
    if (qual === "publicar") { await publicar(); return; }
    if (projeto !== NOVO || (temPrevia && qual !== "criar")) { await mandarMudanca(t); return; }
    const f = lerFicha(t, ficha); setFicha(f);
    // Pergunta solta ("como está a fila?") sem nada de ficha: a Central responde ou vira pedido comum.
    if (qual === "conversa" && !Object.keys(ficha).length && !Object.keys(f).length) {
      setOcupado("pedir");
      try { const r = await pedidos.agir({ acao: "pedir", texto: t }) as { mensagem: string; link?: string }; diz({ de: "cortex", texto: r.mensagem, link: r.link }); }
      catch (e) { diz({ de: "cortex", texto: "Não deu certo: " + (e as Error).message }); }
      setOcupado(null); return;
    }
    if (falta(f).length) { diz({ de: "cortex", texto: pergunta(f) }); return; }
    diz({ de: "cortex", texto: resumoFicha(f) });
    await gerar(f);
  };

  const anexar = async (arq: File | undefined) => {
    if (!arq) return;
    setOcupado("anexo");
    try {
      const b = await reduzirFoto(arq);
      if (b.size > MAX_BYTES) throw new Error("arquivo grande demais (máx. 700 KB)");
      const base64 = await paraBase64(b);
      const [g, e] = await Promise.allSettled([agir<{ caminho?: string }>({ acao: "anexar", nome: arq.name, base64 }), agir<{ texto?: string }>({ acao: "entender", nome: arq.name, tipo: arq.type, base64 })]);
      const caminho = g.status === "fulfilled" ? g.value?.caminho || null : null;
      const lido = e.status === "fulfilled" ? e.value?.texto || null : null;
      setAnexos((xs) => [...xs, blocoDoAnexo(arq.name, caminho, lido)]);
    } catch (err) { diz({ de: "cortex", texto: "Não consegui anexar: " + (err as Error).message }); }
    setOcupado(null);
  };

  const previa = st?.previa || null;
  return (
    <div className="kx-tela" data-testid="kx-conversar">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label htmlFor="kx-conv-projeto">Projeto:</label>
        <select id="kx-conv-projeto" className="kx-busca" style={{ minHeight: 40 }} value={projeto} data-testid="kx-conv-projeto"
          onChange={(e) => { setProjeto(e.target.value); setSt(null); setId(null); setFicha({}); }}>
          <option value={NOVO}>✨ Novo site ou sistema</option>
          {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome || p.id}</option>)}
        </select>
      </div>
      <div className="kx-grade kx-conv" style={{ gridTemplateColumns: "minmax(300px,2fr) 3fr" }}>
        <section className="kx-bloco kx-assist" style={{ display: "flex", flexDirection: "column", minHeight: 420 }} aria-label="Conversa com o Cortex">
          <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }} data-testid="kx-conv-msgs">
            {msgs.map((m, i) => (
              <div key={i} style={{ justifySelf: m.de === "eu" ? "end" : "start", maxWidth: "88%", whiteSpace: "pre-wrap", padding: "8px 12px", borderRadius: 12, background: m.de === "eu" ? "#4f46e5" : "#0b1533", border: "1px solid var(--linha)" }}>
                {m.texto}{m.link && <> <a href={m.link} target="_blank" rel="noreferrer">abrir</a></>}
              </div>
            ))}
            {ocupado && <div className="kx-mut">{ocupado === "anexo" ? "Lendo o anexo…" : "O Cortex está trabalhando…"}</div>}
            <div ref={fim} />
          </div>
          {anexos.length > 0 && <p className="kx-mut" data-testid="kx-conv-anexos">📎 {anexos.length} anexo(s) vão junto com a próxima mensagem.</p>}
          <textarea data-testid="kx-conv-texto" aria-label="Sua mensagem" placeholder="Escreva aqui…" value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <label className="kx-btn" style={{ cursor: "pointer" }} data-testid="kx-conv-anexar" title="Foto, logo, PDF ou planilha">
              📎 Anexar
              <input type="file" hidden accept="image/*,application/pdf,.txt,.csv,.xlsx,.xls,.doc,.docx" disabled={!!ocupado} onChange={(e) => { anexar(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" className="kx-btn forte" style={{ flex: 1, justifyContent: "center" }} disabled={!!ocupado} onClick={mandar} data-testid="kx-conv-mandar"><Icone nome="enviar" tam={16} />Mandar</button>
          </div>
        </section>
        <section className="kx-bloco" style={{ display: "flex", flexDirection: "column", minHeight: 420 }} aria-label="Prévia" data-testid="kx-conv-previa">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <b style={{ flex: 1 }}>Prévia</b>
            {previa && <a className="kx-btn" href={previa} target="_blank" rel="noreferrer">Abrir em tela cheia</a>}
            {st?.status === "previa" && id && <button type="button" className="kx-btn verde" disabled={!!ocupado} onClick={publicar} data-testid="kx-conv-publicar">Gostei, publicar</button>}
            {previa && <button type="button" className="kx-btn" disabled={!!ocupado} onClick={() => setTexto("Mudar: ")} data-testid="kx-conv-mudar">Mudar…</button>}
          </div>
          {previa && previaNaMoldura(previa)
            ? <iframe title="Prévia do site" src={previa} style={{ flex: 1, width: "100%", border: "1px solid var(--linha)", borderRadius: 12, background: "#fff" }} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            : <p className="kx-mut" style={{ whiteSpace: "normal" }}>{st?.status === "gerando" ? "Gerando a prévia… ela aparece aqui sozinha." : previa ? "Esta prévia abre só em outra aba (toque em \"Abrir em tela cheia\")." : "A prévia aparece aqui quando o Cortex terminar."}</p>}
        </section>
      </div>
    </div>
  );
}
