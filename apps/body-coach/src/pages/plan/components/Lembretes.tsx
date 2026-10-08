import { useState } from 'react';
import Card from '@/components/base/Card';
import { DIAS_SEMANA, diasSugeridos, gerarIcs } from '@/lib/lembretes';

// Lembretes de treino no celular: baixa um arquivo de calendário com alarme, sem servidor e sem custo.
export default function Lembretes({ diasPorSemana, apelido }: { diasPorSemana: number; apelido?: string | null }) {
  const [dias, setDias] = useState<string[]>(() => diasSugeridos(diasPorSemana));
  const [hora, setHora] = useState('18:00');
  const [peso, setPeso] = useState(true);
  const [feito, setFeito] = useState(false);

  const alterna = (c: string) => setDias((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));
  const baixar = () => {
    const blob = new Blob([gerarIcs({ dias, hora, apelido, incluirPeso: peso })], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lembretes-body-coach.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setFeito(true);
  };

  return (
    <Card padding="p-5">
      <div className="flex items-center gap-2"><i className="ri-alarm-line text-lg text-primary-500"></i><h2 className="font-heading text-base font-semibold text-foreground-950">Lembretes no celular</h2></div>
      <p className="mt-1 text-sm text-foreground-600">Escolha os dias e a hora. Você recebe um aviso 10 minutos antes, no próprio calendário do celular.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Dias do treino">
        {DIAS_SEMANA.map((d) => (
          <button key={d.cod} type="button" onClick={() => alterna(d.cod)} aria-pressed={dias.includes(d.cod)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${dias.includes(d.cod) ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200 bg-background-50 text-foreground-600'}`}>{d.nome}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground-700">Hora do treino
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground-700"><input type="checkbox" checked={peso} onChange={(e) => setPeso(e.target.checked)} />Lembrar de pesar aos domingos</label>
      </div>
      <button type="button" onClick={baixar} disabled={!dias.length} className="mt-4 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-40"><i className="ri-calendar-event-line mr-1"></i>Criar lembretes</button>
      {feito && <p role="status" className="mt-2 text-sm text-primary-700">Arquivo baixado. Toque nele e escolha “Adicionar ao calendário”.</p>}
    </Card>
  );
}
