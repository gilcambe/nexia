import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PainelAcesso from './PainelAcesso';
import { telaPremium, usarCupomGuardado, verAcesso, type Acesso } from '@/lib/acesso';
import { avisar as avisarJanela } from '../../lib/dialogo';
import { ajustarHorariosSozinho } from '@/lib/avisos';

// Portão do app: aviso nos últimos dias e, sem Premium, as telas do Premium mostram como assinar.
// O básico (treino, ficha, água, refeições) continua grátis. O coach nunca é bloqueado.
// Se o servidor estiver fora do ar, deixa usar (o bloqueio de verdade fica no servidor).
export default function PortaoAcesso({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [fechouAviso, setFechouAviso] = useState(false);
  const [recusou, setRecusou] = useState(false); // o servidor recusou um pedido (ex.: IA) por falta de Premium

  const sair = useCallback(async () => { await signOut(); navigate('/auth'); }, [signOut, navigate]);
  const ver = useCallback(() => {
    if (!user) return;
    // convite de dias grátis guardado entra antes de ver o acesso (assim os dias já aparecem)
    void usarCupomGuardado().then((dias) => { if (dias) void avisarJanela(`Convite aceito: você ganhou ${dias} dias grátis.`); }).catch(() => 0).then(() => verAcesso()).then((a) => {
      if (a.sair) { void avisarJanela('Sua conta foi aberta em outro aparelho. Cada conta funciona em no máximo 2 aparelhos. Entre de novo para usar aqui.').then(() => sair()); return; }
      setAcesso(a);
    }).catch(() => { /* sem internet: segue */ });
  }, [user, sair]);

  // Lembretes inteligentes: com "ajustar sozinho" ligado, os horários seguem o uso (no máximo 1 vez por semana).
  useEffect(() => { if (user) void ajustarHorariosSozinho(user.id).catch(() => false); }, [user]);

  useEffect(() => {
    ver();
    const bloqueou = () => { setRecusou(true); ver(); };
    window.addEventListener('bc-bloqueado', bloqueou);
    return () => window.removeEventListener('bc-bloqueado', bloqueou);
  }, [ver]);
  useEffect(() => { setRecusou(false); }, [pathname]);

  const semPremium = acesso?.situacao === 'bloqueado';
  if (acesso && semPremium && (recusou || telaPremium(pathname, acesso.tipo))) {
    return <PainelAcesso acesso={acesso} onVerDeNovo={ver} onFechar={() => { setRecusou(false); navigate('/'); }} />;
  }
  const avisar = acesso && !fechouAviso && (acesso.situacao === 'aviso' || (acesso.tipo === 'coach' && acesso.situacao === 'gratis' && (acesso.dias ?? 99) <= 5));
  return (
    <>
      {avisar && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="aviso-acesso">
          <i className="ri-time-line mt-0.5 text-lg"></i>
          <p className="flex-1">
            {acesso.motivo === 'coach' ? 'O plano do seu coach venceu. ' : acesso.tipo === 'coach' ? 'Seu teste de coach acaba logo. ' : 'Seu Premium acaba logo. '}
            Faltam <b>{acesso.dias} dia(s)</b>. <Link to={acesso.tipo === 'coach' ? '/coach/plano' : '/acesso'} className="font-semibold underline">Ver como continuar</Link>
          </p>
          <button onClick={() => setFechouAviso(true)} aria-label="Fechar aviso" className="text-lg"><i className="ri-close-line"></i></button>
        </div>
      )}
      {children}
    </>
  );
}
