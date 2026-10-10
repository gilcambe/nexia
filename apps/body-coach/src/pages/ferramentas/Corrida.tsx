import { useEffect, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import MonitorCardiaco, { useFC } from '@/components/feature/MonitorCardiaco';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { useWakeLock } from '@/lib/useWakeLock';
import { formatarMin } from '@/lib/ferramentas/calculadoras';
import { kcalPercurso, percurso, type Ponto } from '@/lib/ferramentas/gps';

type Tipo = 'corrida' | 'caminhada' | 'bike';
const TIPOS: { id: Tipo; nome: string; icone: string }[] = [
  { id: 'corrida', nome: 'Corrida', icone: 'ri-run-line' },
  { id: 'caminhada', nome: 'Caminhada', icone: 'ri-walk-line' },
  { id: 'bike', nome: 'Bike', icone: 'ri-riding-line' },
];

// Desenho do percurso (sem mapa pago): os pontos do GPS viram uma linha num quadro.
function Percurso({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length < 2) return <div className="flex h-40 items-center justify-center rounded-xl bg-background-100 text-xs text-foreground-400">O percurso aparece aqui</div>;
  const lats = pontos.map((p) => p.lat), lons = pontos.map((p) => p.lon);
  const [minLa, maxLa, minLo, maxLo] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const esc = Math.max(maxLa - minLa, (maxLo - minLo) * Math.cos((minLa * Math.PI) / 180), 1e-5);
  const pt = (p: Ponto) => `${10 + (((p.lon - minLo) * Math.cos((minLa * Math.PI) / 180)) / esc) * 280},${150 - ((p.lat - minLa) / esc) * 140}`;
  return (
    <svg viewBox="0 0 300 160" className="h-40 w-full rounded-xl bg-background-100" aria-label="Desenho do percurso">
      <polyline points={pontos.map(pt).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="text-primary-500" />
      <circle cx={pt(pontos[0]).split(',')[0]} cy={pt(pontos[0]).split(',')[1]} r="5" className="fill-emerald-500" />
      <circle cx={pt(pontos[pontos.length - 1]).split(',')[0]} cy={pt(pontos[pontos.length - 1]).split(',')[1]} r="5" className="fill-red-500" />
    </svg>
  );
}

export default function Corrida() {
  const { user, profile } = useAuth();
  const peso = Number(profile?.onboarding?.weight) || 70;
  const [tipo, setTipo] = useState<Tipo>('corrida');
  const [estado, setEstado] = useState<'parado' | 'rodando' | 'pausado' | 'fim'>('parado');
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [seg, setSeg] = useState(0);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const watch = useRef<number | null>(null);
  useWakeLock(estado === 'rodando');

  useEffect(() => {
    if (estado !== 'rodando') return;
    const id = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [estado]);

  const pararGps = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  };
  useEffect(() => pararGps, []);

  const iniciar = () => {
    setErro('');
    if (!('geolocation' in navigator)) { setErro('Este aparelho não tem GPS disponível no navegador.'); return; }
    watch.current = navigator.geolocation.watchPosition(
      (p) => setPontos((l) => [...l, { lat: p.coords.latitude, lon: p.coords.longitude, t: p.timestamp, acc: p.coords.accuracy }]),
      (e) => setErro(e.code === 1 ? 'Permita o acesso à localização para medir o percurso.' : 'Sinal de GPS fraco. Vá para um lugar aberto.'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    setEstado('rodando');
  };
  const pausar = () => { pararGps(); setEstado('pausado'); };
  const terminar = () => { pararGps(); setEstado('fim'); };
  const novo = () => { setPontos([]); setSeg(0); setSalvo(false); setEstado('parado'); };

  const km = percurso(pontos);
  const min = seg / 60;
  const fc = useFC();
  // Com monitor cardíaco conectado, as calorias vêm dos batimentos; sem ele, da distância.
  const kcal = fc.conectado && fc.kcal > 0 ? Math.round(fc.kcal) : kcalPercurso(km, peso, tipo);

  const salvar = async () => {
    if (!user) return;
    const done_at = new Date().toISOString();
    const nome = TIPOS.find((t) => t.id === tipo)?.nome ?? 'Corrida';
    const w = {
      user_id: user.id, title: `${nome} com GPS`, done_at, duration_min: Math.max(1, Math.round(min)),
      exercises: 0, sets: 0, volume_kg: 0, series_por_grupo: {}, melhores: {},
      fc_media: fc.media || null, fc_maxima: fc.maxima || null, kcal,
      cardio: [{ tipo: nome, minutos: Math.round(min), km: Math.round(km * 100) / 100, kcal }],
    };
    try {
      const key = `bc_workouts_${user.id}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), w]));
    } catch { /* sem armazenamento local */ }
    await setUserDoc(user.id, 'workouts', `gps-${Date.now()}`, w).catch(() => {});
    setSalvo(true);
  };

  return (
    <div className="space-y-3">
      {estado === 'parado' && (
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTipo(t.id)} className={`flex flex-col items-center gap-1 rounded-xl py-3 text-sm font-semibold ${tipo === t.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>
              <i className={`${t.icone} text-xl`}></i>{t.nome}
            </button>
          ))}
        </div>
      )}

      <MonitorCardiaco compacto />
      <Card>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><p className="font-heading text-4xl font-bold text-foreground-950">{km.toFixed(2)}</p><p className="text-xs text-foreground-500">km</p></div>
          <div><p className="font-heading text-4xl font-bold text-foreground-950">{formatarMin(min) === '—' ? '0:00' : formatarMin(min)}</p><p className="text-xs text-foreground-500">tempo</p></div>
          <div><p className="font-heading text-2xl font-bold text-foreground-900">{km > 0.05 ? formatarMin(min / km) : '—'}</p><p className="text-xs text-foreground-500">ritmo /km</p></div>
          <div><p className="font-heading text-2xl font-bold text-foreground-900">{kcal}</p><p className="text-xs text-foreground-500">kcal (estimado)</p></div>
        </div>
        <div className="mt-3"><Percurso pontos={pontos.filter((p) => p.acc == null || p.acc <= 35)} /></div>
        {erro && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}

        <div className="mt-4 flex gap-2">
          {estado === 'parado' && <button type="button" onClick={iniciar} className="flex-1 rounded-xl bg-primary-500 py-3.5 font-semibold text-background-50 dark:text-foreground-950"><i className="ri-play-fill mr-1"></i>Começar</button>}
          {estado === 'rodando' && <>
            <button type="button" onClick={pausar} className="flex-1 rounded-xl border border-background-300 py-3.5 font-semibold text-foreground-800"><i className="ri-pause-fill mr-1"></i>Pausar</button>
            <button type="button" onClick={terminar} className="flex-1 rounded-xl bg-red-500 py-3.5 font-semibold text-white"><i className="ri-stop-fill mr-1"></i>Terminar</button>
          </>}
          {estado === 'pausado' && <>
            <button type="button" onClick={iniciar} className="flex-1 rounded-xl bg-primary-500 py-3.5 font-semibold text-background-50 dark:text-foreground-950"><i className="ri-play-fill mr-1"></i>Continuar</button>
            <button type="button" onClick={terminar} className="flex-1 rounded-xl bg-red-500 py-3.5 font-semibold text-white"><i className="ri-stop-fill mr-1"></i>Terminar</button>
          </>}
          {estado === 'fim' && (salvo
            ? <button type="button" onClick={novo} className="flex-1 rounded-xl border border-background-300 py-3.5 font-semibold text-foreground-800">Novo percurso</button>
            : <>
              <button type="button" onClick={() => void salvar()} className="flex-1 rounded-xl bg-primary-500 py-3.5 font-semibold text-background-50 dark:text-foreground-950"><i className="ri-save-line mr-1"></i>Salvar no histórico</button>
              <button type="button" onClick={novo} className="rounded-xl border border-background-300 px-4 py-3.5 text-sm font-semibold text-foreground-600">Descartar</button>
            </>)}
        </div>
        {salvo && <p className="mt-2 text-center text-sm font-medium text-emerald-700"><i className="ri-check-line mr-1"></i>Salvo! Já conta nas conquistas e no relatório da semana.</p>}
      </Card>
      <p className="text-center text-[11px] text-foreground-400">Deixe a tela ligada durante o percurso: o navegador pausa o GPS com a tela apagada.</p>
    </div>
  );
}
