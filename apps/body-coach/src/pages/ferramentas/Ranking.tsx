import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';
import { rankingCarga, type ExCarga, type LinhaCarga } from '@/lib/comunidade';

interface Linha { nome: string; eu: boolean; visivel: boolean; treinos: number; minutos: number; dias: number; pontos: number; refeicoes?: number; checkins?: number; feedbacks?: number }
interface Resposta { lista: Linha[]; desafio?: { titulo: string; dias: number } | null; participo: boolean; apelido: string; semEquipe?: boolean; papel?: string }

const MEDALHA = ['🥇', '🥈', '🥉'];

// Ranking da semana da equipe do coach: 10 pontos por treino, 1 a cada 10 min e 5 por dia de desafio.
// Só aparece quem escolheu participar (dá para usar apelido). Zera toda segunda.
export default function Ranking() {
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState('');
  const [apelido, setApelido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<'semana' | 'carga'>('semana');

  const carregar = useCallback(async () => {
    try {
      const x = await chatApi<Resposta>({ acao: 'ranking_ver' });
      setR(x); setApelido(x.apelido || ''); setErro('');
    } catch (e) { setErro((e as Error).message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const config = async (participar: boolean) => {
    setOcupado(true);
    try { await chatApi({ acao: 'ranking_config', participar, apelido }); await carregar(); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };

  if (erro && !r) {
    return (
      <Card>
        <p className="text-sm text-foreground-700">{/escolha se você é aluno ou coach/i.test(erro) ? 'Para entrar no ranking, abra a conversa com o seu coach e entre na equipe dele.' : erro}</p>
        <Link to="/chat" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50">Abrir conversa</Link>
      </Card>
    );
  }
  if (!r) return <p className="text-sm text-foreground-500">Carregando o ranking…</p>;
  if (r.semEquipe) {
    return (
      <Card>
        <p className="text-sm text-foreground-700">O ranking é entre os alunos do mesmo coach. Entre na equipe do seu coach com o código dele para disputar.</p>
        <Link to="/chat" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50">Entrar com o código</Link>
      </Card>
    );
  }

  const abas = (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-background-100 p-1" role="tablist">
      {([['semana', 'Pontos da semana'], ['carga', 'Evolução de carga']] as const).map(([id, l]) => (
        <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`rounded-lg py-2 text-sm font-semibold ${aba === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{l}</button>
      ))}
    </div>
  );
  if (aba === 'carga') return <div className="space-y-3">{abas}<RankingCarga /></div>;

  return (
    <div className="space-y-3">
      {abas}
      {r.desafio && (
        <div className="rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 p-4 text-background-50">
          <p className="text-xs font-semibold uppercase opacity-80">Desafio do coach</p>
          <p className="font-heading text-lg font-bold">{r.desafio.titulo}</p>
          <p className="text-sm opacity-90">{r.desafio.dias} dias · cada treino marca o seu dia sozinho</p>
        </div>
      )}
      <Card padding="p-3">
        <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Ranking da semana</h2>
        {r.lista.length === 0 && <p className="px-1 text-sm text-foreground-500">Ninguém treinou ainda esta semana. Seja o primeiro!</p>}
        <ol className="space-y-1.5">
          {r.lista.map((l, i) => (
            <li key={`${l.nome}-${i}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${l.eu ? 'bg-primary-50 ring-1 ring-primary-300' : 'bg-background-100/60'}`}>
              <span className="w-7 text-center font-heading text-lg font-bold">{MEDALHA[i] ?? i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground-950">{l.nome}{l.eu && ' (você)'}{!l.visivel && <span className="ml-1 text-[11px] font-normal text-foreground-400">· oculto para a equipe</span>}</span>
                <span className="block text-xs text-foreground-500">{l.treinos} treinos · {l.minutos} min{l.refeicoes ? ` · ${l.refeicoes} refeições` : ''}{l.checkins ? ` · ${l.checkins} check-ins` : ''}{r.desafio ? ` · ${l.dias} dias de desafio` : ''}</span>
              </span>
              <span className="font-heading text-lg font-bold text-primary-700">{l.pontos}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 px-1 text-[11px] text-foreground-400">10 pontos por treino, 1 a cada 10 minutos, 5 por dia de desafio, 2 por refeição registrada (até 5 por dia), 2 pelo check-in do dia e 3 por treino com retorno para o coach. Zera toda segunda.</p>
      </Card>
      {r.papel === 'coach' && <p className="px-1 text-xs text-foreground-500">Como coach, você vê toda a equipe. Cada aluno escolhe se aparece para os colegas. Crie desafios na conversa da equipe.</p>}
      {r.papel !== 'coach' && <Card>
        <h3 className="font-semibold text-foreground-950">Aparecer para a equipe</h3>
        <p className="mt-1 text-sm text-foreground-600">{r.participo ? 'Você está no ranking. Os outros alunos veem o seu nome (ou apelido) e os seus pontos.' : 'Hoje só você e o seu coach veem os seus pontos.'}</p>
        <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={30} placeholder="Apelido (opcional)" aria-label="Apelido" className="mt-2 w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm" />
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={ocupado} onClick={() => void config(true)} className="flex-1 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-60">{r.participo ? 'Salvar apelido' : 'Quero participar'}</button>
          {r.participo && <button type="button" disabled={ocupado} onClick={() => void config(false)} className="rounded-xl border border-background-200 px-4 py-2.5 text-sm font-semibold text-foreground-700">Sair</button>}
        </div>
      </Card>}
      {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
    </div>
  );
}

// Quem mais evoluiu a carga desde a primeira vez (1RM estimado), por exercício ou na média.
function RankingCarga() {
  const [ex, setEx] = useState('');
  const [d, setD] = useState<{ exercicios: ExCarga[]; lista: LinhaCarga[]; semEquipe?: boolean } | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { setD(null); rankingCarga(ex || undefined).then(setD).catch((e: Error) => setErro(e.message)); }, [ex]);
  if (erro) return <p className="text-sm text-red-600" role="alert">{erro}</p>;
  if (!d) return <p className="text-sm text-foreground-500">Carregando…</p>;
  return (
    <Card padding="p-3">
      <div className="flex gap-1.5 overflow-x-auto pb-2" data-testid="carga-exercicios">
        <button type="button" onClick={() => setEx('')} aria-pressed={!ex} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${!ex ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-700'}`}>Geral</button>
        {d.exercicios.map((x) => <button key={x.id} type="button" onClick={() => setEx(x.id)} aria-pressed={ex === x.id} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${ex === x.id ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-700'}`}>{x.nome}</button>)}
      </div>
      {d.lista.length === 0 && <p className="px-1 py-2 text-sm text-foreground-500">Ainda sem evolução para comparar. Treine o mesmo exercício mais de uma vez e a sua carga aparece aqui.</p>}
      <ol className="space-y-1.5">
        {d.lista.map((l, i) => (
          <li key={`${l.nome}-${i}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${l.eu ? 'bg-primary-50 ring-1 ring-primary-300' : 'bg-background-100/60'}`}>
            <span className="w-7 text-center font-heading text-lg font-bold">{MEDALHA[i] ?? i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-foreground-950">{l.nome}{l.eu && ' (você)'}</span>
              <span className="block text-xs text-foreground-500">{ex ? (l.kg ? `melhor: ${l.kg} kg × ${l.reps} · 1RM ${l.de} → ${l.para} kg` : '') : `média de ${l.exercicios} exercício${l.exercicios === 1 ? '' : 's'}`}</span>
            </span>
            <span className={`font-heading text-lg font-bold ${l.ganho > 0 ? 'text-accent-700' : 'text-foreground-500'}`}>{l.ganho > 0 ? '+' : ''}{Math.round(l.ganho)}%</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 px-1 text-[11px] text-foreground-400">Quanto a carga subiu desde a primeira vez que você fez o exercício no app (1RM estimado pelas suas melhores séries).</p>
    </Card>
  );
}
