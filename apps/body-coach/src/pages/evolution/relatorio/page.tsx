import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { useProgressData } from '@/hooks/useProgressData';
import { evolucaoInfo } from '@/lib/avaliacao/coach';
import { POSES } from '@/lib/avaliacao/dados';
import { montarSerie } from '@/lib/avaliacao/serie';
import RelatorioView from './RelatorioView';
import Comentarios from './Comentarios';
import LinkSeguro from './LinkSeguro';

// Relatório de uma avaliação do próprio aluno.
export default function RelatorioAvaliacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLocalDemo } = useAuth();
  const { entries, loading, perfil } = useProgressData(user?.id);
  const serie = useMemo(() => montarSerie(entries, perfil), [entries, perfil]);
  const idx = serie.findIndex((s) => String(s.id) === id);
  const [coach, setCoach] = useState<{ uid: string; nome: string; foto: string } | null>(null);

  useEffect(() => {
    if (isLocalDemo) return;
    evolucaoInfo().then((r) => setCoach(r.coach)).catch(() => setCoach(null));
  }, [isLocalDemo]);

  if (loading) return <div className="p-8 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</div>;
  if (idx < 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-foreground-600">Avaliação não encontrada.</p>
        <button type="button" onClick={() => navigate('/evolution')} className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50">Voltar</button>
      </div>
    );
  }
  const item = serie[idx];
  return (
    <RelatorioView
      serie={serie}
      idx={idx}
      perfil={perfil}
      nome={perfil.nome ?? user?.email ?? 'Aluno'}
      avaliador={coach ? { nome: coach.nome, foto: coach.foto } : null}
      onVoltar={() => navigate('/evolution')}
      rodape={!isLocalDemo && (
        <div className="space-y-3">
          <LinkSeguro entrada={item.id} temFotos={POSES.some((p) => item.fotos[p.id])} />
          {coach && <Comentarios com={coach.uid} nomeOutro={coach.nome} entrada={item.id} data={item.data} meuUid={user?.id} />}
        </div>
      )}
    />
  );
}
