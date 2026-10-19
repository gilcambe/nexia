import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePapel } from '@/lib/usePapel';
import { marcarTourVisto, passosTour, tourVisto } from '@/lib/guia';

// Tour curto (4 telas) da primeira vez (um para o coach, outro para o aluno). Some depois e pode ser revisto no "Guia do app".
export default function TourGuiado() {
  const { user, profile } = useAuth();
  const papel = usePapel(false);
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);
  const passos = passosTour(papel); // 4 telas; o guia completo fica em "Guia do app"

  useEffect(() => {
    if (!user || !papel) return;
    // aluno vê o tour depois das perguntas iniciais; o coach, na primeira entrada
    if (papel !== 'coach' && !profile?.onboarding) return;
    if (!tourVisto(papel, user.id)) { setI(0); setAberto(true); }
  }, [user, papel, profile?.onboarding]);
  useEffect(() => {
    const abrir = () => { setI(0); setAberto(true); };
    window.addEventListener('bc-tour', abrir);
    return () => window.removeEventListener('bc-tour', abrir);
  }, []);

  if (!aberto || !passos.length) return null;
  const p = passos[Math.min(i, passos.length - 1)];
  const ultimo = i >= passos.length - 1;
  const fechar = () => { if (user && papel) marcarTourVisto(papel, user.id); setAberto(false); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground-950/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Tour do app" data-testid="tour">
      <div className="w-full max-w-md rounded-3xl bg-background-50 p-6 text-center shadow-xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600"><i className={`${p.icone} text-3xl`}></i></span>
        <h2 className="mt-3 font-heading text-xl font-bold text-foreground-950">{p.titulo}</h2>
        <p className="mt-2 text-base text-foreground-700">{p.texto}</p>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {passos.map((x, k) => <span key={x.titulo} className={`h-2 rounded-full ${k === i ? 'w-6 bg-primary-500' : 'w-2 bg-background-300'}`}></span>)}
        </div>
        <p className="mt-1 text-xs text-foreground-400">{i + 1} de {passos.length}</p>
        {i > 0 && !ultimo && <button onClick={fechar} className="mt-1 text-xs font-medium text-foreground-500 underline">Pular o tour</button>}
        {p.rota && <button onClick={() => { navigate(p.rota!); }} className="mt-3 text-sm font-semibold text-primary-600 underline">Abrir esta tela</button>}
        <div className="mt-4 flex gap-2">
          {i > 0 ? <button onClick={() => setI(i - 1)} className="flex-1 rounded-xl border border-background-200 py-3 text-base font-medium text-foreground-700">Voltar</button>
            : <button onClick={fechar} className="flex-1 rounded-xl border border-background-200 py-3 text-base font-medium text-foreground-700">Pular</button>}
          <button onClick={() => (ultimo ? fechar() : setI(i + 1))} className="flex-1 rounded-xl bg-primary-500 py-3 text-base font-semibold text-background-50">{ultimo ? 'Começar' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  );
}
