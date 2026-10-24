import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
const SOBRA: { rir: number; rotulo: string; nome: string }[] = [
  { rir: 0, rotulo: 'Falha', nome: 'Nenhuma (falha)' },
  { rir: 1, rotulo: '1', nome: '1' },
  { rir: 2, rotulo: '2', nome: '2' },
  { rir: 3, rotulo: '3+', nome: '3 ou mais' },
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
  acaoAoLado,
}: {
  minWeight: number;
  maxWeight: number;
  weightUnit: string;
  targetReps: string;
  ultima?: { weight: number; reps: number } | null;
  sugestao?: { weight: number; reps: number; motivo: string } | null;
  exercicio?: string;
  onSubmit: (set: NewSet) => void;
  // Botão que fica ao lado de "Registrar" na barra fixa (ex.: Próximo exercício).
  acaoAoLado?: ReactNode;
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
  // Campo vazio usa o que aparece nele (a última série ou o alvo): o número na tela é o que vale.
  const topoAlvo = Number(/(\d+)\D*$/.exec(targetReps)?.[1]) || 12;
  const pesoUsado = weight !== '' ? weight : ultima ? String(ultima.weight) : '';
  const repsUsadas = reps !== '' ? reps : String(ultima?.reps ?? (tempo ? 30 : topoAlvo));
  const canSubmit = (tempo || pesoUsado !== '') && repsUsadas !== '';
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
    enviar({ weight: tempo ? 0 : Number(pesoUsado), reps: Number(repsUsadas), rir, falha: rir === 0, nota: nota.trim() || undefined, ...(tempo ? { porTempo: true } : modo) });
    limpar();
  };

  const ajustar = (campo: 'weight' | 'reps', delta: number) => {
    const set = campo === 'weight' ? setWeight : setReps;
    const atual = Number(campo === 'weight' ? weight : reps) || (ultima ? (campo === 'weight' ? ultima.weight : ultima.reps) : 0);
    set(String(Math.max(0, Math.round((atual + delta) * 100) / 100)));
  };
  // Compacto: carga e repetições lado a lado no celular, para registrar sem rolar a tela.
  const campo = 'w-full min-w-0 rounded-xl border-2 border-background-200 bg-background-50 px-1 py-2 text-center text-xl font-bold text-foreground-950 outline-none focus:border-primary-400 placeholder:text-foreground-500';
  const mais = 'flex h-12 w-10 shrink-0 items-center justify-center rounded-xl bg-background-100 text-xl font-bold text-foreground-800 active:scale-95';

  return (
    <div>
      {sugestao && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-2.5 py-1.5" title={sugestao.motivo}>
          <p className="min-w-0 flex-1 text-sm font-semibold text-primary-700"><i className="ri-line-chart-line mr-1"></i>Sugestão: {sugestao.weight} {weightUnit} × {sugestao.reps}</p>
          <button type="button" onClick={() => { setWeight(String(sugestao.weight)); setReps(String(sugestao.reps)); }} className="shrink-0 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-semibold text-background-50 active:scale-95">Usar</button>
        </div>
      )}
      {ultima && (
        <button type="button" onClick={() => { enviar({ weight: ultima.weight, reps: ultima.reps, rir, falha: rir === 0, nota: nota.trim() || undefined, ...(tempo ? { porTempo: true } : modo) }); limpar(); }} className="mb-2 w-full rounded-xl bg-primary-100 px-4 py-2.5 text-base font-bold text-primary-800 active:scale-[0.98]" data-testid="repetir-serie">
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
        <>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm font-semibold text-foreground-600">Carga ({unidade}){modo.porLado ? '/lado' : ''}</span>
            <span className="mt-1 flex items-center gap-1">
              <button type="button" onClick={() => ajustar('weight', -2.5)} className={mais} aria-label="Menos 2,5 de carga">−</button>
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={ultima ? String(ultima.weight) : 'kg'} aria-label={`Carga (${weightUnit}) de ${minWeight} a ${maxWeight}`} className={campo} />
              <button type="button" onClick={() => ajustar('weight', 2.5)} className={mais} aria-label="Mais 2,5 de carga">+</button>
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-foreground-600">Reps ({targetReps})</span>
            <span className="mt-1 flex items-center gap-1">
              <button type="button" onClick={() => ajustar('reps', -1)} className={mais} aria-label="Menos uma repetição">−</button>
              <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder={repsUsadas} aria-label="Repetições" className={campo} />
              <button type="button" onClick={() => ajustar('reps', 1)} className={mais} aria-label="Mais uma repetição">+</button>
            </span>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => mudarModo({ ...modo, porLado: !modo.porLado })} aria-pressed={modo.porLado} data-testid="carga-lado" className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${modo.porLado ? 'border-primary-500 bg-primary-100 text-primary-800' : 'border-background-300 text-foreground-600'}`}>{modo.porLado ? 'Carga de cada lado' : 'Carga total'}</button>
          <button type="button" onClick={() => mudarModo({ ...modo, unilateral: !modo.unilateral })} aria-pressed={modo.unilateral} data-testid="carga-unilateral" className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${modo.unilateral ? 'border-primary-500 bg-primary-100 text-primary-800' : 'border-background-300 text-foreground-600'}`}>{modo.unilateral ? 'Unilateral' : 'Bilateral'}</button>
          <button type="button" onClick={() => setAnotando(!anotando)} aria-pressed={anotando || !!nota} className={`ml-auto text-xs font-semibold ${nota ? 'text-primary-700' : 'text-foreground-600'} underline`}>
            <i className="ri-sticky-note-line mr-0.5"></i>{nota ? 'Nota ✓' : 'Nota p/ coach'}
          </button>
        </div>
        </>
        )}
        {!tempo && <>
        <p className="mt-2 text-sm font-semibold text-foreground-600">Quantas repetições ainda dava?</p>
        <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Quantas repetições ainda dava">
          {SOBRA.map((o) => (
            <button key={o.rir} type="button" role="radio" aria-checked={rir === o.rir} aria-label={o.nome} onClick={() => setRir(o.rir)}
              className={`min-h-[44px] rounded-xl border-2 px-1 py-1.5 text-base font-semibold leading-tight ${rir === o.rir ? (o.rir === 0 ? 'border-red-400 bg-red-50 text-red-700' : 'border-primary-500 bg-primary-50 text-primary-800') : 'border-background-200 bg-background-50 text-foreground-700'}`}>
              {o.rotulo}
            </button>
          ))}
        </div>
        </>}
        {tempo && (
          <button type="button" onClick={() => setAnotando(!anotando)} aria-pressed={anotando || !!nota} className={`mt-3 text-sm font-semibold ${nota ? 'text-primary-700' : 'text-foreground-600'} underline`}>
            <i className="ri-sticky-note-line mr-1"></i>{nota ? 'Nota para o coach ✓' : 'Anotar algo para o coach'}
          </button>
        )}
        {anotando && (
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ex.: senti o ombro, pegada escorregou..." aria-label="Nota desta série" className="mt-2 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-3 text-base text-foreground-900 outline-none focus:border-primary-400" autoFocus />
        )}
        {/* No celular, Registrar (e o botão ao lado) ficam fixos logo acima do menu: sempre à vista, sem rolar. */}
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-background-200 bg-background-50/95 px-3 py-2 backdrop-blur sm:static sm:mt-3 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none" data-testid="barra-serie">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary-500 px-3 py-3.5 text-base font-bold text-background-50 shadow-sm transition active:scale-[0.98] disabled:bg-background-300 disabled:text-foreground-600"
            data-testid="registrar-serie"
          >
            <i className="ri-check-line text-xl"></i>
            <span className="truncate">{canSubmit ? (tempo ? `Registrar ${repsUsadas} s` : `Registrar ${pesoUsado} ${unidade} × ${repsUsadas}`) : 'Coloque a carga'}</span>
          </button>
          {acaoAoLado}
        </div>
      </form>
    </div>
  );
}
