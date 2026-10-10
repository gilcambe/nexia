import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { alunosEvolucao, type AlunoResumo } from '@/lib/avaliacao/coach';
import { alertas, dataBr } from '@/lib/avaliacao/calculos';
import { montarSerie } from '@/lib/avaliacao/serie';

const fmt = (n: number | undefined | null, u: string) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u}`);
const VAZIO = { sexo: null, idade: null, altura: null, nome: null };

// Painel do coach: todos os alunos com a última avaliação, o que mudou, alertas e quem está atrasado.
export default function AlunosEvolucao() {
  const [alunos, setAlunos] = useState<AlunoResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'atencao' | 'atrasados'>('todos');

  useEffect(() => { alunosEvolucao().then(setAlunos).catch((e: Error) => { setErro(e.message); setAlunos([]); }); }, []);

  const linhas = (alunos ?? []).map((a) => {
    const serie = montarSerie(a.entradas, a.perfil ?? VAZIO);
    const ult = serie[serie.length - 1];
    const ant = serie.length > 1 ? serie[serie.length - 2] : null;
    const avisos = alertas(serie.map((s) => ({ data: s.data, m: s.m }))).filter((x) => x.nivel === 'atencao');
    const dias = ult ? Math.floor((Date.now() - new Date(`${ult.data}T12:00:00`).getTime()) / 86400000) : null;
    const delta = (k: string) => (ult?.m[k] != null && ant?.m[k] != null ? Math.round((ult.m[k] - ant.m[k]) * 10) / 10 : null);
    return { a, ult, avisos, dias, dPeso: delta('peso'), dGordura: delta('gordura'), atrasado: dias == null || dias > 35 };
  })
    .filter((l) => filtro === 'todos' || (filtro === 'atencao' ? l.avisos.length > 0 : l.atrasado))
    .sort((x, y) => y.avisos.length - x.avisos.length || (y.dias ?? 999) - (x.dias ?? 999));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Evolução dos alunos</h1>
        <p className="mt-1 text-sm text-foreground-600">Última avaliação de cada aluno, o que mudou e quem precisa de atenção.</p>
      </header>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-background-100 p-1" role="tablist">
        {([['todos', 'Todos'], ['atencao', 'Com alerta'], ['atrasados', 'Atrasados']] as const).map(([id, l]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`rounded-lg py-1.5 text-xs font-semibold ${filtro === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{l}</button>
        ))}
      </div>
      {alunos == null && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {alunos && alunos.length === 0 && !erro && (
        <Card padding="p-5"><p className="text-sm text-foreground-600">Nenhum aluno ainda. Passe o seu código em <Link to="/chat" className="font-semibold text-primary-600">Conversa</Link>.</p></Card>
      )}
      {alunos && alunos.length > 0 && linhas.length === 0 && <p className="text-center text-sm text-foreground-500">Ninguém neste filtro.</p>}
      <ul className="space-y-3">
        {linhas.map(({ a, ult, avisos, dias, dPeso, dGordura, atrasado }) => (
          <li key={a.uid}>
            <Link to={`/coach/evolucao/${a.uid}`} className="block rounded-2xl border border-background-200 bg-background-50 p-4 transition hover:border-primary-300" aria-label={`Evolução de ${a.nome}`}>
              <div className="flex items-center gap-3">
                {a.foto ? <img src={a.foto} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line"></i></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground-950">{a.nome}</p>
                  <p className="text-xs text-foreground-500">
                    {!a.partilha.avaliacoes ? 'Não compartilhou as avaliações' : ult ? `Última: ${dataBr(ult.data)} (há ${dias} dia${dias === 1 ? '' : 's'})` : 'Sem avaliação ainda'}
                  </p>
                </div>
                <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
              </div>
              {ult && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-lg bg-background-100 px-2 py-1.5">Peso <b>{fmt(ult.m.peso, 'kg')}</b>{dPeso ? <span className="ml-1 text-xs text-foreground-500">{dPeso > 0 ? '+' : ''}{dPeso}</span> : null}</p>
                  <p className="rounded-lg bg-background-100 px-2 py-1.5">Gordura <b>{fmt(ult.m.gordura, '%')}</b>{dGordura ? <span className={`ml-1 text-xs ${dGordura < 0 ? 'text-accent-600' : 'text-red-500'}`}>{dGordura > 0 ? '+' : ''}{dGordura}</span> : null}</p>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {avisos.map((x) => <span key={x.texto} className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">⚠️ {x.texto.split(/[:(]/)[0].trim()}</span>)}
                {atrasado && a.partilha.avaliacoes && <span className="rounded-full bg-secondary-50 px-2 py-0.5 text-secondary-800">Reavaliação atrasada</span>}
                {a.proximaAvaliacao && <span className="rounded-full bg-accent-50 px-2 py-0.5 text-accent-800">📅 {dataBr(a.proximaAvaliacao.data)}{a.proximaAvaliacao.hora ? ` ${a.proximaAvaliacao.hora}` : ''}</span>}
                {a.partilha.fotos && <span className="rounded-full bg-background-100 px-2 py-0.5 text-foreground-600">📷 fotos liberadas</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
