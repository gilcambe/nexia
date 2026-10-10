import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatApi } from '@/lib/chat';
import { EXERCICIOS, type Grupo } from '@/lib/exerciseDb';
import { papelEContatos } from '@/lib/papelCoach';
import GravadorVideo from '@/components/feature/GravadorVideo';
import { demosCoach } from '@/lib/demosCoach';

// Biblioteca do coach: grava a própria execução de cada exercício. O aluno vê esse vídeo como a
// demonstração principal do exercício durante o treino.
const GRUPOS: Record<Grupo, string> = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', quadriceps: 'Quadríceps',
  posterior: 'Posterior', gluteos: 'Glúteos', panturrilha: 'Panturrilha', abdomen: 'Abdômen',
};

export default function Demonstracoes() {
  const [papel, setPapel] = useState<string | null>(null);
  const [feitas, setFeitas] = useState<string[]>([]);
  const [grupo, setGrupo] = useState<Grupo | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [gravando, setGravando] = useState<{ id: string; nome: string } | null>(null);
  const [vendo, setVendo] = useState<{ nome: string; video: string } | null>(null);

  useEffect(() => {
    void papelEContatos().then(({ papel: p }) => setPapel(p));
    void chatApi<{ lista: string[] }>({ acao: 'demo_listar' }).then((r) => setFeitas(r.lista)).catch(() => {});
  }, []);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return EXERCICIOS.filter((e) => (grupo === 'todos' || e.grupo === grupo) && (!q || e.id.includes(q.replace(/\s+/g, '-'))))
      .sort((a, b) => Number(feitas.includes(b.id)) - Number(feitas.includes(a.id)));
  }, [grupo, busca, feitas]);

  const ver = async (id: string, nome: string) => {
    try { const r = await chatApi<{ video: string | null }>({ acao: 'demo_ver', exercicio: id }); if (r.video) setVendo({ nome, video: r.video }); } catch { /* sem vídeo */ }
  };

  if (papel && papel !== 'coach') {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-background-200 bg-background-50 p-5 text-sm text-foreground-700">
        Esta área é do coach. Ative o modo coach no seu perfil para gravar demonstrações. <Link to="/profile" className="font-semibold text-primary-600 underline">Ir ao perfil</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Minhas demonstrações</h1>
      <div className="rounded-2xl bg-gradient-to-br from-[#1f2226] to-black p-4 text-white">
        <p className="font-heading text-base font-bold"><i className="ri-user-star-fill mr-1 text-primary-400"></i>Seus alunos aprendem com você</p>
        <p className="mt-1 text-xs text-white/70">Grave você fazendo cada exercício (até 10 s). No treino, o aluno vê o seu vídeo como a demonstração principal.</p>
        <p className="mt-2 text-sm font-semibold" data-testid="demos-contagem">{feitas.length} de {EXERCICIOS.length} exercícios gravados</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-primary-500" style={{ width: `${(feitas.length / EXERCICIOS.length) * 100}%` }}></div></div>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar exercício" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-sm" aria-label="Buscar exercício" />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['todos', ...Object.keys(GRUPOS)] as (Grupo | 'todos')[]).map((g) => (
          <button key={g} type="button" onClick={() => setGrupo(g)} aria-pressed={grupo === g} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${grupo === g ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200 text-foreground-600'}`}>{g === 'todos' ? 'Todos' : GRUPOS[g]}</button>
        ))}
      </div>
      <ul className="divide-y divide-background-200 rounded-2xl border border-background-200 bg-background-50">
        {lista.map((e) => {
          const ok = feitas.includes(e.id);
          return (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <i className={`${ok ? 'ri-checkbox-circle-fill text-green-600' : 'ri-checkbox-blank-circle-line text-foreground-300'} text-xl`}></i>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground-900">{e.nome}</p>
                <p className="text-[11px] text-foreground-500">{GRUPOS[e.grupo]}{ok ? ' · gravado' : ''}</p>
              </div>
              {ok && <button type="button" onClick={() => void ver(e.id, e.nome)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-600" aria-label={`Ver ${e.nome}`}><i className="ri-play-circle-line text-lg"></i></button>}
              <button type="button" onClick={() => setGravando({ id: e.id, nome: e.nome })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${ok ? 'border border-background-200 text-foreground-700' : 'bg-primary-500 text-white'}`} data-testid={`demo-gravar-${e.id}`}>{ok ? 'Regravar' : 'Gravar'}</button>
            </li>
          );
        })}
      </ul>
      {gravando && (
        <GravadorVideo
          titulo={`Sua execução: ${gravando.nome}`}
          onFechar={() => setGravando(null)}
          onEnviar={async (v) => {
            await chatApi({ acao: 'demo_salvar', exercicio: gravando.id, video: v });
            demosCoach.set(gravando.id, v);
            setFeitas((f) => [...f.filter((x) => x !== gravando.id), gravando.id]);
          }}
        />
      )}
      {vendo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setVendo(null)} role="dialog" aria-modal="true" aria-label={vendo.nome}>
          <div className="w-full max-w-sm rounded-2xl bg-background-50 p-3" onClick={(ev) => ev.stopPropagation()}>
            <p className="mb-2 font-heading text-base font-bold text-foreground-950">{vendo.nome}</p>
            <video src={vendo.video} autoPlay muted loop playsInline controls className="w-full rounded-xl bg-black" />
            <button type="button" onClick={() => setVendo(null)} className="mt-3 w-full rounded-xl bg-primary-500 py-2 text-sm font-semibold text-white">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
