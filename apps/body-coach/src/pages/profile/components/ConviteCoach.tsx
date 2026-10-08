import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { chatApi, type Contato } from '@/lib/chat';

// Perfil do coach: link próprio para convidar alunos. Cada aluno que abre o link entra na equipe deste coach.
export default function ConviteCoach() {
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<{ papel: 'coach' | 'aluno' | 'nenhum'; codigo?: string; alunos: Contato[] } | null>(null);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    try { const r = await chatApi<{ papel: 'coach' | 'aluno'; codigo?: string; contatos: Contato[] }>({ acao: 'contatos' }); setInfo({ papel: r.papel, codigo: r.codigo, alunos: r.contatos }); }
    catch { setInfo({ papel: 'nenhum', alunos: [] }); }
  };
  useEffect(() => { if (user) void carregar(); }, [user]);

  const virarCoach = async () => {
    setMsg('');
    try { await chatApi({ acao: 'perfil', papel: 'coach', nome: profile?.nickname || profile?.full_name || user?.email?.split('@')[0] || 'Coach', foto: profile?.photo_data ?? '' }); await carregar(); }
    catch (e) { setMsg((e as Error).message); }
  };

  if (!info) return null;
  const link = info.codigo ? `${window.location.origin}${import.meta.env.BASE_URL}convite/${info.codigo}` : '';
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setMsg('Link copiado! Cole no WhatsApp.'); } catch { setMsg('Não consegui copiar. Segure o link e copie.'); } };
  const compartilhar = async () => { try { await navigator.share({ title: 'Meu treino no Body Coach', text: 'Entre na minha equipe de treino:', url: link }); } catch { /* cancelou */ } };

  return (
    <Card padding="p-5">
      <div className="flex items-center gap-2"><i className="ri-group-line text-lg text-primary-500"></i><h2 className="font-heading text-base font-semibold text-foreground-950">Sou coach / personal</h2></div>
      {info.papel === 'coach' ? (
        <>
          <p className="mt-2 text-sm text-foreground-600">Envie este link para os seus alunos. Quem abrir entra na sua equipe e já fala com você. Cada aluno só vê a própria conversa.</p>
          <p className="mt-2 break-all rounded-lg border border-background-200 bg-background-100 px-3 py-2 text-xs text-foreground-800" aria-label="Seu link de convite">{link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void copiar()} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50"><i className="ri-file-copy-line mr-1"></i>Copiar link</button>
            {typeof navigator.share === 'function' && <button onClick={() => void compartilhar()} className="rounded-xl border border-primary-300 px-4 py-2 text-sm font-semibold text-primary-700"><i className="ri-share-line mr-1"></i>Compartilhar</button>}
            <Link to="/chat" className="rounded-xl border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700">Ver meus alunos ({info.alunos.length})</Link>
          </div>
          <p className="mt-2 text-xs text-foreground-500">Código: <strong>{info.codigo}</strong></p>
        </>
      ) : info.papel === 'aluno' && info.alunos.length ? (
        <p className="mt-2 text-sm text-foreground-600">Você já faz parte da equipe de {info.alunos[0].nome}. Para ser coach, peça um novo cadastro.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-foreground-600">Você treina outras pessoas? Ative o modo coach para ter um link de convite e conversar com cada aluno separadamente.</p>
          <button onClick={() => void virarCoach()} className="mt-3 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50">Ativar modo coach</button>
        </>
      )}
      {msg && <p role="status" className="mt-2 text-sm text-primary-700">{msg}</p>}
    </Card>
  );
}
