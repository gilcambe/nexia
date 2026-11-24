import { useEffect, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { confirmar } from '@/lib/dialogo';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { ITENS_TESTE, compararTeste, diasDesde, lerTempo, mmss, type ResultadoTeste } from '@/lib/testeFisico';

// Teste físico do mês: faz, compara com o anterior, edita ou apaga.
export default function TesteFisico() {
  const { user } = useAuth();
  const [lista, setLista] = useState<ResultadoTeste[]>([]);
  const [form, setForm] = useState<{ id?: string; valores: Record<string, string> } | null>(null);
  const [erro, setErro] = useState('');
  const [relogio, setRelogio] = useState<{ item: string; fim: number } | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const tique = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) return;
    getUserDoc<{ testes_fisicos?: ResultadoTeste[] }>(user.id, 'profile', 'main').then((p) => setLista(Array.isArray(p?.testes_fisicos) ? p!.testes_fisicos! : [])).catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (!relogio) return;
    tique.current = window.setInterval(() => {
      setAgora(Date.now());
      if (Date.now() >= relogio.fim) {
        try { navigator.vibrate?.([300, 100, 300]); } catch { /* ok */ }
        setRelogio(null);
      }
    }, 250);
    return () => window.clearInterval(tique.current);
  }, [relogio]);

  const gravar = async (nova: ResultadoTeste[]) => {
    if (!user?.id) return;
    setErro('');
    try { await setUserDoc(user.id, 'profile', 'main', { testes_fisicos: nova }, true); setLista(nova); }
    catch { setErro('Não consegui salvar agora. Confira a internet.'); }
  };
  const salvar = async () => {
    if (!form) return;
    const valores: Record<string, number> = {};
    for (const it of ITENS_TESTE) { const v = it.unidade === 's' ? lerTempo(form.valores[it.id] || '') : Number(form.valores[it.id] || 0); if (v > 0) valores[it.id] = Math.round(v); }
    if (!Object.keys(valores).length) { setErro('Preencha pelo menos um teste.'); return; }
    const item: ResultadoTeste = { id: form.id || `t${Date.now()}`, em: form.id ? (lista.find((x) => x.id === form.id)?.em ?? new Date().toISOString()) : new Date().toISOString(), valores };
    const nova = [item, ...lista.filter((x) => x.id !== item.id)].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 36);
    await gravar(nova);
    setForm(null);
  };
  const apagar = async (r: ResultadoTeste) => {
    if (await confirmar(`Apagar o teste de ${new Date(r.em).toLocaleDateString('pt-BR')}?`)) await gravar(lista.filter((x) => x.id !== r.id));
  };

  const ultimo = lista[0];
  const dias = diasDesde(ultimo?.em);
  const mostra = (id: string, v?: number) => (v ? (ITENS_TESTE.find((i) => i.id === id)?.unidade === 's' ? mmss(v) : String(v)) : '—');

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-600">Uma vez por mês, faça estes testes do mesmo jeito. Assim você vê a evolução do condicionamento, não só do espelho.</p>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {dias !== null && dias >= 28 && !form && <p className="rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800"><i className="ri-calendar-event-line mr-1"></i>Já faz {dias} dias do último teste. Hora de refazer!</p>}

      {form ? (
        <Card padding="p-4">
          <h3 className="font-heading text-base font-semibold text-foreground-950">{form.id ? 'Corrigir teste' : 'Teste de hoje'}</h3>
          <div className="mt-2 space-y-3">
            {ITENS_TESTE.map((it) => (
              <div key={it.id}>
                <label className="block text-sm font-semibold text-foreground-800">{it.nome}
                  <input value={form.valores[it.id] ?? ''} onChange={(e) => setForm((f) => f && { ...f, valores: { ...f.valores, [it.id]: e.target.value } })} inputMode={it.unidade === 's' ? 'text' : 'numeric'}
                    placeholder={it.unidade === 's' ? (it.id === 'corrida' ? 'min:seg (ex.: 6:30)' : 'segundos ou min:seg') : 'repetições'} aria-label={it.nome}
                    className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-base font-normal outline-none focus:border-primary-400" />
                </label>
                <p className="mt-0.5 text-xs text-foreground-500">{it.como}</p>
                {it.cronometro && (
                  relogio?.item === it.id
                    ? <p className="mt-1 text-sm font-bold text-primary-700" role="timer">Valendo! {Math.max(0, Math.ceil((relogio.fim - agora) / 1000))} s</p>
                    : <button type="button" onClick={() => setRelogio({ item: it.id, fim: Date.now() + (it.cronometro ?? 60) * 1000 })} className="mt-1 text-xs font-semibold text-primary-600 underline"><i className="ri-timer-line mr-1"></i>Cronômetro de 1 minuto</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setForm(null); setErro(''); }} className="rounded-xl border border-background-200 px-3 py-2.5 text-sm font-semibold text-foreground-700">Cancelar</button>
            <button type="button" onClick={() => void salvar()} className="rounded-xl bg-primary-500 px-3 py-2.5 text-sm font-semibold text-background-50" data-testid="salvar-teste">Salvar</button>
          </div>
        </Card>
      ) : (
        <button type="button" onClick={() => setForm({ valores: {} })} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50"><i className="ri-add-line mr-1"></i>Fazer o teste de hoje</button>
      )}

      {lista.map((r, i) => {
        const dif = compararTeste(r, lista[i + 1]);
        return (
          <Card key={r.id} padding="p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground-950">{new Date(r.em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <span className="flex gap-1">
                <button type="button" onClick={() => setForm({ id: r.id, valores: Object.fromEntries(Object.entries(r.valores).map(([k, v]) => [k, ITENS_TESTE.find((x) => x.id === k)?.unidade === 's' ? mmss(v) : String(v)])) })} aria-label="Corrigir teste" className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"><i className="ri-edit-line"></i></button>
                <button type="button" onClick={() => void apagar(r)} aria-label="Apagar teste" className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><i className="ri-delete-bin-line"></i></button>
              </span>
            </div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {ITENS_TESTE.filter((it) => r.valores[it.id]).map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span className="text-foreground-700">{it.nome}</span>
                  <span className="font-semibold text-foreground-950">{mostra(it.id, r.valores[it.id])}
                    {dif[it.id] !== null && dif[it.id] !== 0 && <span className={`ml-1 text-xs ${dif[it.id]! > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{dif[it.id]! > 0 ? '▲' : '▼'}{it.unidade === 's' ? mmss(Math.abs(dif[it.id]!)) : Math.abs(dif[it.id]!)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
