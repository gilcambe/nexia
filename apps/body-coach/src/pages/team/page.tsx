import { useState } from 'react';
import { perguntar, type Papel } from '@/lib/coachAI';
import { getUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';

export default function Team() {
  const { user, profile, loading } = useAuth();
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [papel, setPapel] = useState<Papel>('coach');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePerguntar = async () => {
    if (!user || !pergunta.trim()) {
      setError('Por favor, digite uma pergunta.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResposta('');

    try {
      let contexto = '';
      try {
        const userData = await getUserDoc(user.id, 'profile');
        if (userData) {
          contexto = JSON.stringify(userData);
        }
      } catch (e) {
        // Ignora erro ao buscar contexto se não existir
      }

      const res = await perguntar(papel, pergunta, contexto);
      setResposta(res);
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro ao consultar o coach.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-foreground-600">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-foreground-600">
        Você precisa estar conectado para acessar a equipe de IA.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground-900">Equipe de IA</h1>
        <p className="text-sm text-foreground-600">
          Consulte nossa equipe de especialistas virtuais para tirar dúvidas sobre seus treinos, nutrição e saúde.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-700 mb-1">
              Especialista (Papel)
            </label>
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value as Papel)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isLoading}
            >
              <option value="coach">Coach</option>
              <option value="nutrologo">Nutrólogo</option>
              <option value="personal">Personal</option>
              <option value="fisioterapeuta">Fisioterapeuta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-700 mb-1">
              Sua pergunta
            </label>
            <textarea
              rows={4}
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Digite sua dúvida aqui..."
              className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handlePerguntar}
            disabled={isLoading || !pergunta.trim()}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition disabled:opacity-50 text-sm font-medium"
          >
            {isLoading ? 'Consultando especialista...' : 'Enviar Pergunta'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {resposta && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-2">
            <h3 className="text-sm font-semibold text-foreground-800">Resposta do Especialista:</h3>
            <p className="text-sm text-foreground-700 whitespace-pre-wrap">{resposta}</p>
          </div>
        )}
      </div>
    </div>
  );
}
