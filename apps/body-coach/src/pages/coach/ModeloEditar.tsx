import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { salvarModelo, verModelo } from '@/lib/coach/equipe';
import type { FichaCoach } from '@/lib/coach/fichaCoach';
import FichaEditor from './components/FichaEditor';
import DietaEditor, { type Plano } from './components/DietaEditor';
import ExportarPlano from '@/components/feature/ExportarPlano';

// Criar ou editar um modelo (sem aluno): os mesmos editores da ficha e da dieta.
export default function ModeloEditar() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const novo = id === 'nova-ficha' || id === 'nova-dieta';
  const [tipo, setTipo] = useState<'ficha' | 'dieta' | null>(novo ? (id === 'nova-ficha' ? 'ficha' : 'dieta') : null);
  const [dados, setDados] = useState<FichaCoach | Plano | null>(null);
  const [nome, setNome] = useState(id === 'nova-dieta' ? 'Dieta modelo' : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (novo) return;
    verModelo(id).then((m) => { setTipo(m.tipo); setDados(m.dados); setNome(m.nome); }).catch((e: Error) => setErro(e.message));
  }, [id, novo]);

  const salvar = async (t: 'ficha' | 'dieta', d: FichaCoach | Plano) => {
    setSalvando(true); setErro('');
    try {
      await salvarModelo(t, t === 'ficha' ? (nome.trim() || (d as FichaCoach).nome) : nome.trim() || 'Dieta modelo', d, novo ? undefined : id);
      navigate('/coach/modelos');
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/coach/modelos" className="text-sm font-semibold text-primary-600"><i className="ri-arrow-left-line mr-1"></i>Modelos</Link>
      <h1 className="font-heading text-2xl font-bold text-foreground-950">{novo ? (tipo === 'ficha' ? 'Nova ficha modelo' : 'Nova dieta modelo') : 'Editar modelo'}</h1>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {!tipo && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}
      {tipo && (novo || dados) && (
        <>
          <label className="block text-xs font-semibold text-foreground-600">Nome do modelo{tipo === 'ficha' ? ' (vazio = nome da ficha)' : ''}
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder={tipo === 'ficha' ? 'ex.: Iniciantes ABC' : 'ex.: Cutting 1800 kcal'} className="mt-1 w-full rounded-lg border border-background-200 bg-background-50 px-2.5 py-2 text-sm" aria-label="Nome do modelo" />
          </label>
          {tipo === 'ficha' ? (
            <FichaEditor nomeAluno="" respostas={{}} inicial={(dados as FichaCoach) ?? null} salvando={salvando} rotuloEnviar="Salvar modelo" podeRemover={false}
              onSalvar={(f) => void salvar('ficha', f)} onRemover={() => undefined} extraRodape={(f) => <ExportarPlano ficha={f} />} />
          ) : (
            <DietaEditor nomeAluno="" inicial={(dados as Plano) ?? null} salvando={salvando} rotuloEnviar="Salvar modelo" podeRemover={false}
              onSalvar={(d) => void salvar('dieta', d)} onRemover={() => undefined} extraRodape={(d) => <ExportarPlano plano={d} />} />
          )}
        </>
      )}
    </div>
  );
}
