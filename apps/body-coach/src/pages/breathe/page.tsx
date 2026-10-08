import { useEffect, useRef, useState } from 'react';

// Respiração guiada (recuperação, antes de dormir, depois do treino). Tudo no aparelho, sem custo.
const TECNICAS = {
  caixa: { nome: 'Respiração em caixa', desc: 'Foco e calma: 4 s entra, 4 s segura, 4 s sai, 4 s segura.', fases: [['Inspire', 4], ['Segure', 4], ['Expire', 4], ['Segure', 4]] },
  '478': { nome: '4-7-8 para dormir', desc: 'Relaxa o corpo: 4 s entra, 7 s segura, 8 s sai.', fases: [['Inspire', 4], ['Segure', 7], ['Expire', 8]] },
  recuperar: { nome: 'Recuperar o fôlego', desc: 'Depois do treino pesado: 4 s entra, 6 s sai.', fases: [['Inspire', 4], ['Expire', 6]] },
} as const;
type Chave = keyof typeof TECNICAS;

export default function Respirar() {
  const [chave, setChave] = useState<Chave>('caixa');
  const [minutos, setMinutos] = useState(3);
  const [rodando, setRodando] = useState(false);
  const [ciclo, setCiclo] = useState({ fase: 0, restante: 0 });
  const { fase, restante } = ciclo;
  const [seg, setSeg] = useState(0);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const t = TECNICAS[chave];
  const fases = t.fases as readonly (readonly [string, number])[];

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => {
      setSeg((s) => s + 1);
      setCiclo((c) => {
        if (c.restante > 1) return { ...c, restante: c.restante - 1 };
        const n = (c.fase + 1) % fases.length;
        return { fase: n, restante: fases[n][1] };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [rodando, fases]);

  useEffect(() => { if (rodando) { try { navigator.vibrate?.(60); } catch { /* sem vibração */ } } }, [fase, rodando]);
  useEffect(() => { if (rodando && seg >= minutos * 60) setRodando(false); }, [seg, rodando, minutos]);
  useEffect(() => {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (rodando) wl?.request('screen').then((l) => { lock.current = l; }).catch(() => {});
    else { void lock.current?.release().catch(() => {}); lock.current = null; }
    return () => { void lock.current?.release().catch(() => {}); };
  }, [rodando]);

  const iniciar = () => { setCiclo({ fase: 0, restante: fases[0][1] }); setSeg(0); setRodando(true); };
  const [nomeFase] = fases[fase] ?? fases[0];
  const cresce = rodando && nomeFase === 'Inspire';
  const encolhe = rodando && nomeFase === 'Expire';

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Respirar</h1>
        <p className="mt-1 text-sm text-foreground-600">Respiração guiada para relaxar, dormir melhor e se recuperar do treino.</p>
      </header>
      <div className="grid gap-2" role="radiogroup" aria-label="Técnica">
        {(Object.keys(TECNICAS) as Chave[]).map((c) => (
          <button key={c} role="radio" aria-checked={chave === c} onClick={() => { setRodando(false); setChave(c); }} className={`rounded-xl border p-3 text-left ${chave === c ? 'border-primary-400 bg-primary-100/60 ring-2 ring-primary-200' : 'border-background-200 bg-background-50'}`}>
            <span className="block text-sm font-semibold text-foreground-950">{TECNICAS[c].nome}</span>
            <span className="block text-xs text-foreground-500">{TECNICAS[c].desc}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-foreground-700">
        Duração:
        {[1, 3, 5, 10].map((m) => <button key={m} onClick={() => !rodando && setMinutos(m)} aria-pressed={minutos === m} className={`rounded-full border px-3 py-1 ${minutos === m ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200'}`}>{m} min</button>)}
      </div>
      <div className="flex flex-col items-center py-6">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-primary-200 text-primary-900"
          style={{ transform: `scale(${cresce ? 1.25 : encolhe ? 0.8 : 1})`, transition: `transform ${rodando ? fases[fase][1] : 0.3}s ease-in-out` }}
          aria-live="polite"
        >
          <div className="text-center">
            <p className="font-heading text-xl font-bold">{rodando ? nomeFase : 'Pronto?'}</p>
            {rodando && <p className="text-3xl font-bold tabular-nums">{restante}</p>}
          </div>
        </div>
        <p className="mt-6 text-xs text-foreground-500">{rodando ? `${Math.max(0, minutos * 60 - seg)} s para terminar` : seg > 0 ? 'Sessão concluída. Parabéns!' : 'Sente-se confortável e solte os ombros.'}</p>
      </div>
      <button onClick={() => (rodando ? setRodando(false) : iniciar())} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50">{rodando ? 'Parar' : 'Começar'}</button>
    </div>
  );
}
