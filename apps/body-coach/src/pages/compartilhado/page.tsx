import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verCompartilhado, type PerfilServidor } from '@/lib/avaliacao/coach';
import { montarSerie } from '@/lib/avaliacao/serie';
import type { ProgressEntry } from '@/hooks/useProgressData';
import RelatorioView from '../evolution/relatorio/RelatorioView';

// Relatório aberto pelo link seguro (sem login). Mostra só esta avaliação e a anterior para comparação.
export default function Compartilhado() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<{ entradas: ProgressEntry[]; perfil: PerfilServidor; expira: number } | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    verCompartilhado(token).then(setDados).catch((e: Error) => setErro(e.message));
  }, [token]);
  const serie = useMemo(() => (dados ? montarSerie(dados.entradas, dados.perfil) : []), [dados]);

  if (erro) return <div className="p-8 text-center text-sm text-foreground-600"><i className="ri-link-unlink mb-2 block text-3xl text-foreground-400"></i>{erro}</div>;
  if (!dados || !serie.length) return <div className="p-8 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Abrindo a avaliação...</div>;
  return (
    <RelatorioView
      serie={serie}
      idx={serie.length - 1}
      perfil={dados.perfil}
      nome={dados.perfil.nome ?? 'Aluno'}
      acoes={<span className="text-xs text-foreground-500">Link vence em {new Date(dados.expira).toLocaleDateString('pt-BR')}</span>}
    />
  );
}
