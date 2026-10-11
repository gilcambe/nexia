import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

// Link de convite do coach: guarda o código e leva para a conversa (que entra na equipe do coach sozinha, depois do login).
export default function Convite() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    const c = (codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    // ?parte=dieta|treino: link de um profissional parceiro; ?c=: convite da planilha do coach (marca que a pessoa entrou)
    const parte = params.get('parte');
    const convite = (params.get('c') ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    const extra = { ...(parte === 'dieta' || parte === 'treino' ? { parte } : {}), ...(convite ? { convite } : {}) };
    if (c.length >= 4) { try { localStorage.setItem('bc_convite', c); localStorage.setItem('bc_convite_extra', JSON.stringify(extra)); } catch { /* sem armazenamento */ } }
    navigate('/chat', { replace: true });
  }, [codigo, navigate, params]);
  return <p className="py-10 text-center text-sm text-foreground-500">Abrindo o seu convite…</p>;
}
