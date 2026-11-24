import { useMemo } from 'react';

// Confete leve, só CSS (sem biblioteca). Some sozinho em ~3 s e respeita "reduzir movimento".
const CORES = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#14b8a6'];

export default function Confete({ quantos = 40 }: { quantos?: number }) {
  const pedacos = useMemo(() => Array.from({ length: quantos }, (_, i) => ({
    esquerda: Math.random() * 100,
    atraso: Math.random() * 0.6,
    duracao: 1.8 + Math.random() * 1.4,
    cor: CORES[i % CORES.length],
    giro: Math.random() * 360,
    largura: 6 + Math.random() * 5,
  })), [quantos]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style>{`@keyframes bc-confete{0%{transform:translateY(-10vh) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}@media (prefers-reduced-motion: reduce){.bc-confete{display:none}}`}</style>
      {pedacos.map((p, i) => (
        <span
          key={i}
          className="bc-confete absolute top-0 block rounded-sm"
          style={{ left: `${p.esquerda}%`, width: p.largura, height: p.largura * 1.6, background: p.cor, transform: `rotate(${p.giro}deg)`, animation: `bc-confete ${p.duracao}s ${p.atraso}s ease-in forwards`, opacity: 0 }}
        />
      ))}
    </div>
  );
}
