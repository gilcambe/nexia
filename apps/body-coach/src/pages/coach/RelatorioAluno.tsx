import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { chatApi } from '@/lib/chat';
import RelatorioView, { type Avaliador } from '../evolution/relatorio/RelatorioView';
import Comentarios from '../evolution/relatorio/Comentarios';
import { useAluno } from './useAluno';

// Relatório de uma avaliação do aluno com a marca do coach (nome e foto) e os comentários dos dois.
export default function RelatorioAluno() {
  const { uid, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dados, perfil, serie, erro } = useAluno(uid);
  const [eu, setEu] = useState<Avaliador | null>(null);

  useEffect(() => {
    chatApi<{ eu?: { nome: string; foto: string } }>({ acao: 'contatos' })
      .then((r) => setEu({ nome: r.eu?.nome || user?.email || 'Coach', foto: r.eu?.foto }))
      .catch(() => setEu(null));
  }, [user?.email]);

  const voltar = () => navigate(`/coach/evolucao/${uid}?aba=avaliacoes`);
  if (erro) return <div className="p-8 text-center text-sm text-red-600">{erro}</div>;
  if (!dados) return <div className="p-8 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</div>;
  const idx = serie.findIndex((s) => String(s.id) === id);
  if (idx < 0) return <div className="p-8 text-center text-sm text-foreground-600">Avaliação não encontrada. <button type="button" onClick={voltar} className="font-semibold text-primary-600">Voltar</button></div>;
  const item = serie[idx];
  return (
    <RelatorioView
      serie={serie}
      idx={idx}
      perfil={perfil}
      nome={dados.nome}
      avaliador={eu}
      onVoltar={voltar}
      acoes={<span />}
      rodape={uid && <Comentarios com={uid} nomeOutro={dados.nome} entrada={item.id} data={item.data} meuUid={user?.id} />}
    />
  );
}
