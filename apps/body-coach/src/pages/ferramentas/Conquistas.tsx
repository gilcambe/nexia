import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { calcularConquistas, nivel, sequencias } from '@/lib/ferramentas/conquistas';
import { useHistorico } from '@/lib/ferramentas/useHistorico';

const CATEGORIAS = ['Todas', 'Treino', 'Constância', 'Força', 'Cardio', 'Nutrição', 'Evolução'] as const;

export default function Conquistas() {
  const { user } = useAuth();
  const h = useHistorico(user?.id);
  const [cat, setCat] = useState<(typeof CATEGORIAS)[number]>('Todas');
  const lista = useMemo(() => calcularConquistas(h), [h]);
  const nv = nivel(lista, h.treinos.length, h.refeicoes, h.checkins);
  const seq = sequencias(h.treinos.filter((t) => t.done_at).map((t) => new Date(t.done_at as string)));
  const feitas = lista.filter((c) => c.ok).length;
  const visiveis = lista.filter((c) => cat === 'Todas' || c.categoria === cat).sort((a, b) => Number(b.ok) - Number(a.ok) || b.atual / b.meta - a.atual / a.meta);

  if (h.carregando) return <p className="text-sm text-foreground-500">Carregando suas conquistas…</p>;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary-500 to-primary-700 text-background-50 dark:text-foreground-950" padding="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Nível {nv.nivel}</p>
            <p className="font-heading text-2xl font-bold">{nv.nome}</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-bold">{nv.xp.toLocaleString('pt-BR')}</p>
            <p className="text-xs opacity-80">XP total</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuenow={nv.noNivel} aria-valuemax={nv.proximo} aria-label="Progresso do nível">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (nv.noNivel / nv.proximo) * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-xs opacity-90">Faltam {(nv.proximo - nv.noNivel).toLocaleString('pt-BR')} XP para o nível {nv.nivel + 1}. Treino vale 20 XP, check-in 5 e refeição 2.</p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {[
          { v: feitas, l: `de ${lista.length} medalhas` },
          { v: seq.atual, l: 'dias seguidos agora' },
          { v: seq.maior, l: 'maior sequência' },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl border border-background-200 bg-background-50 p-3 text-center">
            <p className="font-heading text-xl font-bold text-foreground-950">{x.v}</p>
            <p className="text-[11px] leading-tight text-foreground-500">{x.l}</p>
          </div>
        ))}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {CATEGORIAS.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cat === c ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visiveis.map((c) => (
          <div key={c.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${c.ok ? 'border-primary-300 bg-primary-50' : 'border-background-200 bg-background-50'}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${c.ok ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'bg-background-100 text-foreground-400'}`}>
              <i className={c.ok ? c.icone : 'ri-lock-line'}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between gap-2 font-semibold text-foreground-950">
                <span className="truncate">{c.nome}</span>
                <span className="shrink-0 text-[11px] font-medium text-primary-700">+{c.xp} XP</span>
              </p>
              <p className="text-xs text-foreground-500">{c.descricao}</p>
              {!c.ok && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-200">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(100, (c.atual / c.meta) * 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-foreground-500">{c.atual.toLocaleString('pt-BR')}/{c.meta.toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link to="/ferramentas/indique" className="block rounded-2xl border border-background-200 bg-background-50 p-3 text-center text-sm font-semibold text-primary-700">
        <i className="ri-share-line mr-1"></i>Mostrar minhas conquistas para os amigos
      </Link>
    </div>
  );
}
