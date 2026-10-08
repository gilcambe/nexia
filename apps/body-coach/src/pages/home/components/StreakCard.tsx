import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { listUserDocs } from '@/lib/userData';

const META_SEMANAL = 3;
const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

// Início da semana (segunda 00:00) da data dada.
function inicioDaSemana(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

// Treinos feitos: os do aparelho + os da nuvem, sem repetir.
async function carregarDatas(uid: string): Promise<Date[]> {
  const datas = new Map<string, Date>();
  const juntar = (lista: { id?: string; done_at?: string }[]) => {
    for (const w of lista) {
      if (!w.done_at) continue;
      const d = new Date(w.done_at);
      if (!isNaN(d.getTime())) datas.set(w.done_at, d);
    }
  };
  try {
    const raw = JSON.parse(localStorage.getItem('bc_workouts_' + uid) || '[]');
    if (Array.isArray(raw)) juntar(raw);
  } catch { /* sem dados locais */ }
  try { juntar(await listUserDocs<{ done_at?: string }>(uid, 'workouts', 'done_at', 'desc')); } catch { /* offline */ }
  return [...datas.values()];
}

export default function StreakCard() {
  const { user } = useAuth();
  const [datas, setDatas] = useState<Date[]>([]);
  useEffect(() => {
    if (user?.id) carregarDatas(user.id).then(setDatas);
  }, [user?.id]);

  const semanaAtual = inicioDaSemana(new Date());
  const porSemana = new Map<number, number>();
  const diasDestaSemana = new Set<number>();
  for (const d of datas) {
    const s = inicioDaSemana(d);
    porSemana.set(s, (porSemana.get(s) ?? 0) + 1);
    if (s === semanaAtual) diasDestaSemana.add((d.getDay() + 6) % 7);
  }
  const nestaSemana = porSemana.get(semanaAtual) ?? 0;
  // Semanas seguidas batendo a meta; a semana atual ainda em andamento não quebra a sequência.
  let seq = nestaSemana >= META_SEMANAL ? 1 : 0;
  for (let s = semanaAtual - 7 * 86400000; (porSemana.get(s) ?? 0) >= META_SEMANAL; s -= 7 * 86400000) seq++;

  const total = datas.length;
  const conquistas = [
    { ok: total >= 1, icone: 'ri-flag-line', nome: '1º treino' },
    { ok: total >= 10, icone: 'ri-fire-line', nome: '10 treinos' },
    { ok: seq >= 2, icone: 'ri-calendar-check-line', nome: '2 semanas firmes' },
    { ok: total >= 50, icone: 'ri-medal-line', nome: '50 treinos' },
  ];
  const falta = Math.max(0, META_SEMANAL - nestaSemana);
  const hoje = (new Date().getDay() + 6) % 7;

  return (
    <Card padding="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-fire-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Sua constância</h2>
        </div>
        <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
          {seq > 0 ? `${seq} ${seq === 1 ? 'semana firme' : 'semanas firmes'}` : 'comece sua sequência'}
        </span>
      </div>
      <div className="flex justify-between">
        {DIAS.map((l, i) => {
          const fez = diasDestaSemana.has(i);
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${fez ? 'bg-primary-500 text-background-50' : i === hoje ? 'border-2 border-primary-400 text-primary-600' : 'bg-background-100 text-foreground-400'}`}>
                {fez ? '✓' : l}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-foreground-700">
        {falta === 0 ? 'Meta da semana batida! Descanse bem e mantenha o ritmo.' : `${nestaSemana} de ${META_SEMANAL} treinos esta semana. Faltam ${falta} para a meta.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {conquistas.map((c) => (
          <span key={c.nome} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${c.ok ? 'bg-accent-100 text-accent-800' : 'bg-background-100 text-foreground-400'}`}>
            <i className={c.icone}></i>{c.nome}
          </span>
        ))}
      </div>
    </Card>
  );
}
