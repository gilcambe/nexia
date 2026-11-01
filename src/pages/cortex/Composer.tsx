import { useEffect, useRef, useState } from "react";
import { usePedidos } from "@/pages/meu-cortex/api";

interface Props {
  modo: "pedido" | "nota" | "pergunta";
  enviar: (texto: string, modoResposta?: "rapido" | "pensar" | "pesquisar") => Promise<void>;
  inicial?: string;
}

type Reconhecedor = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
const criarReconhecedor = (): Reconhecedor | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  return C ? new C() : null;
};

const MAX = 60000;

const paraBase64 = (f: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = () => no(r.error); r.readAsDataURL(f); });

// Função auxiliar para verificar se arquivo é pequeno e pode ser lido localmente
const ehArquivoTextoPequeno = (f: File): boolean => {
  return (f.type.startsWith("text/") || /\.(txt|csv|xlsm|xls|ods)$/i.test(f.name)) && f.size <= 100_000;
};

// Print ou foto: reduz até caber (~40 mil letras) para o pedido não passar do limite do GitHub.
async function reduzirImagem(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  for (const [lado, q] of [[1100, 0.6], [900, 0.5], [700, 0.45], [520, 0.4]] as const) {
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (url.length < 40_000) return url;
  }
  throw new Error("imagem grande demais");
}

// Caixa de mensagem estilo app de IA: cresce sozinha, anexa arquivo de texto, dita por voz e envia.
export default function Composer({ modo, enviar, inicial = "" }: Props) {
  const [texto, setTexto] = useState(inicial);
  const [ouvindo, setOuvindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modoResposta, setModoResposta] = useState<"rapido" | "pensar" | "pesquisar">("rapido");
  const area = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [anexos, setAnexos] = useState<{ nome: string; md: string }[]>([]);
  const voz = useRef<Reconhecedor | null>(null);

  useEffect(() => { setTexto(inicial); }, [inicial]);
  useEffect(() => {
    const a = area.current; if (!a) return;
    a.style.height = "auto"; a.style.height = `${Math.min(a.scrollHeight, 220)}px`;
  }, [texto]);

  const minimo = modo === "pedido" ? 10 : 2;
  const pode = !ocupado && texto.trim().length >= minimo && texto.length <= MAX;

  const mandar = async () => {
    if (!pode) return;
    const conteudoCompleto = [texto.trim(), ...anexos.map((a) => a.md)].join("\n\n");
    if (conteudoCompleto.length > MAX) {
      setAviso(`O pedido com os anexos tem ${conteudoCompleto.length.toLocaleString("pt-BR")} caracteres e excede o limite máximo de ${MAX.toLocaleString("pt-BR")}. Reduza o texto ou remova alguns anexos.`);
      return;
    }
    setOcupado(true); setAviso(null);
    try { await enviar(conteudoCompleto, modoResposta); setTexto(""); setAnexos([]); } catch (e) { setAviso((e as Error).message); } finally { setOcupado(false); }
  };

  // Qualquer tipo de arquivo: texto/código entra como texto; print/foto é reduzido; o resto vai embutido se for pequeno.
  // #825: foto, PDF, planilha e áudio passam pela IA grátis do servidor (descrição, texto ou transcrição).
  const { agir } = usePedidos();
  const entender = async (f: File): Promise<{ ok: boolean; texto?: string; tipo?: string }> => {
    if (f.size > 700_000 || !/^(image|audio)\//.test(f.type) && !/\.(pdf|xlsx|xlsm|xls|ods|docx|odt|csv|mp3|m4a|wav|ogg|opus|webm)$/i.test(f.name)) 
      return { ok: false };
    
    try {
      const r = await agir({ acao: "entender", nome: f.name, tipo: f.type, base64: await paraBase64(f) }) as { ok: boolean; texto?: string; tipo?: string };
      if (!r.ok || !r.texto) {
        // Fallback para arquivos pequenos de texto/planilha
        const isTextoPequeno = ehArquivoTextoPequeno(f);
        if (isTextoPequeno) {
          try {
            const conteudo = await f.text();
            return { ok: true, texto: conteudo, tipo: "texto" };
          } catch {
            return { ok: false };
          }
        }
        return { ok: false };
      }
      const como = r.tipo === "imagem" ? "descrição da imagem" : r.tipo === "audio" ? "transcrição do áudio" : "texto do arquivo";
      return { ok: true, texto: `Anexo \`${f.name}\` (${como}, feita pela IA):\n\`\`\`\n${r.texto}\n\`\`\``, tipo: r.tipo };
    } catch { 
      // Fallback para arquivos pequenos de texto/planilha
      const isTextoPequeno = ehArquivoTextoPequeno(f);
      if (isTextoPequeno) {
        try {
          const conteudo = await f.text();
          return { ok: true, texto: conteudo, tipo: "texto" };
        } catch {
          return { ok: false };
        }
      }
      return { ok: false }; 
    }
  };
  const anexar = async (f: File | undefined) => {
    if (!f) return;
    setAviso(null);
    try {
      let bloco: string;
      const entendido = await entender(f);
      if (entendido && f.type.startsWith("image/")) bloco = `![${f.name}](${await reduzirImagem(f).catch(() => "")})\n\n${entendido}`;
      else if (entendido) bloco = entendido;
      else if (f.type.startsWith("image/")) bloco = `![${f.name}](${await reduzirImagem(f)})`;
      else if (f.type.startsWith("text/") || /\.(txt|md|js|ts|tsx|jsx|json|css|html|yml|yaml|csv|log|sql|sh|py|xlsx|xls|ods)$/i.test(f.name)) {
        if (f.size > 60_000) { setAviso("Esse arquivo de texto passa de 60 KB. Mande só o trecho que importa."); return; }
        bloco = `Arquivo \`${f.name}\`:\n\`\`\`\n${await f.text()}\n\`\`\``;
      } else {
        // Aviso específico por tipo de arquivo
        if (f.type.startsWith('application/pdf') || f.name.toLowerCase().endsWith('.pdf')) {
          setAviso(`Não consegui ler o PDF \`${f.name}\`.`); return;
        } else if (f.type.startsWith('text/') || /\.(txt|csv|xlsm|xls|ods)$/i.test(f.name)) {
          setAviso(`Não consegui ler o arquivo de texto \`${f.name}\`.`); return;
        } else {
          setAviso(`Não consegui ler o arquivo \`${f.name}\`.`); return;
        }
      }
      setAnexos((a) => [...a, { nome: f.name, md: bloco }]);
    } catch { setAviso(`Não consegui ler o arquivo \`${f.name}\`.`); }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [gravando, setGravando] = useState(false);

  const iniciarGravacao = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setAviso("Seu navegador não suporta gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 100) { setGravando(false); return; }
        setOcupado(true);
        try {
          const file = new File([blob], "voz.webm", { type: blob.type });
          const ent = await entender(file);
          if (ent) {
            const t = ent.replace(/^Anexo `.*` \([^)]+\):\n```\n?/, "").replace(/\n?```$/, "").trim();
            if (t) setTexto((prev) => `${prev}${prev ? " " : ""}${t}`);
          } else {
            setAviso("Não foi possível transcrever o áudio.");
          }
        } catch {
          setAviso("Erro ao processar o áudio.");
        } finally {
          setOcupado(false);
          setGravando(false);
        }
      };
      mr.start();
      setGravando(true);
      setAviso(null);
    } catch {
      setAviso("Permissão do microfone negada.");
    }
  };

  const ditar = () => {
    if (gravando) { mediaRecorderRef.current?.stop(); return; }
    if (ouvindo) { voz.current?.stop(); setOuvindo(false); return; }

    const r = criarReconhecedor();
    if (r) {
      r.lang = "pt-BR"; r.interimResults = false;
      r.onresult = (e) => { const frase = Array.from(e.results).map((x) => x[0].transcript).join(" "); setTexto((t) => `${t}${t ? " " : ""}${frase}`); };
      r.onend = () => setOuvindo(false);
      voz.current = r; setOuvindo(true); r.start();
      return;
    }

    void iniciarGravacao();
  };

  const btn = "w-11 h-11 rounded-full flex items-center justify-center text-[var(--cx-mut)] hover:bg-[var(--cx-hover)] shrink-0";
  return (
    <div className="w-full max-w-3xl mx-auto px-3 pb-3">
      <div className="rounded-3xl border border-[var(--cx-line)] bg-[var(--cx-card)] shadow-[0_8px_40px_-12px_rgba(0,0,0,.35)] focus-within:border-[var(--cx-ac)] transition-colors">
        <textarea ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={MAX} data-testid="cx-texto"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mandar(); } }}
          placeholder={modo === "pedido" ? "O que o Cortex deve fazer? Diga o projeto e o que mudar." : modo === "pergunta" ? "Pergunte ao Cortex. A resposta chega na hora." : "Anotação neste pedido. O Cortex lê só o pedido: para mudar o que ele faz, abra um Novo pedido."}
          className="w-full resize-none bg-transparent outline-none px-5 pt-4 pb-2 text-[15px] leading-6 text-[var(--cx-txt)] placeholder:text-[var(--cx-mut)] max-h-[220px]" />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button type="button" className={btn} aria-label="Anexar arquivo ou print" onClick={() => arquivo.current?.click()} data-testid="cx-anexo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input ref={arquivo} type="file" hidden onChange={(e) => { anexar(e.target.files?.[0]); e.target.value = ""; }} />
          <span className="flex-1 text-xs text-[var(--cx-mut)] px-2 truncate">{texto.length > MAX - 300 ? `${texto.length}/${MAX}` : "Ctrl+Enter envia"}</span>
          <button type="button" className={`${btn} ${ouvindo || gravando ? "!text-red-400 animate-pulse bg-red-500/10" : ""}`} aria-label={ouvindo || gravando ? "Parar de ouvir" : "Ditar por voz"} onClick={ditar} data-testid="cx-mic">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          
          {/* Seletor de modo de resposta (#831): só vale em "Perguntar agora", onde a resposta chega na hora. */}
          {modo === "pergunta" && <div data-testid="cx-modos" className="flex items-center gap-1 bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-lg px-2 py-1 shrink-0">
            <button 
              type="button" 
              onClick={() => setModoResposta("rapido")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${modoResposta === "rapido" ? "bg-[#00d4aa] text-black" : "text-[var(--cx-mut)] hover:bg-[var(--cx-hover)]"}`}
              aria-label="Modo Rápido"
              title="Resposta rápida e direta"
            >
              Rápido
            </button>
            <button 
              type="button" 
              onClick={() => setModoResposta("pensar")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${modoResposta === "pensar" ? "bg-[#7c6cf0] text-white" : "text-[var(--cx-mut)] hover:bg-[var(--cx-hover)]"}`}
              aria-label="Modo Pensar"
              title="Análise aprofundada com raciocínio"
            >
              Pensar
            </button>
            <button 
              type="button" 
              onClick={() => setModoResposta("pesquisar")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${modoResposta === "pesquisar" ? "bg-[#f59e0b] text-white" : "text-[var(--cx-mut)] hover:bg-[var(--cx-hover)]"}`}
              aria-label="Modo Pesquisar"
              title="Busca por informações atualizadas"
            >
              Pesquisar
            </button>
          </div>}

          <button type="button" onClick={mandar} disabled={!pode} aria-label="Enviar" data-testid="cx-enviar"
            className="w-11 h-11 rounded-full flex items-center justify-center text-black bg-gradient-to-br from-[#00d4aa] to-[#7c6cf0] disabled:opacity-30 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>
      {anexos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 px-2" data-testid="cx-anexos">
          {anexos.map((a, i) => (
            <button key={i} type="button" onClick={() => setAnexos((l) => l.filter((_, k) => k !== i))} className="text-xs rounded-full border border-[var(--cx-line)] px-3 py-1 text-[var(--cx-mut)]" aria-label={`Tirar ${a.nome}`}>{a.nome} ✕</button>
          ))}
        </div>
      )}
      {aviso && <p className="text-sm text-red-400 mt-2 px-2" role="alert">{aviso}</p>}
    </div>
  );
}
