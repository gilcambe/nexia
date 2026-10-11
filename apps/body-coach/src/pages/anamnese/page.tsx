import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { minhaAnamnese, responderAnamnese, type Anamnese } from '@/lib/coach/equipe';

const campo = 'w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none focus:border-primary-300';

// O aluno responde as perguntas do coach dele. As respostas vão só para o coach.
export default function AnamnesePage() {
  const navigate = useNavigate();
  const [a, setA] = useState<Anamnese | null | undefined>(undefined);
  const [coach, setCoach] = useState('');
  const [r, setR] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    minhaAnamnese().then((x) => { setA(x.anamnese); setCoach(x.coach || 'Seu coach'); setR(x.respostas || {}); }).catch((e: Error) => { setErro(e.message); setA(null); });
  }, []);

  if (a === undefined) return <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>;
  if (!a) return <p className="rounded-xl bg-background-100 p-4 text-sm text-foreground-600">{erro || 'O seu coach não pediu nenhuma anamnese.'}</p>;
  if (feito) {
    return (
      <div className="rounded-2xl border border-accent-200 bg-accent-50 p-6 text-center" role="status">
        <i className="ri-checkbox-circle-line text-4xl text-accent-600"></i>
        <h1 className="mt-2 font-heading text-xl font-bold text-foreground-950">Pronto! {coach} recebeu as suas respostas.</h1>
        <p className="mt-1 text-sm text-foreground-600">Com elas, a ficha e a dieta ficam do seu jeito.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50">Voltar para o Hoje</button>
      </div>
    );
  }

  const faltam = a.perguntas.filter((p) => p.obrigatoria && !r[p.id]?.trim()).length;
  const enviar = async () => {
    setEnviando(true); setErro('');
    try {
      await responderAnamnese(r);
      setFeito(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">{a.titulo || 'Anamnese'}</h1>
        <p className="mt-1 text-sm text-foreground-600">{coach} quer te conhecer melhor para montar o seu treino e a sua dieta. Só {coach} vê as respostas.</p>
      </header>
      <ol className="space-y-3">
        {a.perguntas.map((p, i) => (
          <li key={p.id} className="rounded-2xl border border-background-200 bg-background-50 p-4">
            <p className="text-sm font-semibold text-foreground-950">{i + 1}. {p.texto}{p.obrigatoria && <span className="text-red-600"> *</span>}</p>
            <div className="mt-2">
              {p.tipo === 'simnao' && (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={p.texto}>
                  {([['sim', 'Sim'], ['nao', 'Não']] as const).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={r[p.id] === v} onClick={() => setR({ ...r, [p.id]: v })} className={`rounded-xl border py-2.5 text-sm font-semibold ${r[p.id] === v ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-background-200 text-foreground-700'}`}>{l}</button>
                  ))}
                </div>
              )}
              {p.tipo === 'opcoes' && (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={p.texto}>
                  {p.opcoes.map((o) => (
                    <button key={o} type="button" role="radio" aria-checked={r[p.id] === o} onClick={() => setR({ ...r, [p.id]: o })} className={`rounded-full border px-3 py-2 text-sm font-medium ${r[p.id] === o ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-background-200 text-foreground-700'}`}>{o}</button>
                  ))}
                </div>
              )}
              {p.tipo === 'numero' && <input type="number" inputMode="decimal" value={r[p.id] ?? ''} onChange={(e) => setR({ ...r, [p.id]: e.target.value })} aria-label={p.texto} className={campo} />}
              {p.tipo === 'texto' && <textarea value={r[p.id] ?? ''} onChange={(e) => setR({ ...r, [p.id]: e.target.value })} rows={2} maxLength={1000} aria-label={p.texto} className={campo} />}
            </div>
          </li>
        ))}
      </ol>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      <button type="button" disabled={enviando || faltam > 0} onClick={() => void enviar()} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
        {enviando ? 'Enviando...' : faltam ? `Faltam ${faltam} resposta${faltam > 1 ? 's' : ''} obrigatória${faltam > 1 ? 's' : ''}` : `Enviar para ${coach}`}
      </button>
    </div>
  );
}
