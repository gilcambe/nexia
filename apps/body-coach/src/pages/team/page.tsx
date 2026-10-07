import { useState } from 'react';
import { perguntar, type Papel } from '@/lib/coachAI';
import { getUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';

// Função para sanitizar texto para exibição em HTML
const sanitizeText = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export default function Team() {
  const { user, profile, loading } = useAuth();
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [papel, setPapel] = useState<Papel>('coach'); // Default válido para Papel ('coach' | 'nutrologo' | 'personal' | 'fisioterapeuta')
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePerguntar = async () => {
    if (!user || !profile || !pergunta.trim()) {
      setError('Por favor, faça uma pergunta.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResposta('');

    try {
      const userData = await getUserDoc(user.id, 'profile', 'profile');
      const contexto = JSON.stringify({
        age: userData?.age,
        gender: userData?.gender,
        weight: userData?.weight,
        height: userData?.height,
        goals: userData?.goals,
      });

      const res = await perguntar(papel, pergunta, contexto);
      setResposta(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-bold text-foreground-950">Equipe</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground-600">Carregando informações do usuário...</p>
        </header>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-bold text-foreground-950">Equipe</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground-600">
            Você precisa estar logado e ter um perfil para interagir com o Coach AI.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Seu Coach AI</h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground-600">
          Faça perguntas ao seu coach virtual e obtenha respostas baseadas nos seus dados.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="papel-select" className="block text-sm font-medium text-foreground-700">
            Selecione o papel do Coach:
          </label>
          <select
            id="papel-select"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            disabled={isLoading}
          >
            <option value="coach">Coach</option>
            <option value="nutrologo">Nutrólogo</option>
            <option value="personal">Personal</option>
            <option value="fisioterapeuta">Fisioterapeuta</option>
          </select>
        </div>

        <div>
          <label htmlFor="pergunta-input" className="block text-sm font-medium text-foreground-700">
            Sua pergunta:
          </label>
          <textarea
            id="pergunta-input"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex: Quais alimentos devo comer para ganhar massa muscular?"
            disabled={isLoading}
          ></textarea>
        </div>

        <button
          onClick={handlePerguntar}
          disabled={isLoading || !pergunta.trim()}
          className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Enviando...' : 'Perguntar ao Coach'}
        </button>

        {error && (
          <div className="rounded-md bg-red-50 p-4" aria-live="polite">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="ri-error-warning-line text-red-400" aria-hidden="true"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erro:</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{sanitizeText(error)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {resposta && (
          <div className="rounded-md bg-green-50 p-4" aria-live="polite">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="ri-check-line text-green-400" aria-hidden="true"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Resposta do Coach:</h3>
                <div className="mt-2 text-sm text-green-700 whitespace-pre-wrap">
                  <p>{sanitizeText(resposta)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
