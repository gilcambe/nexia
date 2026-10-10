import { useEffect, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { useWakeLock } from '@/lib/useWakeLock';
import { EXERCICIOS_CAMERA, anguloDoExercicio, estadoInicial, passo, type EstadoReps, type ExercicioCamera, type P } from '@/lib/ferramentas/contadorReps';
import { detectorVideo } from '@/lib/ferramentas/poseVideo';

const LIGACOES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

function falar(t: string, ligado: boolean) {
  if (!ligado || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; u.rate = 1.2; window.speechSynthesis.speak(u); } catch { /* sem voz */ }
}

export default function ContadorReps() {
  const { user } = useAuth();
  const [ex, setEx] = useState<ExercicioCamera>(EXERCICIOS_CAMERA[0]);
  const [estado, setEstado] = useState<EstadoReps>(estadoInicial());
  const [status, setStatus] = useState<'parado' | 'carregando' | 'rodando' | 'fim'>('parado');
  const [erro, setErro] = useState('');
  const [ang, setAng] = useState<number | null>(null);
  const [voz, setVoz] = useState(true);
  const [carga, setCarga] = useState('');
  const [salvo, setSalvo] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const loop = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const est = useRef(estado);
  useWakeLock(status === 'rodando');

  const parar = () => {
    if (loop.current) cancelAnimationFrame(loop.current);
    loop.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => parar, []);

  const iniciar = async () => {
    setErro(''); setSalvo(false);
    est.current = estadoInicial(); setEstado(est.current);
    if (!navigator.mediaDevices?.getUserMedia) { setErro('Este navegador não libera a câmera.'); return; }
    setStatus('carregando');
    try {
      const [s, det] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        detectorVideo(),
      ]);
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setStatus('rodando');
      falar(`${ex.nome}. Pode começar.`, voz);
      let ultimoT = -1;
      const tick = () => {
        if (!video.current || !stream.current) return;
        const t = performance.now();
        if (v.readyState >= 2 && t !== ultimoT) {
          ultimoT = t;
          const r = det.detectForVideo(v, t);
          const pts: P[] | undefined = r.landmarks?.[0];
          desenhar(pts);
          if (pts) {
            const a = anguloDoExercicio(ex, pts);
            setAng(a);
            if (a != null) {
              const novo = passo(est.current, a, ex);
              if (novo.reps !== est.current.reps) falar(String(novo.reps), voz);
              else if (novo.parciais !== est.current.parciais) falar('Desça mais', voz);
              est.current = novo;
              setEstado(novo);
            }
          } else setAng(null);
        }
        loop.current = requestAnimationFrame(tick);
      };
      loop.current = requestAnimationFrame(tick);
    } catch (e) {
      parar();
      setStatus('parado');
      setErro((e as Error).name === 'NotAllowedError' ? 'Permita o uso da câmera para contar as repetições.' : 'Não consegui ligar a câmera ou carregar a detecção. Verifique a internet na primeira vez e tente de novo.');
    }
  };

  const desenhar = (pts?: P[]) => {
    const c = tela.current, v = video.current;
    if (!c || !v) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!pts) return;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(249,115,22,0.9)'; ctx.fillStyle = '#fff';
    for (const [a, b] of LIGACOES) {
      const pa = pts[a], pb = pts[b];
      if (!pa || !pb || (pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
      ctx.beginPath(); ctx.moveTo(pa.x * c.width, pa.y * c.height); ctx.lineTo(pb.x * c.width, pb.y * c.height); ctx.stroke();
    }
    for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      const p = pts[i];
      if (!p || (p.visibility ?? 1) < 0.4) continue;
      ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, 6, 0, Math.PI * 2); ctx.fill();
    }
  };

  const terminar = () => { parar(); setStatus('fim'); falar(`${est.current.reps} repetições. Muito bem!`, voz); };
  const salvar = async () => {
    if (!user || !estado.reps) return;
    const kg = Number(carga.replace(',', '.')) || 0;
    const w = {
      user_id: user.id, title: `${ex.nome} (contado pela câmera)`, done_at: new Date().toISOString(), duration_min: 1, exercises: 1, sets: 1,
      volume_kg: kg * estado.reps, series_por_grupo: {}, melhores: kg ? { [ex.nome]: { weight: kg, reps: estado.reps } } : {}, origem: 'camera', cardio: [],
    };
    try {
      const key = `bc_workouts_${user.id}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), w]));
    } catch { /* sem armazenamento */ }
    await setUserDoc(user.id, 'workouts', `camera-${Date.now()}`, w).catch(() => {});
    setSalvo(true);
  };

  return (
    <div className="space-y-3">
      {status !== 'rodando' && status !== 'carregando' && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {EXERCICIOS_CAMERA.map((e) => <button key={e.id} type="button" onClick={() => setEx(e)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${ex.id === e.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>{e.nome}</button>)}
        </div>
      )}
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '3 / 4' }}>
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={tela} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">{ex.nome}</span>
          {status === 'rodando' && <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">{ang != null ? `${Math.round(ang)}°` : 'Apareça inteiro na tela'}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center p-4">
          {(status === 'rodando' || status === 'fim') && <span className="font-heading text-8xl font-bold text-white drop-shadow-lg">{estado.reps}</span>}
          {status === 'rodando' && estado.aviso && <span className="mt-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black">{estado.aviso}</span>}
          {status === 'parado' && <p className="max-w-xs text-center text-sm text-white/90">{ex.dica}</p>}
          {status === 'carregando' && <p className="text-sm text-white">Ligando a câmera e a inteligência…</p>}
        </div>
      </div>
      {erro && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
      {status === 'parado' && <button type="button" onClick={() => void iniciar()} className="w-full rounded-xl bg-primary-500 py-3.5 font-semibold text-background-50 dark:text-foreground-950"><i className="ri-camera-line mr-1"></i>Começar a contar</button>}
      {status === 'rodando' && <button type="button" onClick={terminar} className="w-full rounded-xl bg-red-500 py-3.5 font-semibold text-white"><i className="ri-stop-fill mr-1"></i>Terminar série</button>}
      {status === 'fim' && (
        <Card>
          <p className="text-center font-heading text-lg font-bold text-foreground-950">{estado.reps} repetições completas{estado.parciais ? ` · ${estado.parciais} curtas` : ''}</p>
          {estado.parciais > 0 && <p className="mt-1 text-center text-xs text-amber-700">Nas repetições curtas, a amplitude não chegou ao fundo. Desça mais na próxima série.</p>}
          <div className="mt-3 flex gap-2">
            <input inputMode="decimal" type="number" placeholder="Carga (kg)" value={carga} onChange={(e) => setCarga(e.target.value)} className="w-28 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Carga usada" />
            <button type="button" onClick={() => void salvar()} disabled={salvo || !estado.reps} className="flex-1 rounded-xl bg-foreground-900 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-60">{salvo ? 'Salvo no histórico' : 'Salvar série'}</button>
          </div>
          <button type="button" onClick={() => void iniciar()} className="mt-2 w-full rounded-xl bg-primary-500 py-3 font-semibold text-background-50 dark:text-foreground-950">Próxima série</button>
          <button type="button" onClick={() => setStatus('parado')} className="mt-1 w-full py-2 text-sm text-foreground-500">Trocar exercício</button>
        </Card>
      )}
      <button type="button" onClick={() => setVoz((v) => !v)} aria-pressed={voz} className="w-full py-1 text-xs font-medium text-foreground-500"><i className={voz ? 'ri-volume-up-line mr-1' : 'ri-volume-mute-line mr-1'}></i>{voz ? 'O app fala cada repetição' : 'Sem voz'}</button>
      <p className="text-[11px] text-foreground-400">A imagem é processada no seu celular e não é gravada nem enviada. Funciona melhor com boa luz e o corpo inteiro aparecendo.</p>
    </div>
  );
}
