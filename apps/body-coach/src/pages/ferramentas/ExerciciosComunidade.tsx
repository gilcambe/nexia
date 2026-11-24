import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { confirmar } from '@/lib/dialogo';
import { GRUPOS_EX, apagarExercicio, linkComoFazer, listarExercicios, salvarExercicio, type ExercicioComunidade } from '@/lib/exerciciosComunidade';

const nomeGrupo = (g: string) => GRUPOS_EX.find((x) => x.id === g)?.nome ?? 'Outro';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Exercícios criados pelos usuários: todos veem; quem criou edita e apaga.
export default function ExerciciosComunidade() {
  const [lista, setLista] = useState<ExercicioComunidade[]>([]);
  const [eu, setEu] = useState('');
  const [busca, setBusca] = useState('');
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [form, setForm] = useState<{ id?: string; nome: string; grupo: string; como: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = (forcar = false) => {
    setEstado('carregando');
    listarExercicios(forcar).then((r) => { setLista(r.lista); setEu(r.eu); setEstado('ok'); }).catch(() => setEstado('erro'));
  };
  useEffect(() => { carregar(true); }, []);

  const vistos = useMemo(() => {
    const q = norm(busca.trim());
    return [...lista].filter((e) => !q || norm(e.nome).includes(q)).sort((a, b) => b.em - a.em);
  }, [lista, busca]);

  const salvar = async () => {
    if (!form || form.nome.trim().length < 2) { setErro('Escreva o nome do exercício.'); return; }
    setSalvando(true); setErro('');
    try {
      const r = await salvarExercicio(form);
      setLista(r.lista); setEu(r.eu); setForm(null);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.'); } finally { setSalvando(false); }
  };
  const apagar = async (e: ExercicioComunidade) => {
    if (!(await confirmar(`Apagar "${e.nome}" da lista de todos?`))) return;
    try { const r = await apagarExercicio(e.id); setLista(r.lista); } catch (x) { setErro(x instanceof Error ? x.message : 'Não consegui apagar agora.'); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-600">Exercícios que os usuários criaram. Todo mundo vê e pode usar no treino; quem criou pode editar e apagar.</p>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {form ? (
        <Card padding="p-4">
          <h3 className="font-heading text-base font-semibold text-foreground-950">{form.id ? 'Editar exercício' : 'Novo exercício'}</h3>
          <label className="mt-3 block text-sm font-semibold text-foreground-700">Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={60} aria-label="Nome do exercício" placeholder="Ex.: Remada cavalinho"
              className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-base font-normal outline-none focus:border-primary-400" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-foreground-700">Músculo
            <select value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })} aria-label="Músculo"
              className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-base font-normal">
              {GRUPOS_EX.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold text-foreground-700">Como fazer (opcional)
            <textarea value={form.como} onChange={(e) => setForm({ ...form, como: e.target.value })} maxLength={400} rows={3} aria-label="Como fazer"
              className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-sm font-normal outline-none focus:border-primary-400" />
          </label>
          {form.nome.trim().length >= 2 && <a href={linkComoFazer(form.nome)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary-600 underline"><i className="ri-search-line mr-1"></i>Procurar como fazer na internet</a>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setForm(null); setErro(''); }} className="rounded-xl border border-background-200 px-3 py-2.5 text-sm font-semibold text-foreground-700">Cancelar</button>
            <button type="button" onClick={() => void salvar()} disabled={salvando} className="rounded-xl bg-primary-500 px-3 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-60" data-testid="salvar-ex-comunidade">{salvando ? 'Salvando…' : 'Salvar para todos'}</button>
          </div>
        </Card>
      ) : (
        <button type="button" onClick={() => setForm({ nome: '', grupo: 'outro', como: '' })} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50"><i className="ri-add-line mr-1"></i>Criar exercício</button>
      )}

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar exercício" aria-label="Buscar exercício"
        className="w-full rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300" />

      {estado === 'carregando' && <p className="text-sm text-foreground-500">Carregando…</p>}
      {estado === 'erro' && <p className="text-sm text-foreground-600">Não consegui carregar agora. <button type="button" onClick={() => carregar(true)} className="font-semibold text-primary-600 underline">Tentar de novo</button></p>}
      {estado === 'ok' && !vistos.length && <p className="text-sm text-foreground-500">{busca ? 'Nenhum exercício com esse nome.' : 'Ainda não tem exercício da comunidade. Crie o primeiro!'}</p>}

      <ul className="space-y-2" data-testid="lista-ex-comunidade">
        {vistos.map((e) => (
          <li key={e.id} className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground-950">{e.nome}</p>
                <p className="text-xs text-foreground-500">{nomeGrupo(e.grupo)}{e.autorNome ? ` · por ${e.autorNome}` : ''}{e.autor === eu ? ' · seu' : ''}</p>
              </div>
              {e.autor === eu && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setForm({ id: e.id, nome: e.nome, grupo: e.grupo, como: e.como })} aria-label={`Editar ${e.nome}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"><i className="ri-edit-line"></i></button>
                  <button type="button" onClick={() => void apagar(e)} aria-label={`Apagar ${e.nome}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><i className="ri-delete-bin-line"></i></button>
                </span>
              )}
            </div>
            {e.como && <p className="mt-1 text-sm text-foreground-700">{e.como}</p>}
            <a href={linkComoFazer(e.nome)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-primary-600 underline">Ver como fazer</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
