import { useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { AVISO_PICO, planoSemanaPico } from '@/lib/semanaPico';

const CHAVE = 'bc_semana_pico';

// Semana de pico: data do evento e peso → o que fazer em cada um dos 7 dias antes.
export default function SemanaPico() {
  const { profile } = useAuth();
  const salvo = (() => { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null') as { data: string; peso: string } | null; } catch { return null; } })();
  const [data, setData] = useState(salvo?.data ?? '');
  const [peso, setPeso] = useState(salvo?.peso ?? String(profile?.onboarding?.weight ?? ''));
  const evento = data ? new Date(`${data}T12:00:00`) : null;
  const plano = evento && Number(peso) > 0 ? planoSemanaPico(evento, Number(peso)) : null;
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const faltam = evento ? Math.round((evento.getTime() - hoje.getTime()) / 86400000) : null;

  const guardar = (d: string, p: string) => { try { if (d) localStorage.setItem(CHAVE, JSON.stringify({ data: d, peso: p })); else localStorage.removeItem(CHAVE); } catch { /* ok */ } };

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-600">Tem foto, campeonato, praia ou casamento? Diga a data e o app monta a semana para você chegar no seu melhor.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold text-foreground-700">Data do evento
          <input type="date" value={data} onChange={(e) => { setData(e.target.value); guardar(e.target.value, peso); }} aria-label="Data do evento" className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-2 py-2 text-sm font-normal" />
        </label>
        <label className="text-sm font-semibold text-foreground-700">Seu peso (kg)
          <input inputMode="decimal" value={peso} onChange={(e) => { setPeso(e.target.value); guardar(data, e.target.value); }} aria-label="Peso em kg" className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-2 py-2 text-sm font-normal" />
        </label>
      </div>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><i className="ri-information-line mr-1"></i>{AVISO_PICO}</p>
      {faltam !== null && faltam > 7 && <p className="text-sm text-foreground-700">Faltam {faltam} dias. O plano começa 7 dias antes; até lá, siga seu treino e dieta normais.</p>}
      {faltam !== null && faltam < 0 && <p className="text-sm text-foreground-700">Essa data já passou. Escolha a próxima.</p>}
      {plano && (
        <div className="space-y-2" data-testid="plano-pico">
          {plano.map((d) => {
            const ehHoje = faltam !== null && -d.dia === faltam;
            return (
              <Card key={d.dia} padding="p-3" className={ehHoje ? 'ring-2 ring-primary-500' : ''}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground-950">{d.dia === 0 ? 'Dia D' : `Faltam ${-d.dia} dias`} · <span className="font-normal text-foreground-600">{d.data}</span></p>
                  {ehHoje && <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-background-50">HOJE</span>}
                </div>
                <p className="text-sm font-semibold text-primary-700">{d.titulo}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-foreground-800">
                  <li><i className="ri-run-line mr-1 text-foreground-500"></i>{d.treino}</li>
                  <li><i className="ri-bread-line mr-1 text-foreground-500"></i>Carboidrato: cerca de {d.carbo_g} g no dia</li>
                  <li><i className="ri-drop-line mr-1 text-foreground-500"></i>Água: {String(d.agua_l).replace('.', ',')} L (não corte)</li>
                  <li><i className="ri-lightbulb-line mr-1 text-foreground-500"></i>{d.dica}</li>
                </ul>
              </Card>
            );
          })}
          <button type="button" onClick={() => { setData(''); guardar('', ''); }} className="w-full rounded-xl border border-background-200 py-2 text-sm font-semibold text-foreground-700">Apagar data</button>
        </div>
      )}
    </div>
  );
}
