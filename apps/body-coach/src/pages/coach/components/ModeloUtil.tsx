import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarModelos, salvarModelo, verModelo, type ModeloResumo } from '@/lib/coach/equipe';
import type { FichaCoach } from '@/lib/coach/fichaCoach';
import type { Plano } from './DietaEditor';

// Lista os modelos do coach para começar a ficha/dieta de um aluno a partir de um deles.
export function UsarModelo({ tipo, onUsar }: { tipo: 'ficha' | 'dieta'; onUsar: (dados: FichaCoach | Plano, nome: string) => void }) {
  const [lista, setLista] = useState<ModeloResumo[] | null>(null);
  const [abrindo, setAbrindo] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => { listarModelos(tipo).then(setLista).catch(() => setLista([])); }, [tipo]);
  if (!lista || !lista.length) return null;
  return (
    <div className="rounded-2xl border border-accent-200 bg-accent-50 p-4" data-testid="usar-modelo">
      <h3 className="font-heading text-base font-bold text-foreground-950"><i className="ri-stack-line mr-1 text-accent-700"></i>Usar um modelo seu</h3>
      <ul className="mt-2 space-y-1.5">
        {lista.map((m) => (
          <li key={m.id}>
            <button type="button" disabled={!!abrindo} onClick={async () => {
              setAbrindo(m.id); setErro('');
              try { const x = await verModelo(m.id); onUsar(x.dados, x.nome); } catch (e) { setErro((e as Error).message); } finally { setAbrindo(''); }
            }} className="flex w-full items-center justify-between rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-left text-sm">
              <span><span className="font-semibold text-foreground-900">{m.nome}</span><span className="block text-[11px] text-foreground-500">{m.resumo}</span></span>
              <i className={abrindo === m.id ? 'ri-loader-4-line animate-spin' : 'ri-arrow-right-s-line text-lg text-accent-700'}></i>
            </button>
          </li>
        ))}
      </ul>
      {erro && <p role="alert" className="mt-2 text-xs text-red-600">{erro}</p>}
    </div>
  );
}

// "Salvar como modelo": guarda o que está no editor para aplicar em outros alunos depois.
export function SalvarComoModelo({ tipo, dados, nomePadrao }: { tipo: 'ficha' | 'dieta'; dados: FichaCoach | Plano; nomePadrao: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomePadrao);
  const [estado, setEstado] = useState<'' | 'salvando' | 'ok'>('');
  const [erro, setErro] = useState('');
  if (!aberto) {
    return (
      <button type="button" onClick={() => { setAberto(true); setEstado(''); setNome(nomePadrao); }} className="w-full rounded-xl border border-dashed border-accent-300 px-3 py-2 text-xs font-semibold text-accent-800">
        <i className="ri-stack-line mr-1"></i>Salvar como modelo (para usar em outros alunos)
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-accent-200 bg-accent-50 p-3" data-testid="salvar-modelo">
      {estado === 'ok' ? (
        <p role="status" className="text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>Modelo “{nome}” salvo. Aplique em vários alunos em <Link to="/coach/modelos" className="underline">Modelos</Link>.</p>
      ) : (
        <>
          <label className="block text-xs font-semibold text-foreground-700">Nome do modelo
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-2.5 py-2 text-sm" />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={estado === 'salvando' || nome.trim().length < 2} onClick={async () => {
              setEstado('salvando'); setErro('');
              try { await salvarModelo(tipo, nome.trim(), dados); setEstado('ok'); } catch (e) { setErro((e as Error).message); setEstado(''); }
            }} className="flex-1 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{estado === 'salvando' ? 'Salvando...' : 'Salvar modelo'}</button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-background-200 px-3 py-2 text-xs font-semibold text-foreground-600">Cancelar</button>
          </div>
          {erro && <p role="alert" className="mt-1 text-xs text-red-600">{erro}</p>}
        </>
      )}
    </div>
  );
}
