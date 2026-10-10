import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { sugerirCarga } from '@/lib/cargaSugerida';
import { historicoPorExercicio, volumeSemanal } from '@/lib/ferramentas/historicoCarga';
import { useHistorico } from '@/lib/ferramentas/useHistorico';

const curta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function EvolucaoCarga() {
  const { user } = useAuth();
  const h = useHistorico(user?.id, false);
  const lista = useMemo(() => historicoPorExercicio(h.treinos), [h.treinos]);
  const volume = useMemo(() => volumeSemanal(h.treinos), [h.treinos]);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const ex = lista.find((e) => e.nome === sel) ?? null;

  if (h.carregando) return <p className="text-sm text-foreground-500">Carregando seu histórico…</p>;
  if (!lista.length) {
    return (
      <Card>
        <p className="text-sm text-foreground-600">Ainda não há cargas registradas. Ao terminar cada treino, o melhor set de cada exercício entra aqui com gráfico e recordes.</p>
        <Link to="/workout" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 dark:text-foreground-950">Treinar agora</Link>
      </Card>
    );
  }

  if (ex) {
    const sug = sugerirCarga([...ex.pontos].reverse().map((p) => ({ weight: p.carga, reps: p.reps })), '8-12');
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setSel(null)} className="text-sm font-medium text-primary-700"><i className="ri-arrow-left-line mr-1"></i>Todos os exercícios</button>
        <Card>
          <h2 className="font-heading text-lg font-bold text-foreground-950">{ex.nome}</h2>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-background-100/70 p-2"><p className="font-heading text-lg font-bold">{ex.recorde.carga} kg</p><p className="text-[11px] text-foreground-500">recorde × {ex.recorde.reps}</p></div>
            <div className="rounded-xl bg-background-100/70 p-2"><p className="font-heading text-lg font-bold">{Math.round(ex.ultimo.rm)} kg</p><p className="text-[11px] text-foreground-500">1RM estimado</p></div>
            <div className="rounded-xl bg-background-100/70 p-2"><p className={`font-heading text-lg font-bold ${ex.variacaoPct > 0 ? 'text-emerald-600' : ex.variacaoPct < 0 ? 'text-red-600' : ''}`}>{ex.variacaoPct > 0 ? '+' : ''}{ex.variacaoPct}%</p><p className="text-[11px] text-foreground-500">desde o início</p></div>
          </div>
          <div className="mt-3 h-52" aria-label="Gráfico de carga">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ex.pontos.map((p) => ({ dia: curta(p.data), carga: p.carga, rm: Math.round(p.rm) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip formatter={(v, n) => [`${v} kg`, n === 'rm' ? '1RM estimado' : 'Carga']} />
                <Line type="monotone" dataKey="carga" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="rm" stroke="oklch(var(--accent-500))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-foreground-500"><span className="text-primary-600">━</span> carga do melhor set · <span className="text-accent-600">┅</span> 1RM estimado</p>
          {sug && <p className="mt-3 rounded-xl bg-primary-50 p-3 text-sm text-foreground-800"><b>Próximo treino: {sug.weight} kg × {sug.reps}.</b> {sug.motivo}</p>}
        </Card>
        <Card padding="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Sessões</h3>
          <ul className="divide-y divide-background-200 text-sm">
            {[...ex.pontos].reverse().map((p) => (
              <li key={p.data} className="flex justify-between py-2">
                <span className="text-foreground-600">{new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                <span className="font-semibold text-foreground-900">{p.carga} kg × {p.reps}{p === ex.recorde && ' 🏆'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  const filtrados = lista.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="space-y-3">
      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Volume por semana</h2>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volume} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString('pt-BR')} kg`, 'Volume']} />
              <Bar dataKey="kg" fill="oklch(var(--primary-500))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar exercício" className="w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Buscar exercício" />
      <div className="space-y-2">
        {filtrados.map((e) => (
          <button key={e.nome} type="button" onClick={() => setSel(e.nome)} className="flex w-full items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-3 text-left">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground-950">{e.nome}</p>
              <p className="text-xs text-foreground-500">{e.sessoes} {e.sessoes === 1 ? 'sessão' : 'sessões'} · recorde {e.recorde.carga} kg × {e.recorde.reps}</p>
            </div>
            <span className={`text-sm font-bold ${e.variacaoPct > 0 ? 'text-emerald-600' : e.variacaoPct < 0 ? 'text-red-600' : 'text-foreground-400'}`}>{e.variacaoPct > 0 ? '▲' : e.variacaoPct < 0 ? '▼' : '•'} {Math.abs(e.variacaoPct)}%</span>
            <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
          </button>
        ))}
      </div>
    </div>
  );
}
