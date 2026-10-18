import { useEffect, useRef, useState } from "react";

interface Props {
  modo: "pedido" | "nota";
  enviar: (texto: string) => Promise<void>;
  inicial?: string;
}

type Reconhecedor = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
const criarReconhecedor = (): Reconhecedor | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  return C ? new C() : null;
};

const MAX = 3500;

// Caixa de mensagem estilo app de IA: cresce sozinha, anexa arquivo de texto, dita por voz e envia.
export default function Composer({ modo, enviar, inicial = "" }: Props) {
  const [texto, setTexto] = useState(inicial);
  const [ouvindo, setOuvindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
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
    setOcupado(true); setAviso(null);
    try { await enviar(texto.trim()); setTexto(""); } catch (e) { setAviso((e as Error).message); } finally { setOcupado(false); }
  };

  const anexar = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 100_000 || /^(image|video|audio)\//.test(f.type)) { setAviso("Por enquanto só arquivos de texto ou código, de até 100 KB."); return; }
    const conteudo = await f.text();
    setTexto((t) => `${t}${t ? "\n\n" : ""}Arquivo \`${f.name}\`:\n\`\`\`\n${conteudo}\n\`\`\``.slice(0, MAX + 200));
  };

  const ditar = () => {
    if (ouvindo) { voz.current?.stop(); return; }
    const r = criarReconhecedor();
    if (!r) { setAviso("Este navegador não tem ditado por voz. Use o Chrome."); return; }
    r.lang = "pt-BR"; r.interimResults = false;
    r.onresult = (e) => { const frase = Array.from(e.results).map((x) => x[0].transcript).join(" "); setTexto((t) => `${t}${t ? " " : ""}${frase}`); };
    r.onend = () => setOuvindo(false);
    voz.current = r; setOuvindo(true); r.start();
  };

  const btn = "w-11 h-11 rounded-full flex items-center justify-center text-[var(--cx-mut)] hover:bg-[var(--cx-hover)] shrink-0";
  return (
    <div className="w-full max-w-3xl mx-auto px-3 pb-3">
      <div className="rounded-3xl border border-[var(--cx-line)] bg-[var(--cx-card)] shadow-[0_8px_40px_-12px_rgba(0,0,0,.35)] focus-within:border-[var(--cx-ac)] transition-colors">
        <textarea ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} data-testid="cx-texto"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mandar(); } }}
          placeholder={modo === "pedido" ? "O que o Cortex deve fazer? Diga o projeto e o que mudar." : "Anotação neste pedido. O Cortex lê só o pedido: para mudar o que ele faz, abra um Novo pedido."}
          className="w-full resize-none bg-transparent outline-none px-5 pt-4 pb-2 text-[15px] leading-6 text-[var(--cx-txt)] placeholder:text-[var(--cx-mut)] max-h-[220px]" />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button type="button" className={btn} aria-label="Anexar arquivo de texto" onClick={() => arquivo.current?.click()} data-testid="cx-anexo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input ref={arquivo} type="file" hidden accept=".txt,.md,.js,.ts,.tsx,.json,.css,.html,.yml,.yaml,.csv" onChange={(e) => { anexar(e.target.files?.[0]); e.target.value = ""; }} />
          <span className="flex-1 text-xs text-[var(--cx-mut)] px-2 truncate">{texto.length > MAX - 300 ? `${texto.length}/${MAX}` : "Ctrl+Enter envia"}</span>
          <button type="button" className={`${btn} ${ouvindo ? "!text-red-400 animate-pulse" : ""}`} aria-label={ouvindo ? "Parar de ouvir" : "Ditar por voz"} onClick={ditar} data-testid="cx-mic">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <button type="button" onClick={mandar} disabled={!pode} aria-label="Enviar" data-testid="cx-enviar"
            className="w-11 h-11 rounded-full flex items-center justify-center text-black bg-gradient-to-br from-[#00d4aa] to-[#7c6cf0] disabled:opacity-30 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>
      {aviso && <p className="text-sm text-red-400 mt-2 px-2" role="alert">{aviso}</p>}
    </div>
  );
}
