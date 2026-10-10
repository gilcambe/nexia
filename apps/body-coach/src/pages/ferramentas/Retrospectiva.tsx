import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import CompartilharCartao from '@/components/feature/CompartilharCartao';
import { retrospectiva } from '@/lib/ferramentas/retrospectiva';
import { useHistorico } from '@/lib/ferramentas/useHistorico';

export default function Retrospectiva() {
  const { user } = useAuth();
  const h = useHistorico(user?.id, false);
  const hoje = new Date();
  const [off, setOff] = useState(0);
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() - off, 1);
  const mesTxt = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const nomeMes = mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1);
  const r = useMemo(() => retrospectiva(h.treinos, ref.getFullYear(), ref.getMonth()), [h.treinos, off]); // eslint-disable-line react-hooks/exhaustive-deps
  const cartao = useMemo(() => ({
    titulo: `Meu ${nomeMes}`,
    data: new Date(),
    itens: [
      { rotulo: 'treinos', valor: String(r.treinos) },
      { rotulo: 'horas treinando', valor: String(r.horas) },
      r.km ? { rotulo: 'km de cardio', valor: String(r.km) } : { rotulo: 'kg levantados', valor: r.kg.toLocaleString('pt-BR') },
      { rotulo: 'dias seguidos', valor: String(r.maiorSequencia) },
    ],
    destaque: r.recordes.length ? `${r.recordes.length} ${r.recordes.length === 1 ? 'recorde batido' : 'recordes batidos'}` : undefined,
  }), [r, nomeMes]);

  if (h.carregando) return <p className="text-sm text-foreground-500">Montando sua retrospectiva…</p>;
  const n = (v: string | number, l: string, icone: string) => (
    <div className="rounded-2xl bg-white/10 p-3">
      <i className={`${icone} text-lg opacity-80`}></i>
      <p className="font-heading text-2xl font-bold">{v}</p>
      <p className="text-[11px] opacity-80">{l}</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOff((o) => o + 1)} className="rounded-lg p-2 text-foreground-600" aria-label="Mês anterior"><i className="ri-arrow-left-s-line text-xl"></i></button>
        <p className="font-heading text-lg font-bold text-foreground-950">{nomeMes}</p>
        <button type="button" onClick={() => setOff((o) => Math.max(0, o - 1))} disabled={off === 0} className="rounded-lg p-2 text-foreground-600 disabled:opacity-30" aria-label="Próximo mês"><i className="ri-arrow-right-s-line text-xl"></i></button>
      </div>
      <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-orange-600 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-300">Sua retrospectiva</p>
        <p className="mt-1 font-heading text-3xl font-bold">{r.treinos ? `${r.treinos} treinos` : 'Nenhum treino'}</p>
        {r.comparacao != null && <p className="text-sm opacity-90">{r.comparacao >= 0 ? `+${r.comparacao}%` : `${r.comparacao}%`} em relação ao mês anterior</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {n(r.horas, 'horas treinando', 'ri-time-line')}
          {n(r.kg.toLocaleString('pt-BR'), 'kg levantados', 'ri-scales-3-line')}
          {n(r.km, 'km de cardio', 'ri-run-line')}
          {n(r.kcal.toLocaleString('pt-BR'), 'kcal no treino', 'ri-fire-line')}
          {n(r.maiorSequencia, 'maior sequência (dias)', 'ri-flashlight-line')}
          {n(r.diaFavorito ?? '—', 'dia favorito', 'ri-calendar-line')}
        </div>
        {r.exercicioTop && <p className="mt-3 text-sm">Exercício mais feito: <b>{r.exercicioTop}</b></p>}
        {r.recordes.length > 0 && (
          <div className="mt-3 rounded-2xl bg-orange-500/90 p-3 text-sm text-black">
            <p className="font-bold">🏆 Recordes do mês</p>
            {r.recordes.slice(0, 5).map((x) => <p key={x}>{x}</p>)}
          </div>
        )}
      </div>
      {r.treinos > 0 && <CompartilharCartao dados={cartao} rotulo="Postar minha retrospectiva" />}
      {!r.treinos && <Card><p className="text-sm text-foreground-600">Treine este mês para montar sua retrospectiva.</p></Card>}
    </div>
  );
}
