import { useEffect, useRef, useState } from "react";
import { useCentral } from "../api";
import Bloco from "./Bloco";

// Fase 6 (13/11/2026): Consultor "?", editor de imagem e e-mails, dentro da Central.
// Editor: canvas do próprio navegador (sem instalar nada): formato de post, girar, brilho/contraste, texto, baixar PNG.
// Servidor: netlify/functions/central/ferramentas.js (acao=ferramentas-consultor, só IA grátis).
const FORMATOS: [string, string, number][] = [["Original", "orig", 0], ["Post 1:1", "1x1", 1], ["Story 9:16", "9x16", 9 / 16], ["Capa 16:9", "16x9", 16 / 9]];

function Consultor() {
  const { agir } = useCentral();
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [esperando, setEsperando] = useState(false);
  const perguntar = async () => {
    if (pergunta.trim().length < 3) return;
    setEsperando(true); setResposta("");
    try { const r = await agir<{ resposta: string }>({ acao: "ferramentas-consultor", pergunta, tela: "Ferramentas" }); setResposta(r.resposta); }
    catch (e) { setResposta((e as Error).message); } finally { setEsperando(false); }
  };
  return (
    <Bloco titulo="Consultor ?" icone="ia" ajuda="Pergunte qualquer coisa sobre a Central ou a KERNEX. Ele responde em passos simples. Usa só IA grátis." fonte="IAs grátis" atualizadoEm={null}>
      <textarea value={pergunta} onChange={(e) => setPergunta(e.target.value)} rows={3} style={{ width: "100%" }} placeholder="Ex.: como eu clono o site de um cliente?" aria-label="Sua dúvida" />
      <button type="button" className="kx-btn" onClick={perguntar} disabled={esperando || pergunta.trim().length < 3} style={{ marginTop: 8 }} data-testid="kx-consultor">{esperando ? "Pensando…" : "Perguntar"}</button>
      {resposta && <p className="kx-mut" style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{resposta}</p>}
    </Bloco>
  );
}

function EditorImagem() {
  const tela = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [nome, setNome] = useState("imagem");
  const [formato, setFormato] = useState("orig");
  const [giro, setGiro] = useState(0);
  const [brilho, setBrilho] = useState(100);
  const [contraste, setContraste] = useState(100);
  const [texto, setTexto] = useState("");
  const [corTexto, setCorTexto] = useState("#ffffff");

  const abrir = (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => { setImg(i); setNome(f.name.replace(/\.[^.]+$/, "") || "imagem"); };
    i.src = url;
  };

  useEffect(() => {
    const c = tela.current; if (!c || !img) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const deitada = giro % 180 !== 0;
    const w0 = deitada ? img.height : img.width, h0 = deitada ? img.width : img.height;
    const prop = (FORMATOS.find((f) => f[1] === formato) || FORMATOS[0])[2];
    let w = w0, h = h0;
    if (prop) { if (w0 / h0 > prop) w = Math.round(h0 * prop); else h = Math.round(w0 / prop); }
    const max = 1600, esc = Math.min(1, max / Math.max(w, h));
    c.width = Math.round(w * esc); c.height = Math.round(h * esc);
    ctx.save();
    ctx.filter = `brightness(${brilho}%) contrast(${contraste}%)`;
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate((giro * Math.PI) / 180); ctx.scale(esc, esc);
    // Corta no centro: desenha a imagem inteira centrada; o que passa do formato fica de fora.
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
    if (texto.trim()) {
      const fs = Math.round(c.width / 14);
      ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.lineWidth = Math.max(2, fs / 8); ctx.strokeStyle = "rgba(0,0,0,.65)"; ctx.fillStyle = corTexto;
      const linhas = texto.split("\n").slice(0, 4);
      linhas.forEach((l, k) => { const y = c.height - fs * 0.6 - (linhas.length - 1 - k) * fs * 1.15; ctx.strokeText(l, c.width / 2, y); ctx.fillText(l, c.width / 2, y); });
    }
  }, [img, formato, giro, brilho, contraste, texto, corTexto]);

  const baixar = () => {
    const c = tela.current; if (!c || !img) return;
    const a = document.createElement("a"); a.download = `${nome}-${formato}.png`; a.href = c.toDataURL("image/png"); a.click();
  };

  return (
    <Bloco titulo="Editor de imagem" icone="arquivo" ajuda="Abra uma foto, escolha o formato (post, story, capa), ajuste e escreva um texto. Baixa em PNG pronto para postar. A foto não sai do seu computador." fonte="Seu computador (a foto não sai dele)" atualizadoEm={null}>
      <input type="file" accept="image/*" onChange={(e) => abrir(e.target.files?.[0])} aria-label="Abrir imagem" data-testid="kx-editor-arquivo" />
      {img && (
        <div className="kx-grade" style={{ gridTemplateColumns: "minmax(200px,1fr) 2fr", marginTop: 10, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FORMATOS.map(([rot, id]) => <button key={id} type="button" className="kx-btn" aria-pressed={formato === id} onClick={() => setFormato(id)} style={formato === id ? { outline: "2px solid #6366f1" } : undefined}>{rot}</button>)}
            </div>
            <button type="button" className="kx-btn" onClick={() => setGiro((giro + 90) % 360)}>Girar 90°</button>
            <label className="kx-mut">Brilho {brilho}%<input type="range" min={40} max={160} value={brilho} onChange={(e) => setBrilho(+e.target.value)} style={{ width: "100%" }} /></label>
            <label className="kx-mut">Contraste {contraste}%<input type="range" min={40} max={160} value={contraste} onChange={(e) => setContraste(+e.target.value)} style={{ width: "100%" }} /></label>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Texto na imagem (opcional)" aria-label="Texto na imagem" />
            <label className="kx-mut">Cor do texto <input type="color" value={corTexto} onChange={(e) => setCorTexto(e.target.value)} /></label>
            <button type="button" className="kx-btn" onClick={baixar}>Baixar PNG</button>
          </div>
          <canvas ref={tela} style={{ maxWidth: "100%", maxHeight: 520, borderRadius: 8, background: "#0b1020" }} aria-label="Prévia da imagem" />
        </div>
      )}
    </Bloco>
  );
}

function Emails() {
  return (
    <Bloco titulo="E-mails" icone="enviar" ajuda="Os e-mails da KERNEX (contato@kernex.com.br) chegam no Gmail. Aqui ficam os atalhos; a lista dentro da Central vem depois, quando você autorizar o Gmail." fonte="Gmail" atualizadoEm={null}>
      <ul className="kx-lista">
        <li><span className="kx-titulo">Caixa de entrada</span><a className="kx-btn" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">Abrir Gmail</a></li>
        <li><span className="kx-titulo">Escrever um e-mail</span><a className="kx-btn" href="https://mail.google.com/mail/u/0/#inbox?compose=new" target="_blank" rel="noopener noreferrer">Novo e-mail</a></li>
        <li><span className="kx-titulo">Pedidos de orçamento dos sites</span><span className="kx-mut">ficam na tela Vendas</span></li>
      </ul>
    </Bloco>
  );
}

export default function Ferramentas() {
  return (
    <div data-testid="kx-ferramentas" style={{ display: "grid", gap: 12 }}>
      <div className="kx-grade" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Consultor />
        <Emails />
      </div>
      <EditorImagem />
    </div>
  );
}
