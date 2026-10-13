import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/lib/chat';
import { esquecerPapel } from '@/lib/papelCoach';

// Primeira pergunta do cadastro: o tipo de conta decide quais telas a pessoa vê.
export default function EscolherPapel({ nome, onAluno }: { nome: string; onAluno: () => void }) {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [comCoach, setComCoach] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const escolher = async (tipo: 'coach' | 'aluno' | 'sozinho') => {
    setErro(''); setSalvando(true);
    try {
      await chatApi({ acao: 'perfil', papel: tipo === 'coach' ? 'coach' : 'aluno', nome });
      esquecerPapel();
      if (tipo === 'coach') { navigate('/coach/alunos', { replace: true }); return; }
      if (tipo === 'aluno') { try { localStorage.setItem('bc_convite', codigo.trim().toUpperCase()); } catch { /* sem armazenamento */ } }
      onAluno();
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };

  const opcao = 'w-full rounded-xl border border-background-200 bg-background-50 p-4 text-left';
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground-900">Como você vai usar o Body Coach?</h1>
      <p className="text-sm text-foreground-500">Escolha uma vez. O app mostra só o que é seu.</p>
      <button data-testid="papel-coach" disabled={salvando} onClick={() => void escolher('coach')} className={opcao}>
        <p className="font-semibold text-foreground-900">Sou personal / coach</p>
        <p className="text-sm text-foreground-500">Monto treino e dieta para meus alunos.</p>
      </button>
      <button data-testid="papel-aluno" disabled={salvando} onClick={() => setComCoach(true)} className={opcao}>
        <p className="font-semibold text-foreground-900">Tenho um personal</p>
        <p className="text-sm text-foreground-500">Meu coach me passou um código de convite.</p>
      </button>
      {comCoach && (
        <div className="flex gap-2">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código do convite" className="flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-3 text-base uppercase" />
          <button disabled={salvando || codigo.trim().length < 4} onClick={() => void escolher('aluno')} className="rounded-lg bg-primary-500 px-4 font-semibold text-white disabled:opacity-50">Entrar</button>
        </div>
      )}
      <button data-testid="papel-sozinho" disabled={salvando} onClick={() => void escolher('sozinho')} className={opcao}>
        <p className="font-semibold text-foreground-900">Vou treinar sozinho</p>
        <p className="text-sm text-foreground-500">Quero o app completo, sem coach.</p>
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
