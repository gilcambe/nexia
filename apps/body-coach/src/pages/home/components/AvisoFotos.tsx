import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import { diasSemFotos } from '@/lib/lembretes';

// Lembrete semanal no Hoje: passou de 7 dias sem foto/avaliação nova, convida a atualizar (some por hoje ao tocar em "Depois").
export default function AvisoFotos() {
  const { user } = useAuth();
  const { entries, loading } = useProgressData(user?.id);
  const chave = `bc_fotos_adiar_${user?.id ?? ''}`;
  const hoje = new Date().toISOString().slice(0, 10);
  const [adiado, setAdiado] = useState(() => { try { return localStorage.getItem(chave) === hoje; } catch { return false; } });
  if (!user || loading || adiado) return null;
  const dias = diasSemFotos(entries.filter((e) => e.fotos || e.image_url || e.avaliacao).map((e) => e.taken_at));
  if (dias !== null && dias < 7) return null;
  const depois = () => { try { localStorage.setItem(chave, hoje); } catch { /* sem armazenamento */ } setAdiado(true); };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary-300 bg-primary-50 p-4" data-testid="aviso-fotos">
      <i className="ri-camera-lens-line text-2xl text-primary-600"></i>
      <Link to="/evolution" className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground-950">{dias === null ? 'Tire suas primeiras fotos' : `Faz ${dias} dias sem fotos novas`}</span>
        <span className="block text-xs text-foreground-600">Fotos toda semana mostram a evolução que a balança esconde. Leva 1 minuto.</span>
      </Link>
      <button type="button" onClick={depois} className="text-xs font-medium text-foreground-500">Depois</button>
    </div>
  );
}
