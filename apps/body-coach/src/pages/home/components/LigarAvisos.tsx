import { useState } from 'react';
import { Link } from 'react-router-dom';
import { suportaAvisos } from '@/lib/avisos';

const CHAVE = 'bc_avisos_dispensado';
// Convite discreto no Hoje para ligar os avisos (só enquanto o celular ainda não respondeu à permissão).
export default function LigarAvisos() {
  const [fora, setFora] = useState(() => {
    try { return !suportaAvisos() || Notification.permission !== 'default' || !!localStorage.getItem(CHAVE); } catch { return true; }
  });
  if (fora) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-3" data-testid="ligar-avisos">
      <i className="ri-notification-3-line text-2xl text-primary-600"></i>
      <Link to="/avisos" className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground-950">Ligue os avisos no celular</span>
        <span className="block text-xs text-foreground-500">Mensagens do coach, hora do treino e fim do descanso.</span>
      </Link>
      <button type="button" onClick={() => { try { localStorage.setItem(CHAVE, '1'); } catch { /* ok */ } setFora(true); }} aria-label="Agora não" className="p-1 text-foreground-400"><i className="ri-close-line text-lg"></i></button>
    </div>
  );
}
