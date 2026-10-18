import { useState } from "react";
import Logo from "./Logo";

const SLIDES = [
  { titulo: "Bem-vindo ao Cortex", texto: "O cérebro da NEXIA. Você escreve do jeito que fala e ele entende o projeto, faz o trabalho e entrega pronto." },
  { titulo: "Peça qualquer coisa", texto: "Body Coach, sites de clientes ou o próprio Cortex. Escreva o pedido, anexe um arquivo ou dite pelo microfone." },
  { titulo: "Acompanhe tudo", texto: "Cada pedido vira uma conversa com o estado ao vivo, o histórico completo e as entregas com testes." },
  { titulo: "Você aprova, ele publica", texto: "Quando a entrega estiver pronta, um toque em Aprovar e juntar coloca no ar. Tudo grátis e no seu celular." },
];

export const CHAVE_INTRO = "cx_intro_visto";
export const introVista = () => { try { return localStorage.getItem(CHAVE_INTRO) === "1"; } catch { return false; } };

// Apresentação da NEXIA na primeira abertura (como no Body Coach): 4 telas, dá para pular e rever em Configurações.
export default function Apresentacao({ fechar }: { fechar: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const ultimo = i === SLIDES.length - 1;
  const terminar = () => { try { localStorage.setItem(CHAVE_INTRO, "1"); } catch { /* sem armazenamento: aparece de novo */ } fechar(); };
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-[var(--cx-bg)]" role="dialog" aria-modal="true" data-testid="cx-apresentacao">
      <button onClick={terminar} className="absolute top-4 right-4 h-11 px-4 text-sm text-[var(--cx-mut)]" data-testid="cx-intro-pular">Pular</button>
      <Logo tamanho={88} />
      <p className="mt-4 text-xs tracking-[0.3em] text-[var(--cx-mut)]">NEXIA · CORTEX</p>
      <h2 className="text-3xl font-semibold mt-8 max-w-md">{s.titulo}</h2>
      <p className="text-[var(--cx-mut)] mt-3 max-w-md leading-relaxed">{s.texto}</p>
      <div className="flex gap-2 mt-8" aria-hidden="true">
        {SLIDES.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-[var(--cx-ac)]" : "w-2 bg-[var(--cx-line)]"}`} />)}
      </div>
      <div className="flex gap-3 mt-10">
        {i > 0 && <button onClick={() => setI(i - 1)} className="h-12 px-6 rounded-xl border border-[var(--cx-line)]">Voltar</button>}
        <button onClick={() => (ultimo ? terminar() : setI(i + 1))} className="h-12 px-8 rounded-xl bg-[var(--cx-ac)] text-black font-semibold" data-testid="cx-intro-proximo">{ultimo ? "Começar" : "Próximo"}</button>
      </div>
    </div>
  );
}
