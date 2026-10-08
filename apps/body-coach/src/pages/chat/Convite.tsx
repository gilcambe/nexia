import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Link de convite do coach: guarda o código e leva para a conversa (que entra na equipe do coach sozinha, depois do login).
export default function Convite() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const c = (codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (c.length >= 4) { try { localStorage.setItem('bc_convite', c); } catch { /* sem armazenamento */ } }
    navigate('/chat', { replace: true });
  }, [codigo, navigate]);
  return <p className="py-10 text-center text-sm text-foreground-500">Abrindo o seu convite…</p>;
}
