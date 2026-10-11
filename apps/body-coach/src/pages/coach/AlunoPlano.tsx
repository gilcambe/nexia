import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { prescricaoDo, salvarDieta, salvarFicha, type Prescricao } from '@/lib/coach/alunos';
import FichaEditor from './components/FichaEditor';
import DietaEditor, { type Plano } from './components/DietaEditor';
import { SalvarComoModelo, UsarModelo } from './components/ModeloUtil';
import ExportarPlano from '@/components/feature/ExportarPlano';
import type { FichaCoach } from '@/lib/coach/fichaCoach';
import type { AnamneseDoAluno } from '@/lib/coach/equipe';

// Um aluno, do lado do coach: montar a ficha de treino e a dieta que aparecem no app dele.
export default function AlunoPlano() {
  const { uid = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'dieta' ? 'dieta' : 'treino';
  const [p, setP] = useState<Prescricao | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState('');
  const [versao, setVersao] = useState(0); // remonta o editor depois de salvar/remover
  const [doModelo, setDoModelo] = useState<{ ficha?: FichaCoach; dieta?: Plano } | null>(null); // modelo escolhido, ainda não enviado
  const usarModelo = (tipo: 'ficha' | 'dieta', dados: FichaCoach | Plano) => { setDoModelo(tipo === 'ficha' ? { ficha: dados as FichaCoach } : { dieta: dados as Plano }); setVersao((v) => v + 1); setOk(''); };

  useEffect(() => { prescricaoDo(uid).then(setP).catch((e: Error) => setErro(e.message)); }, [uid]);

  const enviar = async (fazer: () => Promise<unknown>, msg: string, depois: (x: Prescricao) => Prescricao) => {
    setSalvando(true); setErro(''); setOk('');
    try {
      await fazer();
      setP((x) => (x ? depois(x) : x));
      setVersao((v) => v + 1);
      setDoModelo(null);
      setOk(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const nome = p?.nome ?? 'Aluno';
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/coach/alunos" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Meus alunos</Link>
      <header className="flex items-center gap-3">
        {p?.foto ? <img src={p.foto} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line text-xl"></i></span>}
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-bold text-foreground-950">{nome}</h1>
          <p className="text-xs text-foreground-500">
            {p && [p.respostas.goal, p.respostas.level, p.respostas.days ? `${p.respostas.days} dias/sem` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>
      {p && (Array.isArray(p.respostas.mobility) && p.respostas.mobility.length > 0 || p.respostas.injuries) ? (
        <p className="rounded-lg bg-secondary-50 px-3 py-2 text-xs text-secondary-900"><i className="ri-alert-line mr-1"></i>Atenção: {[...(Array.isArray(p.respostas.mobility) ? p.respostas.mobility as string[] : []), p.respostas.injuries].filter(Boolean).join(', ')}</p>
      ) : null}
      <div className="flex gap-2 text-xs">
        <Link to={`/chat?com=${uid}`} className="rounded-lg border border-background-200 px-3 py-1.5 font-semibold text-foreground-700"><i className="ri-chat-3-line mr-1"></i>Conversar</Link>
        <Link to={`/coach/evolucao/${uid}`} className="rounded-lg border border-background-200 px-3 py-1.5 font-semibold text-foreground-700"><i className="ri-line-chart-line mr-1"></i>Evolução</Link>
      </div>

      {p?.anamnese && <RespostasAnamnese a={p.anamnese} nome={nome} />}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-background-100 p-1" role="tablist">
        {([['treino', 'Ficha de treino'], ['dieta', 'Dieta']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => { setOk(''); setParams(id === 'dieta' ? { aba: 'dieta' } : {}, { replace: true }); }} className={`rounded-lg py-2 text-sm font-semibold ${aba === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{l}</button>
        ))}
      </div>

      {ok && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{ok}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {!p && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}

      {p && aba === 'treino' && (
        <FichaEditor
          key={`f${versao}`}
          nomeAluno={nome}
          respostas={p.respostas}
          inicial={doModelo?.ficha ?? p.ficha}
          podeRemover={!!p.ficha}
          extraVazio={<UsarModelo tipo="ficha" onUsar={(d) => usarModelo('ficha', d)} />}
          extraRodape={(f) => <div className="space-y-2 border-t border-background-200 pt-3"><ExportarPlano ficha={f} aluno={nome} /><SalvarComoModelo tipo="ficha" dados={f} nomePadrao={f.nome} /></div>}
          salvando={salvando}
          onSalvar={(f) => void enviar(() => salvarFicha(uid, f), `Ficha enviada! ${nome} já vê no app e recebeu um aviso na conversa.`, (x) => ({ ...x, ficha: f, fichaDia: 0 }))}
          onRemover={() => void enviar(() => salvarFicha(uid, null), 'Ficha tirada. O app volta a montar o treino sozinho.', (x) => ({ ...x, ficha: null }))}
        />
      )}
      {p && aba === 'dieta' && (
        <DietaEditor
          key={`d${versao}`}
          nomeAluno={nome}
          inicial={doModelo?.dieta ?? p.plano}
          podeRemover={!!p.plano}
          extraVazio={<UsarModelo tipo="dieta" onUsar={(d) => usarModelo('dieta', d)} />}
          extraRodape={(d) => <div className="space-y-2 border-t border-background-200 pt-3"><ExportarPlano plano={d} aluno={nome} /><SalvarComoModelo tipo="dieta" dados={d} nomePadrao={`Dieta ${d.totais?.kcal ? `${Math.round(d.totais.kcal)} kcal` : nome}`} /></div>}
          salvando={salvando}
          onSalvar={(d) => void enviar(() => salvarDieta(uid, d), `Dieta enviada! ${nome} já vê na aba Nutrição.`, (x) => ({ ...x, plano: { arquivo: 'Plano do coach', importado_em: new Date().toISOString(), do_coach: true, ...d } }))}
          onRemover={() => void enviar(() => salvarDieta(uid, null), 'Dieta tirada do aluno.', (x) => ({ ...x, plano: null }))}
        />
      )}
    </div>
  );
}

// Respostas da anamnese do coach (ou o aviso de que o aluno ainda não respondeu).
function RespostasAnamnese({ a, nome }: { a: AnamneseDoAluno; nome: string }) {
  const [aberto, setAberto] = useState(false);
  if (a.situacao !== 'respondida' && !Object.keys(a.respostas).length) {
    return <p className="rounded-lg bg-secondary-50 px-3 py-2 text-xs text-secondary-900" data-testid="anamnese-pendente"><i className="ri-survey-line mr-1"></i>{nome} ainda não respondeu a sua anamnese. Ele vê o pedido ao abrir o app.</p>;
  }
  const valor = (v: string | undefined) => (v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : v || '—');
  return (
    <div className="rounded-2xl border border-background-200 bg-background-50" data-testid="anamnese-respostas">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground-900">
        <span><i className="ri-survey-line mr-1 text-primary-600"></i>Anamnese{a.situacao === 'pendente' ? ' (respostas antigas: você mudou as perguntas)' : ''}{a.em ? <span className="ml-1 text-xs font-normal text-foreground-500">· {new Date(a.em).toLocaleDateString('pt-BR')}</span> : null}</span>
        <i className={aberto ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
      </button>
      {aberto && (
        <dl className="space-y-2 border-t border-background-200 px-4 py-3">
          {a.perguntas.map((q) => (
            <div key={q.id}>
              <dt className="text-xs text-foreground-500">{q.texto}</dt>
              <dd className={`text-sm font-medium ${q.tipo === 'simnao' && a.respostas[q.id] === 'sim' ? 'text-red-700' : 'text-foreground-900'}`}>{valor(a.respostas[q.id])}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
