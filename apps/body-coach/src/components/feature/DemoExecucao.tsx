import { useEffect, useState } from 'react';
import { demoDoExercicio } from '@/lib/exerciseDb';

// Demonstração do exercício: dois quadros (início e fim do movimento) que alternam com transição suave.
// Toque para pausar/continuar. Vem do banco próprio (public/exercicios), então não gasta internet com vídeo.
export default function DemoExecucao({ id, nome, className = '' }: { id: string; nome: string; className?: string }) {
  const frames = demoDoExercicio(id);
  const [fim, setFim] = useState(false);
  const [rodando, setRodando] = useState(true);
  useEffect(() => {
    if (!frames || !rodando) return;
    const t = setInterval(() => setFim((v) => !v), 900);
    return () => clearInterval(t);
  }, [frames, rodando]);
  if (!frames) {
    return (
      <div className={`flex items-center justify-center bg-background-900 text-background-50 ${className}`}>
        <div className="p-4 text-center">
          <i className="ri-body-scan-line text-4xl text-primary-400"></i>
          <p className="mt-1 text-xs text-background-400">Sem demonstração para este exercício. Pergunte ao coach como executar.</p>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setRodando((v) => !v)}
      aria-label={`${rodando ? 'Pausar' : 'Tocar'} demonstração de ${nome}`}
      className={`relative block overflow-hidden bg-background-900 ${className}`}
    >
      <img src={frames[0]} alt={`${nome}: posição inicial`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <img src={frames[1]} alt={`${nome}: posição final`} loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${fim ? 'opacity-100' : 'opacity-0'}`} />
      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
        <i className={`${rodando ? 'ri-pause-fill' : 'ri-play-fill'} mr-0.5`}></i>{rodando ? 'toque p/ pausar' : 'toque p/ tocar'}
      </span>
    </button>
  );
}
