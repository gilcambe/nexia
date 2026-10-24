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
    <div className="space-y-3">
      <h1 className="font-heading text-xl font-bold text-foreground-950">Evolução dos alunos</h1>
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
      {/* Uma linha por aluno: peso e gordura com a mudança; o resto abre no toque. */}
      <ul className="divide-y divide-background-200 overflow-hidden rounded-2xl border border-background-200 bg-background-50">
        {linhas.map(({ a, ult, avisos, dias, dPeso, dGordura, atrasado }) => {
          const marcas = [
            ...avisos.map((x) => `⚠️ ${x.texto.split(/[:(]/)[0].trim()}`),
            atrasado && a.partilha.avaliacoes ? 'Reavaliação atrasada' : '',
            a.proximaAvaliacao ? `📅 ${dataBr(a.proximaAvaliacao.data)}${a.proximaAvaliacao.hora ? ` ${a.proximaAvaliacao.hora}` : ''}` : '',
            a.partilha.fotos ? '📷' : '',
          ].filter(Boolean);
          return (
            <li key={a.uid}>
              <Link to={`/coach/evolucao/${a.uid}`} className="flex items-center gap-2.5 px-3 py-2 hover:bg-background-100" aria-label={`Evolução de ${a.nome}`}>
                {a.foto ? <img src={a.foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line"></i></span>}
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold text-foreground-950">{a.nome}</p>
                  <p className="truncate text-xs text-foreground-500">
                    {!a.partilha.avaliacoes ? 'Não compartilhou as avaliações' : ult ? `Última: ${dataBr(ult.data)} (há ${dias} dia${dias === 1 ? '' : 's'})` : 'Sem avaliação ainda'}
                  </p>
                  {marcas.length > 0 && <p className={`truncate text-[11px] font-medium ${avisos.length || atrasado ? 'text-red-600' : 'text-foreground-500'}`}>{marcas.join(' · ')}</p>}
                </div>
                {ult && (
                  <div className="shrink-0 text-right text-xs leading-tight">
                    <p><b className="text-foreground-950">{fmt(ult.m.peso, 'kg')}</b>{dPeso ? <span className="ml-1 text-foreground-500">{dPeso > 0 ? '+' : ''}{dPeso}</span> : null}</p>
                    <p><b className="text-foreground-950">{fmt(ult.m.gordura, '%')}</b>{dGordura ? <span className={`ml-1 ${dGordura < 0 ? 'text-accent-600' : 'text-red-500'}`}>{dGordura > 0 ? '+' : ''}{dGordura}</span> : null}</p>
                  </div>
                )}
                <i className="ri-arrow-right-s-line text-lg text-foreground-400"></i>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
