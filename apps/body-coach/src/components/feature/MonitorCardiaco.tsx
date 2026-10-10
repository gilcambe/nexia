import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { zonasFC } from '@/lib/ferramentas/calculadoras';
import { bluetoothDisponivel, conectarFC, definirPerfilFC, desconectarFC, ouvirFC, type EstadoFC } from '@/lib/ferramentas/frequencia';

const CORES = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500'];

export function useFC(): EstadoFC {
  const [e, setE] = useState<EstadoFC>(() => ({ conectado: false, aparelho: '', bpm: 0, media: 0, maxima: 0, kcal: 0, inicio: 0, erro: '' }));
  useEffect(() => ouvirFC(setE), []);
  return e;
}

// Batimentos ao vivo (cinta ou relógio pelo Bluetooth), zona atual e calorias da sessão.
export default function MonitorCardiaco({ compacto = false }: { compacto?: boolean }) {
  const { profile } = useAuth();
  const ob = (profile?.onboarding ?? {}) as Record<string, string | undefined>;
  const idade = Number(ob.age) || 30;
  useEffect(() => {
    definirPerfilFC({ peso: Number(ob.weight) || undefined, idade, sexo: /^f/i.test(profile?.gender ?? '') ? 'F' : 'M' });
  }, [ob.weight, idade, profile?.gender]);
  const fc = useFC();
  const zonas = zonasFC(idade);
  const zona = fc.bpm ? zonas.find((z) => fc.bpm >= z.de && fc.bpm <= z.ate) ?? (fc.bpm > zonas[4].ate ? zonas[4] : null) : null;

  if (!fc.conectado) {
    return (
      <div className={`rounded-2xl border border-background-200 bg-background-50 ${compacto ? 'p-3' : 'p-4'}`}>
        <button type="button" onClick={() => void conectarFC()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700">
          <i className="ri-heart-pulse-line text-lg"></i>Conectar relógio ou cinta cardíaca
        </button>
        {!bluetoothDisponivel() && <p className="mt-1.5 text-center text-[11px] text-foreground-500">Precisa do Chrome no Android ou no computador. No iPhone, importe o treino do relógio depois.</p>}
        {fc.erro && <p className="mt-1.5 text-center text-xs text-red-700">{fc.erro}</p>}
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border border-background-200 bg-background-50 ${compacto ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full text-white ${zona ? CORES[zona.zona - 1] : 'bg-foreground-400'}`}>
          <i className="ri-heart-fill animate-pulse text-sm"></i>
          <span className="font-heading text-xl font-bold leading-none">{fc.bpm || '—'}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-950">{zona ? `Zona ${zona.zona} · ${zona.nome}` : 'Lendo batimentos…'}</p>
          <p className="text-xs text-foreground-500">Média {fc.media || '—'} · Máx. {fc.maxima || '—'} bpm</p>
          <p className="text-xs font-semibold text-primary-700">{Math.round(fc.kcal)} kcal nesta sessão</p>
        </div>
        <button type="button" onClick={desconectarFC} className="shrink-0 rounded-lg p-2 text-foreground-400" aria-label="Desconectar monitor"><i className="ri-bluetooth-connect-line text-lg"></i></button>
      </div>
      <p className="mt-1 truncate text-[11px] text-foreground-400">{fc.aparelho}</p>
    </div>
  );
}
