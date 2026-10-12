import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apagarModelo, aplicarModelo, listarModelos, type ModeloResumo } from '@/lib/coach/equipe';
import { painelAlunos, type LinhaAluno } from '@/lib/coach/alunos';

// Modelos do coach: fichas e dietas prontas que ele aplica em vários alunos de uma vez.
export default function Modelos() {
  const [tipo, setTipo] = useState<'ficha' | 'dieta'>('ficha');
  const [lista, setLista] = useState<ModeloResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [aplicando, setAplicando] = useState<ModeloResumo | null>(null);

  const carregar = () => listarModelos().then(setLista).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);
  const doTipo = (lista ?? []).filter((m) => m.tipo === tipo);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/coach/alunos" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Meus alunos</Link>
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Modelos</h1>
        <p className="mt-1 text-sm text-foreground-600">Monte uma vez e aplique em vários alunos. Cada aluno recebe a cópia no app e um aviso na conversa; depois você ainda ajusta a de cada um.</p>
      </header>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-background-100 p-1" role="tablist">
        {([['ficha', 'Fichas de treino'], ['dieta', 'Dietas']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => { setTipo(id); setOk(''); }} className={`rounded-lg py-2 text-sm font-semibold ${tipo === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{l}</button>
        ))}
      </div>
      {ok && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{ok}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {lista == null && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}

      <Link to={`/coach/modelos/nova-${tipo}`} className="block w-full rounded-xl bg-primary-500 px-4 py-3 text-center text-sm font-semibold text-background-50 dark:text-foreground-950">
        <i className="ri-add-line mr-1"></i>{tipo === 'ficha' ? 'Nova ficha modelo' : 'Nova dieta modelo'}
      </Link>
      {lista && doTipo.length === 0 && <p className="text-center text-sm text-foreground-500">Nenhum modelo ainda. Crie aqui ou use “Salvar como modelo” na ficha de um aluno.</p>}
      <ul className="space-y-3">
        {doTipo.map((m) => (
          <li key={m.id} className="rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="modelo">
            <p className="font-semibold text-foreground-950">{m.nome}</p>
            <p className="text-xs text-foreground-500">{m.resumo}{m.usos ? ` · usado ${m.usos}×` : ''}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => { setAplicando(m); setOk(''); }} className="rounded-lg bg-primary-500 px-2 py-2 text-xs font-semibold text-background-50 dark:text-foreground-950">Aplicar</button>
              <Link to={`/coach/modelos/${m.id}`} className="rounded-lg border border-background-200 px-2 py-2 text-center text-xs font-semibold text-foreground-700">Editar</Link>
              <button type="button" onClick={async () => {
                if (!window.confirm(`Apagar o modelo “${m.nome}”? Quem já recebeu continua com a cópia.`)) return;
                try { await apagarModelo(m.id); setLista((l) => (l ?? []).filter((x) => x.id !== m.id)); } catch (e) { setErro((e as Error).message); }
              }} className="rounded-lg border border-red-200 px-2 py-2 text-xs font-semibold text-red-600">Apagar</button>
            </div>
          </li>
        ))}
      </ul>
      {aplicando && <Aplicar modelo={aplicando} onFechar={(msg) => { setAplicando(null); if (msg) { setOk(msg); void carregar(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} />}
    </div>
  );
}

function Aplicar({ modelo, onFechar }: { modelo: ModeloResumo; onFechar: (msg?: string) => void }) {
  const [alunos, setAlunos] = useState<LinhaAluno[] | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { painelAlunos().then((p) => setAlunos(p.alunos)).catch((e: Error) => setErro(e.message)); }, []);
  const tem = (a: LinhaAluno) => (modelo.tipo === 'ficha' ? a.temFicha : a.temDieta);
  const alternar = (id: string) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-label="Aplicar modelo">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-background-50 p-4 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground-950">Aplicar “{modelo.nome}”</h3>
          <button type="button" onClick={() => onFechar()} aria-label="Fechar" className="rounded-lg p-1 text-foreground-500"><i className="ri-close-line text-xl"></i></button>
        </div>
        {alunos && alunos.length > 0 && (
          <div className="mt-2 flex gap-2 text-xs">
            <button type="button" onClick={() => setMarcados(alunos.map((a) => a.uid))} className="font-semibold text-primary-700">Marcar todos</button>
            <button type="button" onClick={() => setMarcados(alunos.filter((a) => !tem(a)).map((a) => a.uid))} className="font-semibold text-primary-700">Só quem não tem {modelo.tipo === 'ficha' ? 'ficha' : 'dieta'}</button>
            <button type="button" onClick={() => setMarcados([])} className="font-semibold text-foreground-500">Limpar</button>
          </div>
        )}
        <ul className="mt-2 flex-1 space-y-1.5 overflow-y-auto">
          {alunos == null && !erro && <li className="text-sm text-foreground-500">Carregando alunos...</li>}
          {alunos?.length === 0 && <li className="text-sm text-foreground-500">Você ainda não tem alunos.</li>}
          {alunos?.map((a) => (
            <li key={a.uid}>
              <label className="flex items-center gap-3 rounded-xl border border-background-200 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={marcados.includes(a.uid)} onChange={() => alternar(a.uid)} className="h-4 w-4 accent-primary-500" aria-label={a.nome} />
                <span className="flex-1 font-medium text-foreground-900">{a.nome}</span>
                {tem(a) && <span className="text-xs text-secondary-800">já tem: será trocada</span>}
              </label>
            </li>
          ))}
        </ul>
        {erro && <p role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
        <button type="button" disabled={enviando || !marcados.length} onClick={async () => {
          setEnviando(true); setErro('');
          try {
            const r = await aplicarModelo(modelo.id, marcados);
            onFechar(`“${modelo.nome}” enviado para ${r.aplicados} aluno${r.aplicados === 1 ? '' : 's'}. Cada um recebeu um aviso na conversa.`);
          } catch (e) { setErro((e as Error).message); setEnviando(false); }
        }} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
          {enviando ? 'Enviando...' : `Enviar para ${marcados.length} aluno${marcados.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
