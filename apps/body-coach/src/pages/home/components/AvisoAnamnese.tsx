import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { minhaAnamnese } from '@/lib/coach/equipe';

// Aluno com anamnese do coach por responder: um cartão no Hoje (confere uma vez por abertura do app).
export default function AvisoAnamnese() {
  const { user } = useAuth();
  const [coach, setCoach] = useState('');
  useEffect(() => {
    if (!user) return;
    const chave = `bc_anam_${user.id}`;
    try { if (sessionStorage.getItem(chave) === 'ok') return; } catch { /* sem armazenamento: confere sempre */ }
    let vivo = true;
    minhaAnamnese().then((r) => {
      if (!vivo) return;
      if (r.situacao === 'pendente') setCoach(r.coach || 'Seu coach');
      else try { sessionStorage.setItem(chave, 'ok'); } catch { /* ok */ }
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [user]);
  if (!coach) return null;
  return (
    <Link to="/anamnese" className="flex items-center gap-3 rounded-2xl border border-secondary-300 bg-secondary-50 p-4" data-testid="aviso-anamnese">
      <i className="ri-survey-line text-2xl text-secondary-700"></i>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground-950">{coach} quer te conhecer melhor</span>
        <span className="block text-xs text-foreground-600">Responda a anamnese para a ficha e a dieta ficarem do seu jeito.</span>
      </span>
      <i className="ri-arrow-right-s-line text-xl text-secondary-700"></i>
    </Link>
  );
}
