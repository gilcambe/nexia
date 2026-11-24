import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { confirmar } from '@/lib/dialogo';
import { deleteUserDoc, listUserDocs, setUserDoc } from '@/lib/userData';
import { apiOuGuardar } from '@/lib/pendentes';
import { corrigirNoCelular, diaLocal, gradeDoMes, juntar, lerLocais, porDia, tirarDoCelular, type TreinoFeito } from '@/lib/historicoTreinos';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Calendário dos treinos feitos: toque no dia para ver, corrigir ou apagar.
export default function HistoricoTreinos({ uid }: { uid?: string }) {
  const [lista, setLista] = useState<TreinoFeito[]>([]);
  const hoje = new Date();
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [dia, setDia] = useState<string | null>(null);
  const [editando, setEditando] = useState<TreinoFeito | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => {
    if (!uid) return;
    listUserDocs<TreinoFeito>(uid, 'workouts', 'done_at', 'desc')
      .then((b) => setLista(juntar(b, lerLocais(uid))))
      .catch(() => setLista(juntar([], lerLocais(uid))));
  };
  useEffect(carregar, [uid]);

  const dias = useMemo(() => porDia(lista), [lista]);
  const grade = gradeDoMes(mes.ano, mes.mes);
  const doMes = lista.filter((w) => diaLocal(w.done_at).startsWith(`${mes.ano}-${String(mes.mes + 1).padStart(2, '0')}`)).length;
  const hojeStr = diaLocal(hoje.toISOString());
  const mudarMes = (d: number) => { const n = new Date(mes.ano, mes.mes + d, 1); setMes({ ano: n.getFullYear(), mes: n.getMonth() }); setDia(null); };

  const apagar = async (w: TreinoFeito) => {
    if (!uid || !(await confirmar(`Apagar o treino "${w.title}" de ${new Date(w.done_at).toLocaleDateString('pt-BR')}? Não dá para desfazer.`))) return;
    setErro('');
    try {
      await deleteUserDoc(uid, 'workouts', w._docId || w.id).catch((e) => { if (w._docId) throw e; });
      tirarDoCelular(uid, w);
      void apiOuGuardar(uid, { acao: 'treino_apagado', feitoEm: new Date(w.done_at).getTime(), titulo: w.title });
      setLista((l) => l.filter((x) => x !== w));
    } catch { setErro('Não consegui apagar agora. Confira a internet e tente de novo.'); }
  };

  const salvarCorrecao = async () => {
    if (!uid || !editando) return;
    const original = lista.find((x) => x.id === editando.id);
    if (!original) return;
    const mud = {
      title: editando.title.trim().slice(0, 200) || original.title,
      duration_min: Math.max(0, Math.min(300, Math.round(Number(editando.duration_min) || 0))),
      esforco: editando.esforco || null,
      comentario: (editando.comentario || '').trim() || null,
    };
    setErro('');
    try {
      if (original._docId) await setUserDoc(uid, 'workouts', original._docId, mud, true);
      corrigirNoCelular(uid, original, mud);
      setLista((l) => l.map((x) => (x === original ? { ...x, ...mud } : x)));
      setEditando(null);
    } catch { setErro('Não consegui salvar agora. Confira a internet e tente de novo.'); }
  };

  return (
    <Card padding="p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground-950"><i className="ri-calendar-check-line mr-1 text-primary-500"></i>Treinos feitos</h2>
        <span className="text-xs text-foreground-500">{doMes} no mês</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background-100"><i className="ri-arrow-left-s-line text-xl"></i></button>
        <span className="text-sm font-semibold text-foreground-800">{MESES[mes.mes]} {mes.ano}</span>
        <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background-100"><i className="ri-arrow-right-s-line text-xl"></i></button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px] text-foreground-500">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" data-testid="calendario-treinos">
        {grade.map((d, i) => {
          if (!d) return <span key={i} />;
          const n = dias[d]?.length ?? 0;
          const sel = dia === d;
          return (
            <button key={d} type="button" onClick={() => setDia(sel ? null : d)} aria-label={`Dia ${Number(d.slice(8))}${n ? `, ${n} treino${n > 1 ? 's' : ''}` : ''}`} aria-pressed={sel}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm ${n ? 'bg-primary-500 font-bold text-background-50' : 'text-foreground-700'} ${sel ? 'ring-2 ring-primary-700 ring-offset-1' : ''} ${d === hojeStr && !n ? 'border border-primary-400' : ''}`}>
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>

      {erro && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {dia && (
        <div className="mt-3 space-y-2" data-testid="treinos-do-dia">
          {!(dias[dia]?.length) && <p className="text-sm text-foreground-500">Nenhum treino neste dia.</p>}
          {(dias[dia] ?? []).map((w) => editando?.id === w.id ? (
            <div key={w.id} className="space-y-2 rounded-xl border border-primary-300 p-3">
              <label className="block text-xs font-semibold text-foreground-700">Nome do treino
                <input value={editando.title} onChange={(e) => setEditando((x) => x && { ...x, title: e.target.value })} maxLength={200} className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm font-normal" />
              </label>
              <label className="block text-xs font-semibold text-foreground-700">Minutos
                <input type="number" inputMode="numeric" value={editando.duration_min ?? ''} onChange={(e) => setEditando((x) => x && { ...x, duration_min: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm font-normal" />
              </label>
              <div className="text-xs font-semibold text-foreground-700">Esforço
                <div className="mt-1 grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setEditando((x) => x && { ...x, esforco: n })} aria-pressed={editando.esforco === n}
                      className={`rounded-lg border py-1.5 text-sm ${editando.esforco === n ? 'border-primary-500 bg-primary-50 font-bold' : 'border-background-200'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-semibold text-foreground-700">Comentário
                <textarea value={editando.comentario ?? ''} onChange={(e) => setEditando((x) => x && { ...x, comentario: e.target.value })} rows={2} maxLength={500} className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm font-normal" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEditando(null)} className="rounded-lg border border-background-200 py-2 text-sm font-semibold">Cancelar</button>
                <button type="button" onClick={() => void salvarCorrecao()} className="rounded-lg bg-primary-500 py-2 text-sm font-semibold text-background-50" data-testid="salvar-correcao">Salvar</button>
              </div>
            </div>
          ) : (
            <div key={w.id} className="rounded-xl border border-background-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground-950">{w.title}</p>
                  <p className="text-xs text-foreground-500">
                    {new Date(w.done_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {w.duration_min ? ` · ${w.duration_min} min` : ''}{w.sets ? ` · ${w.sets} séries` : ''}{w.volume_kg ? ` · ${w.volume_kg.toLocaleString('pt-BR')} kg` : ''}{w.esforco ? ` · esforço ${w.esforco}/5` : ''}
                  </p>
                  {w.comentario && <p className="mt-1 text-sm text-foreground-700">“{w.comentario}”</p>}
                  {w.melhores && Object.keys(w.melhores).length > 0 && (
                    <p className="mt-1 text-xs text-foreground-600">{Object.entries(w.melhores).slice(0, 6).map(([n, m]) => `${n} ${m.weight}kg×${m.reps}`).join(' · ')}</p>
                  )}
                </div>
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setEditando({ ...w })} aria-label={`Corrigir ${w.title}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"><i className="ri-edit-line"></i></button>
                  <button type="button" onClick={() => void apagar(w)} aria-label={`Apagar ${w.title}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><i className="ri-delete-bin-line"></i></button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
