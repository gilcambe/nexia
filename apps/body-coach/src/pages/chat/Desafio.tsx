import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '@/lib/chat';

interface Desafio { id: string; titulo: string; dias: number; inicio: string }
interface VerCoach { desafio: Desafio | null; alunos: { uid: string; nome: string; feitos: number }[] }
interface VerAluno { desafio: Desafio | null; datas: string[]; hoje: string }

// Desafio da equipe: o coach cria, cada aluno marca o seu dia. O aluno só vê o próprio progresso.
export default function DesafioCard({ papel }: { papel: 'coach' | 'aluno' }) {
  const [d, setD] = useState<Desafio | null>(null);
  const [alunos, setAlunos] = useState<VerCoach['alunos']>([]);
  const [datas, setDatas] = useState<string[]>([]);
  const [hoje, setHoje] = useState('');
  const [titulo, setTitulo] = useState('');
  const [dias, setDias] = useState(7);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await chatApi<VerCoach & VerAluno>({ acao: 'desafio_ver' });
      setD(r.desafio ?? null);
      setAlunos(r.alunos ?? []);
      setDatas(r.datas ?? []);
      setHoje(r.hoje ?? '');
    } catch { /* sem desafio por enquanto */ }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const agir = async (corpo: Record<string, unknown>) => {
    if (ocupado) return;
    setOcupado(true); setErro('');
    try { await chatApi(corpo); await carregar(); setTitulo(''); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };

  if (papel === 'aluno' && !d) return null;
  const marcado = datas.includes(hoje);
  return (
    <div className="rounded-xl border border-secondary-200 bg-background-50 p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-foreground-950"><i className="ri-trophy-line text-secondary-500"></i>Desafio da equipe</div>
      {d && (
        <p className="mt-1 text-foreground-700">
          <strong>{d.titulo}</strong> · {d.dias} dias, começou em {d.inicio.split('-').reverse().join('/')}
        </p>
      )}
      {papel === 'aluno' && d && (
        <>
          <p className="mt-1 text-foreground-600">Você marcou {datas.length} de {d.dias} dias.</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-background-200"><div className="h-full bg-primary-500" style={{ width: `${Math.min(100, (datas.length / d.dias) * 100)}%` }} /></div>
          <button onClick={() => void agir({ acao: 'desafio_checkin' })} disabled={ocupado || marcado} className="mt-2 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 disabled:opacity-60">
            {marcado ? 'Hoje já está marcado ✓' : 'Marcar o dia de hoje'}
          </button>
        </>
      )}
      {papel === 'coach' && d && (
        <>
          <ul className="mt-2 space-y-1">
            {alunos.map((a) => <li key={a.uid} className="flex justify-between text-foreground-700"><span>{a.nome}</span><span>{a.feitos}/{d.dias} dias</span></li>)}
            {!alunos.length && <li className="text-foreground-500">Ainda não entrou nenhum aluno.</li>}
          </ul>
          <button onClick={() => void agir({ acao: 'desafio_encerrar' })} disabled={ocupado} className="mt-2 text-xs text-foreground-500 underline">Encerrar desafio</button>
        </>
      )}
      {papel === 'coach' && !d && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} placeholder="Ex.: Treinar todo dia" aria-label="Nome do desafio" className="min-w-0 flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300" />
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Duração" className="rounded-lg border border-background-200 bg-background-50 px-2 py-2 text-sm">
            {[3, 7, 14, 21, 30].map((n) => <option key={n} value={n}>{n} dias</option>)}
          </select>
          <button onClick={() => void agir({ acao: 'desafio_criar', titulo, dias })} disabled={ocupado || titulo.trim().length < 3} className="rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 disabled:opacity-60">Criar desafio</button>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-primary-800">{erro}</p>}
    </div>
  );
}
