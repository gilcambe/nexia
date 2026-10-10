import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';

interface Linha { nome: string; eu: boolean; visivel: boolean; treinos: number; minutos: number; dias: number; pontos: number }
interface Resposta { lista: Linha[]; desafio?: { titulo: string; dias: number } | null; participo: boolean; apelido: string; semEquipe?: boolean; papel?: string }

const MEDALHA = ['🥇', '🥈', '🥉'];

// Ranking da semana da equipe do coach: 10 pontos por treino, 1 a cada 10 min e 5 por dia de desafio.
// Só aparece quem escolheu participar (dá para usar apelido). Zera toda segunda.
export default function Ranking() {
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState('');
  const [apelido, setApelido] = useState('');
  const [ocupado, setOcupado] = useState(false);

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

  return (
    <div className="space-y-3">
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
                <span className="block text-xs text-foreground-500">{l.treinos} treinos · {l.minutos} min{r.desafio ? ` · ${l.dias} dias de desafio` : ''}</span>
              </span>
              <span className="font-heading text-lg font-bold text-primary-700">{l.pontos}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 px-1 text-[11px] text-foreground-400">10 pontos por treino, 1 a cada 10 minutos e 5 por dia de desafio. Zera toda segunda.</p>
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
