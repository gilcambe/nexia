import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { pendencias } from '@/lib/coach/negocio';
import { reais } from '@/lib/ferramentas/pix';

type Pend = Awaited<ReturnType<typeof pendencias>>;

// Pendências do aluno com o coach, no Hoje: anamnese por responder e mensalidade perto de vencer (confere uma vez por abertura do app).
export default function AvisoAnamnese() {
  const { user } = useAuth();
  const [p, setP] = useState<Pend | null>(null);
  useEffect(() => {
    if (!user) return;
    const chave = `bc_anam_${user.id}`;
    try { if (sessionStorage.getItem(chave) === 'ok') return; } catch { /* sem armazenamento: confere sempre */ }
    let vivo = true;
    pendencias().then((r) => {
      if (!vivo) return;
      if (r.anamnese === 'pendente' || r.mensalidade) setP(r);
      else try { sessionStorage.setItem(chave, 'ok'); } catch { /* ok */ }
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [user]);
  if (!p) return null;
  const m = p.mensalidade;
  return (
    <>
      {p.anamnese === 'pendente' && (
        <Link to="/anamnese" className="flex items-center gap-3 rounded-2xl border border-secondary-300 bg-secondary-50 p-4" data-testid="aviso-anamnese">
          <i className="ri-survey-line text-2xl text-secondary-700"></i>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground-950">{p.coach} quer te conhecer melhor</span>
            <span className="block text-xs text-foreground-600">Responda a anamnese para a ficha e a dieta ficarem do seu jeito.</span>
          </span>
          <i className="ri-arrow-right-s-line text-xl text-secondary-700"></i>
        </Link>
      )}
      {m && (
        <Link to="/ferramentas/mensalidade" className={`flex items-center gap-3 rounded-2xl border p-4 ${m.dias < 0 ? 'border-red-300 bg-red-50' : 'border-background-200 bg-background-50'}`} data-testid="aviso-mensalidade">
          <i className={`ri-money-dollar-circle-line text-2xl ${m.dias < 0 ? 'text-red-600' : 'text-primary-600'}`}></i>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground-950">{m.avisou ? 'Mensalidade: aguardando o coach confirmar' : m.dias > 0 ? `Mensalidade vence em ${m.dias} dia${m.dias > 1 ? 's' : ''}` : m.dias === 0 ? 'Mensalidade vence hoje' : 'Mensalidade atrasada'}</span>
            <span className="block text-xs text-foreground-600">{reais(m.valor)} · dia {m.vencimento} · pague por Pix no app</span>
          </span>
          <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
        </Link>
      )}
    </>
  );
}
