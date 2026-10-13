import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ehPorTempo } from '@/lib/porTempo';

export interface NewSet {
  weight: number;
  reps: number;
  rir: number;
  falha?: boolean;
  nota?: string;
  porLado?: boolean; // a carga é de cada lado (ex.: 40 kg em cada halter)
  unilateral?: boolean; // feito um lado por vez
  porTempo?: boolean; // prancha e isometria: reps guarda os segundos
}

// Lembra, por exercício, se a carga é de cada lado e se é unilateral (a próxima série já vem marcada).
const chaveModo = (ex: string) => `bc_carga_modo_${ex}`;
function modoSalvo(ex: string, padraoLado: boolean) {
  try { const m = JSON.parse(localStorage.getItem(chaveModo(ex)) || 'null'); if (m) return { porLado: !!m.porLado, unilateral: !!m.unilateral }; } catch { /* sem armazenamento */ }
  return { porLado: padraoLado, unilateral: /unilateral/i.test(ex) };
}

// "Quantas repetições ainda dava?" no lugar do número RIR: 0 = foi até a falha.
const SOBRA: { rir: number; rotulo: string }[] = [
  { rir: 0, rotulo: 'Nenhuma (falha)' },
  { rir: 1, rotulo: '1' },
  { rir: 2, rotulo: '2' },
  { rir: 3, rotulo: '3 ou mais' },
];

export default function SetEntry({
  minWeight,
  maxWeight,
  weightUnit,
  targetReps,
  ultima,
  sugestao,
  exercicio = '',
  onSubmit,
}: {
  minWeight: number;
  maxWeight: number;
  weightUnit: string;
  targetReps: string;
  ultima?: { weight: number; reps: number } | null;
  sugestao?: { weight: number; reps: number; motivo: string } | null;
  exercicio?: string;
  onSubmit: (set: NewSet) => void;
}) {
  const [modo, setModo] = useState(() => modoSalvo(exercicio, weightUnit === 'kg/lado'));
  const mudarModo = (m: { porLado: boolean; unilateral: boolean }) => { setModo(m); try { localStorage.setItem(chaveModo(exercicio), JSON.stringify(m)); } catch { /* sem armazenamento */ } };
  const unidade = weightUnit === 'kg/lado' ? 'kg' : weightUnit;
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState(2);
  const [nota, setNota] = useState('');
  const [anotando, setAnotando] = useState(false);

  const tempo = ehPorTempo(exercicio);
  const canSubmit = (tempo || weight !== '') && reps !== '';
  // Um toque só por série: toques repetidos em menos de 2 s não registram de novo.
  const ultimoToque = useRef(0);
  const enviar = (s: NewSet) => { if (Date.now() - ultimoToque.current < 2000) return; ultimoToque.current = Date.now(); onSubmit(s); };
  // Cronômetro da prancha: ao parar, os segundos vão para o campo.
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(0);
  useEffect(() => { if (inicio === null) return; const t = setInterval(() => setAgora(Date.now()), 250); return () => clearInterval(t); }, [inicio]);
  const cronometro = () => { if (inicio === null) { setInicio(Date.now()); setAgora(Date.now()); } else { setReps(String(Math.round((Date.now() - inicio) / 1000))); setInicio(null); } };
  const limpar = () => { setWeight(''); setReps(''); setRir(2); setNota(''); setAnotando(false); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    enviar({ weight: tempo ? 0 : Number(weight), reps: Number(reps), rir, falha: rir === 0, nota: nota.trim() || undefined, ...(tempo ? { porTempo: true } : modo) });
    limpar();
  };

  const ajustar = (campo: 'weight' | 'reps', delta: number) => {
    const set = campo === 'weight' ? setWeight : setReps;
    const atual = Number(campo === 'weight' ? weight : reps) || (ultima ? (campo === 'weight' ? ultima.weight : ultima.reps) : 0);
    set(String(Math.max(0, Math.round((atual + delta) * 100) / 100)));
  };
  const campo = 'w-full min-w-0 rounded-xl border-2 border-background-200 bg-background-50 px-2 py-2.5 text-center text-2xl font-bold text-foreground-950 outline-none focus:border-primary-400';
  const mais = 'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-background-100 text-xl font-bold text-foreground-800 active:scale-95';

  return (
    <div>
      {sugestao && (
        <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
          <p className="text-sm font-semibold text-primary-700"><i className="ri-line-chart-line mr-1"></i>Sugestão de hoje: {sugestao.weight} {weightUnit} × {sugestao.reps}</p>
          <p className="mt-0.5 text-sm text-foreground-600">{sugestao.motivo}</p>
          <button type="button" onClick={() => { setWeight(String(sugestao.weight)); setReps(String(sugestao.reps)); }} className="mt-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 active:scale-95">Usar a sugestão</button>
        </div>
      )}
      {ultima && (
        <button type="button" onClick={() => { enviar({ weight: ultima.weight, reps: ultima.reps, rir, falha: rir === 0, nota: nota.trim() || undefined, ...(tempo ? { porTempo: true } : modo) }); limpar(); }} className="mb-3 w-full rounded-2xl bg-primary-100 px-4 py-3 text-base font-bold text-primary-800 active:scale-[0.98]" data-testid="repetir-serie">
          <i className="ri-repeat-line mr-1"></i>{tempo ? `Repetir: ${ultima.reps} s` : `Repetir: ${ultima.weight} ${unidade}${modo.porLado ? ' cada lado' : ''} × ${ultima.reps}`}
        </button>
      )}
      <form onSubmit={submit}>
        {tempo ? (
          <label className="block">
            <span className="text-sm font-semibold text-foreground-600">Tempo (segundos)</span>
            <span className="mt-1 flex items-center gap-1.5">
              <button type="button" onClick={() => ajustar('reps', -5)} className={mais} aria-label="Menos 5 segundos">−</button>
              <input type="number" inputMode="numeric" value={inicio !== null ? String(Math.round((agora - inicio) / 1000)) : reps} onChange={(e) => setReps(e.target.value)} placeholder={ultima ? String(ultima.reps) : '30'} aria-label="Segundos" className={campo} />
              <button type="button" onClick={() => ajustar('reps', 5)} className={mais} aria-label="Mais 5 segundos">+</button>
            </span>
            <button type="button" onClick={cronometro} data-testid="cronometro-serie" className="mt-2 w-full rounded-xl border-2 border-primary-300 px-4 py-3 text-base font-semibold text-primary-800">
              <i className={`${inicio !== null ? 'ri-stop-circle-line' : 'ri-timer-line'} mr-1`}></i>{inicio !== null ? 'Parar cronômetro' : 'Iniciar cronômetro'}
            </button>
          </label>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground-600">Carga ({unidade}){modo.porLado ? ' de cada lado' : ''}</span>
              <span className="flex gap-1.5">
                <button type="button" onClick={() => mudarModo({ ...modo, porLado: !modo.porLado })} aria-pressed={modo.porLado} data-testid="carga-lado" className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${modo.porLado ? 'border-primary-500 bg-primary-100 text-primary-800' : 'border-background-300 text-foreground-600'}`}>{modo.porLado ? 'Cada lado' : 'Total'}</button>
                <button type="button" onClick={() => mudarModo({ ...modo, unilateral: !modo.unilateral })} aria-pressed={modo.unilateral} data-testid="carga-unilateral" className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${modo.unilateral ? 'border-primary-500 bg-primary-100 text-primary-800' : 'border-background-300 text-foreground-600'}`}>{modo.unilateral ? 'Unilateral' : 'Bilateral'}</button>
              </span>
            </span>
            <span className="mt-1 flex items-center gap-1.5">
              <button type="button" onClick={() => ajustar('weight', -2.5)} className={mais} aria-label="Menos 2,5 de carga">−</button>
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={ultima ? String(ultima.weight) : `${minWeight}–${maxWeight}`} aria-label={`Carga (${weightUnit})`} className={campo} />
              <button type="button" onClick={() => ajustar('weight', 2.5)} className={mais} aria-label="Mais 2,5 de carga">+</button>
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-foreground-600">Repetições ({targetReps})</span>
            <span className="mt-1 flex items-center gap-1.5">
              <button type="button" onClick={() => ajustar('reps', -1)} className={mais} aria-label="Menos uma repetição">−</button>
              <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder={ultima ? String(ultima.reps) : '12'} aria-label="Repetições" className={campo} />
              <button type="button" onClick={() => ajustar('reps', 1)} className={mais} aria-label="Mais uma repetição">+</button>
            </span>
          </label>
        </div>
        )}
        {!tempo && <>
        <p className="mt-3 text-sm font-semibold text-foreground-600">Quantas repetições ainda dava?</p>
        <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Quantas repetições ainda dava">
          {SOBRA.map((o) => (
            <button key={o.rir} type="button" role="radio" aria-checked={rir === o.rir} onClick={() => setRir(o.rir)}
              className={`min-h-[48px] rounded-xl border-2 px-1 py-2 text-sm font-semibold leading-tight ${rir === o.rir ? (o.rir === 0 ? 'border-red-400 bg-red-50 text-red-700' : 'border-primary-500 bg-primary-50 text-primary-800') : 'border-background-200 bg-background-50 text-foreground-700'}`}>
              {o.rotulo}
            </button>
          ))}
        </div>
        </>}
        <button type="button" onClick={() => setAnotando(!anotando)} aria-pressed={anotando || !!nota} className={`mt-3 text-sm font-semibold ${nota ? 'text-primary-700' : 'text-foreground-600'} underline`}>
          <i className="ri-sticky-note-line mr-1"></i>{nota ? 'Nota para o coach ✓' : 'Anotar algo para o coach'}
        </button>
        {anotando && (
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ex.: senti o ombro, pegada escorregou..." aria-label="Nota desta série" className="mt-2 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-3 text-base text-foreground-900 outline-none focus:border-primary-400" autoFocus />
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground-950 px-4 py-4 text-base font-bold text-background-50 transition disabled:opacity-40"
        >
          <i className="ri-check-line text-xl"></i>
          Registrar série
        </button>
      </form>
    </div>
  );
}
