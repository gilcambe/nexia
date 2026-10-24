import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Card from '@/components/base/Card';
import { agendarAvaliacao, PREPARO } from '@/lib/avaliacao/coach';
import { alertas, dataBr, simetria } from '@/lib/avaliacao/calculos';
import { hojeIso } from '@/lib/avaliacao/importar';
import PainelCorpo from '../evolution/corpo3d/PainelCorpo';
import GraficosEvolucao from '../evolution/avaliacao/GraficosEvolucao';
import AbaFotos from '../evolution/fotos/AbaFotos';
import { useAluno } from './useAluno';

type Aba = 'resumo' | 'avaliacoes' | 'fotos' | 'graficos';
const ABAS: { id: Aba; label: string; icone: string }[] = [
  { id: 'resumo', label: 'Resumo', icone: 'ri-body-scan-line' },
  { id: 'avaliacoes', label: 'Avaliações', icone: 'ri-file-list-3-line' },
  { id: 'fotos', label: 'Fotos', icone: 'ri-camera-line' },
  { id: 'graficos', label: 'Gráficos', icone: 'ri-line-chart-line' },
];
const fmt = (n: number | undefined | null, u: string) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u}`);

// Evolução de um aluno vista pelo coach: as mesmas telas do aluno, só para ler, e a agenda da próxima avaliação.
export default function AlunoEvolucao() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { dados, perfil, serie, erro, recarregar, setDados } = useAluno(uid);
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'resumo') as Aba;
  const [data, setData] = useState('');
  const [hora, setHora] = useState('07:00');
  const [agMsg, setAgMsg] = useState('');

  if (erro) {
    return (
      <div className="space-y-3">
        <Link to="/coach/evolucao" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Alunos</Link>
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      </div>
    );
  }
  if (!dados) return <p className="py-10 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>;

  const ult = serie[serie.length - 1] ?? null;
  const avisos = alertas(serie.map((s) => ({ data: s.data, m: s.m })));
  const lados = ult ? simetria(ult.av.valores, ult.av.segmental).filter((l) => l.atencao) : [];

  const agendar = async (cancelar = false) => {
    if (!uid) return;
    setAgMsg('');
    try {
      const r = await agendarAvaliacao(uid, cancelar ? null : data, hora);
      setDados({ ...dados, proximaAvaliacao: r.proximaAvaliacao });
      setAgMsg(cancelar ? 'Avaliação desmarcada.' : `Marcada. ${dados.nome} recebeu o aviso na conversa com as dicas de preparo.`);
    } catch (e) { setAgMsg((e as Error).message); }
  };

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => navigate('/coach/evolucao')} aria-label="Voltar para os alunos" className="rounded-lg p-2 text-foreground-700 hover:bg-background-100"><i className="ri-arrow-left-line text-lg"></i></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-xl font-bold text-foreground-950">{dados.nome}</h1>
          <p className="text-xs text-foreground-500">{serie.length} avaliação(ões){dados.partilha.fotos ? ' · fotos liberadas' : ' · fotos não liberadas pelo aluno'}</p>
        </div>
        <Link to="/chat" className="rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700"><i className="ri-chat-3-line mr-1"></i>Conversa</Link>
      </header>

      <nav className="sticky top-0 z-20 grid grid-cols-4 gap-1 rounded-2xl border border-background-200 bg-background-50/95 p-1 backdrop-blur" aria-label="Seções da evolução do aluno">
        {ABAS.map((a) => (
          <button key={a.id} type="button" onClick={() => setParams(a.id === 'resumo' ? {} : { aba: a.id }, { replace: true })} aria-current={aba === a.id ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold ${aba === a.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'text-foreground-600'}`}>
            <i className={`${a.icone} text-base`}></i>{a.label}
          </button>
        ))}
      </nav>

      {/* Resumo: números e próxima avaliação primeiro (cabem numa tela); o corpo em 3D vem depois. */}
      {aba === 'resumo' && (
        <>
          <Card padding="p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-semibold text-foreground-950">Última avaliação {ult ? `· ${dataBr(ult.data)}` : ''}</h2>
              {ult && <button type="button" onClick={() => navigate(`/coach/evolucao/${uid}/relatorio/${ult.id}`)} className="shrink-0 rounded-lg bg-primary-500 px-2.5 py-1.5 text-xs font-semibold text-background-50 dark:text-foreground-950"><i className="ri-file-chart-line mr-1"></i>Relatório</button>}
            </div>
            {!ult ? <p className="mt-1 text-sm text-foreground-500">O aluno ainda não registrou avaliação.</p> : (
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11px] text-foreground-500">
                <p className="rounded-lg bg-background-100 px-1 py-1.5">Peso<b className="block text-sm text-foreground-950">{fmt(ult.m.peso, 'kg')}</b></p>
                <p className="rounded-lg bg-background-100 px-1 py-1.5">Gordura<b className="block text-sm text-foreground-950">{fmt(ult.m.gordura, '%')}</b></p>
                <p className="rounded-lg bg-background-100 px-1 py-1.5">Massa magra<b className="block text-sm text-foreground-950">{fmt(ult.m.mlg, 'kg')}</b></p>
                <p className="rounded-lg bg-background-100 px-1 py-1.5">Cintura<b className="block text-sm text-foreground-950">{fmt(ult.m.cintura, 'cm')}</b></p>
              </div>
            )}
            {(avisos.length > 0 || lados.length > 0) && (
              <ul className="mt-2 space-y-1 text-xs">
                {avisos.map((a) => <li key={a.texto} className={`rounded-lg px-2.5 py-1.5 ${a.nivel === 'atencao' ? 'bg-red-50 text-red-700' : 'bg-accent-50 text-accent-800'}`}>{a.nivel === 'atencao' ? '⚠️' : '✅'} {a.texto}</li>)}
                {lados.map((l) => <li key={l.label} className="rounded-lg bg-secondary-50 px-2.5 py-1.5 text-secondary-900">↔️ {l.label}: {fmt(l.diferenca, l.unidade)} de diferença, lado {l.menor} menor.</li>)}
              </ul>
            )}
          </Card>
          <Card padding="p-3">
            <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-calendar-event-line mr-1 text-primary-500"></i>Próxima avaliação{dados.proximaAvaliacao ? <span className="font-normal text-foreground-700">: <b>{dataBr(dados.proximaAvaliacao.data)}{dados.proximaAvaliacao.hora ? ` às ${dados.proximaAvaliacao.hora}` : ''}</b></span> : null}</h2>
            <div className="mt-2 flex gap-1.5">
              <input type="date" min={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} aria-label="Data da avaliação" className="min-w-0 flex-1 rounded-lg border border-background-300 bg-background-50 px-2 py-1.5 text-sm" />
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora da avaliação" className="w-24 rounded-lg border border-background-300 bg-background-50 px-2 py-1.5 text-sm" />
              <button type="button" disabled={!data} onClick={() => void agendar()} className="shrink-0 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-semibold text-background-50 disabled:opacity-40 dark:text-foreground-950">Marcar</button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-foreground-600">
              <details><summary className="cursor-pointer font-semibold">Dicas de preparo que o aluno recebe</summary><ul className="mt-1 list-disc pl-5">{PREPARO.map((p) => <li key={p}>{p}</li>)}</ul></details>
              {dados.proximaAvaliacao && <button type="button" onClick={() => void agendar(true)} className="shrink-0 font-semibold text-foreground-700 underline">Desmarcar</button>}
            </div>
            {agMsg && <p className="mt-1 text-sm text-foreground-700">{agMsg}</p>}
          </Card>
          <Card padding="p-3"><PainelCorpo serie={serie} perfil={perfil} volume={{}} nome={dados.nome} /></Card>
        </>
      )}

      {aba === 'avaliacoes' && (
        <Card padding="p-5">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">Avaliações de {dados.nome}</h2>
          {serie.length === 0 && <p className="text-sm text-foreground-500">Nenhuma avaliação ainda.</p>}
          <ul className="space-y-2">
            {[...serie].reverse().map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-background-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-950">{dataBr(s.data)}</p>
                  <p className="truncate text-xs text-foreground-500">{[fmt(s.m.peso, 'kg'), s.m.gordura != null ? fmt(s.m.gordura, '% gordura') : null, s.av.fonte].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" onClick={() => navigate(`/coach/evolucao/${uid}/relatorio/${s.id}`)} aria-label={`Relatório de ${dataBr(s.data)}`} className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50 dark:text-foreground-950">Relatório</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {aba === 'fotos' && (dados.partilha.fotos
        ? <AbaFotos uid={undefined} entries={dados.entradas} serie={serie} onMudou={recarregar} somenteComparar />
        : <Card padding="p-5"><p className="text-sm text-foreground-600">{dados.nome} ainda não liberou as fotos para você. Peça na conversa: em Evolução, o aluno liga “Mostrar minhas fotos ao coach”.</p></Card>)}
      {aba === 'graficos' && <GraficosEvolucao serie={serie} metaGordura={perfil.metaGordura} metaPeso={perfil.metaPeso} />}
    </div>
  );
}
