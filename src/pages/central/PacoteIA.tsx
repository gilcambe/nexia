import { useState } from "react";
import { useCentral } from "./api";
import { montarPacote } from "./pacoteTexto";
import { Cartao, Botao } from "./ui";

const IAS = [
  { nome: "ChatGPT", url: "https://chatgpt.com/" },
  { nome: "Gemini", url: "https://gemini.google.com/app" },
  { nome: "Claude", url: "https://claude.ai/new" },
  { nome: "DeepSeek", url: "https://chat.deepseek.com/" },
  { nome: "Qwen", url: "https://chat.qwen.ai/" },
];

export default function PacoteIA() {
  const { buscar } = useCentral();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const gerar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const t = montarPacote(await buscar("pacote-ia"));
      setTexto(t);
      try { await navigator.clipboard.writeText(t); setMsg("Copiado! Abra uma IA abaixo e cole como primeira mensagem."); }
      catch { setMsg("Toque no texto abaixo, selecione tudo e copie."); }
    } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  const baixar = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
    a.download = `continuar-nexia-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Cartao titulo="📦 Continuar em outra IA">
      <p className="text-sm text-nexia-muted">Se os créditos do Claude acabarem: copie o pacote e cole em qualquer IA grátis. Ela continua de onde parou.</p>
      <div className="grid grid-cols-2 gap-2">
        <Botao onClick={gerar} disabled={ocupado} tipo="forte" testid="pacote-ia-copiar">{ocupado ? "Montando..." : "📋 Copiar pacote"}</Botao>
        <Botao onClick={baixar} disabled={!texto} testid="pacote-ia-baixar">⬇️ Baixar arquivo</Botao>
      </div>
      {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
      <div className="grid grid-cols-3 gap-2">
        {IAS.map((i) => <Botao key={i.nome} href={i.url}>{i.nome}</Botao>)}
      </div>
      {texto && <textarea readOnly value={texto} rows={6} data-testid="pacote-ia-texto"
        className="w-full rounded-xl bg-nexia-surface2 border border-nexia-border p-3 text-xs text-white" />}
    </Cartao>
  );
}
