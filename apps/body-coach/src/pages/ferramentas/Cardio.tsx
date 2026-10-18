import { useEffect, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { compressImageToDataUrl, setUserDoc } from '@/lib/userData';
import { perguntar } from '@/lib/coachAI';
import { avaliarSemana, lerPainel, resumoSemana, type SessaoCardio } from '@/lib/ferramentas/cardio';

const NOMES: Record<string, string> = { esteira: 'Esteira', bike: 'Bicicleta', escada: 'Escada', eliptico: 'Elíptico', outro: 'Cardio' };
const hhmmss = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Foto do painel -> IA grátis lê -> a pessoa confere -> soma na semana. Sem IA, digita à mão.
export default function Cardio() {
  const { user, profile, refreshProfile } = useAuth();
  const chave = user ? `bc_cardio_${user.id}` : '';
  const [lista, setLista] = useState<SessaoCardio[]>(() => {
    try { return chave ? JSON.parse(localStorage.getItem(chave) || '[]') : []; } catch { return []; }
  });
  const [rascunho, setRascunho] = useState<Omit<SessaoCardio, 'id' | 'em'> | null>(null);
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState('');
  const arq = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const doPerfil = (profile as unknown as { cardio?: SessaoCardio[] } | null)?.cardio;
    if (Array.isArray(doPerfil)) setLista(doPerfil);
  }, [profile]);

  const objetivo = String((profile as unknown as { onboarding?: { goal?: string; objetivo?: string } } | null)?.onboarding?.goal ?? (profile as unknown as { onboarding?: { objetivo?: string } } | null)?.onboarding?.objetivo ?? '');
  const semana = resumoSemana(lista);

  const lerFoto = async (f: File) => {
    setLendo(true); setMsg('');
    try {
      const foto = await compressImageToDataUrl(f, 1280, 220_000);
      const r = await perguntar('coach', 'Leia o painel desta foto.', {}, foto, undefined, 'cardio');
      const p = lerPainel(r);
      if (p) setRascunho(p);
      else { setRascunho({ aparelho: 'esteira', tempoSeg: 0, km: 0, kcal: 0, kmh: 0, passos: 0 }); setMsg('Não consegui ler a foto. Digite os números abaixo.'); }
    } catch (e) {
      setRascunho({ aparelho: 'esteira', tempoSeg: 0, km: 0, kcal: 0, kmh: 0, passos: 0 });
      setMsg(`${(e as Error).message} Digite os números abaixo.`);
    } finally { setLendo(false); }
  };

  const salvar = () => {
    if (!rascunho || !user) return;
    if (!rascunho.kcal && !rascunho.tempoSeg) { setMsg('Informe pelo menos as calorias ou o tempo.'); return; }
    const nova = [{ ...rascunho, id: `c${Date.now()}`, em: Date.now() }, ...lista].slice(0, 200);
    setLista(nova); setRascunho(null); setMsg('Salvo na sua semana.');
    try { localStorage.setItem(chave, JSON.stringify(nova)); } catch { /* sem armazenamento */ }
    void setUserDoc(user.id, 'profile', 'main', { cardio: nova }, true).then(refreshProfile).catch(() => {});
  };

  const campo = (rot: string, k: 'tempoSeg' | 'km' | 'kcal' | 'kmh' | 'passos', passo = 1) => (
    <label className="block text-xs text-foreground-600">{rot}
      <input type="number" inputMode="decimal" step={passo} value={rascunho?.[k] || ''} onChange={(e) => setRascunho((r) => (r ? { ...r, [k]: Number(e.target.value) || 0 } : r))}
        className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-950" />
    </label>
  );

  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary-600">Esta semana</div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          <div><div className="text-2xl font-bold text-foreground-950" data-testid="cardio-kcal">{semana.kcal}</div><div className="text-xs text-foreground-500">kcal</div></div>
          <div><div className="text-2xl font-bold text-foreground-950">{semana.km}</div><div className="text-xs text-foreground-500">km</div></div>
          <div><div className="text-2xl font-bold text-foreground-950">{semana.minutos}</div><div className="text-xs text-foreground-500">minutos</div></div>
        </div>
        <p className="mt-3 text-sm text-foreground-700">{avaliarSemana(semana.kcal, objetivo)}</p>
      </Card>

      {!rascunho ? (
        <Card padding="p-5">
          <input ref={arq} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void lerFoto(f); }} />
          <button onClick={() => arq.current?.click()} disabled={lendo} className="w-full rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 disabled:opacity-60" data-testid="cardio-foto">
            <i className="ri-camera-line mr-2"></i>{lendo ? 'Lendo o painel...' : 'Foto do painel da esteira, bike ou escada'}
          </button>
          <button onClick={() => setRascunho({ aparelho: 'esteira', tempoSeg: 0, km: 0, kcal: 0, kmh: 0, passos: 0 })} className="mt-2 w-full text-sm font-medium text-primary-700">Digitar à mão</button>
        </Card>
      ) : (
        <Card padding="p-5">
          <div className="mb-3 text-sm font-semibold text-foreground-950">Confira os números</div>
          <select value={rascunho.aparelho} onChange={(e) => setRascunho({ ...rascunho, aparelho: e.target.value })} className="mb-3 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm">
            {Object.entries(NOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            {campo('Tempo (segundos)', 'tempoSeg')}{campo('Distância (km)', 'km', 0.01)}{campo('Calorias (kcal)', 'kcal', 0.1)}{campo('Velocidade (km/h)', 'kmh', 0.1)}{campo('Passos', 'passos')}
          </div>
          {rascunho.tempoSeg > 0 && <p className="mt-2 text-xs text-foreground-500">Tempo: {hhmmss(rascunho.tempoSeg)}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={salvar} className="flex-1 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50" data-testid="cardio-salvar">Salvar</button>
            <button onClick={() => setRascunho(null)} className="rounded-xl border border-background-200 px-5 py-3 text-sm text-foreground-700">Cancelar</button>
          </div>
        </Card>
      )}
      {msg && <p className="text-sm text-foreground-600">{msg}</p>}

      {lista.length > 0 && (
        <Card padding="p-5">
          <div className="mb-2 text-sm font-semibold text-foreground-950">Histórico</div>
          <ul className="divide-y divide-background-200">
            {lista.slice(0, 20).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground-800">{NOMES[s.aparelho] || 'Cardio'} · {new Date(s.em).toLocaleDateString('pt-BR')}</span>
                <span className="text-foreground-600">{s.kcal} kcal · {s.km} km · {Math.round(s.tempoSeg / 60)} min</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
