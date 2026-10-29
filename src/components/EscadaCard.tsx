import React, { useState, useEffect } from 'react';

interface EscadaData {
  faseB: boolean;
  fila: number;
  julesHoje: number;
  semana: {
    cortex: number;
    iasGratis: number;
    claude: number;
  };
}

export default function EscadaCard() {
  const [data, setData] = useState<EscadaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEscada = async () => {
    setLoading(true);
    setError(null);
    try {
      // Obtém o token de autenticação atual do localStorage (ou sessionStorage/cookies conforme padrão da Central)
      const token = localStorage.getItem('nexia_token') || localStorage.getItem('token') || '';
      
      // Validação básica do token (não vazio e formato esperado)
      if (!token || token.length < 10) {
        throw new Error('Sessão inválida. Por favor, faça login novamente.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      // Adiciona token se existir e for válido
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/escada', { 
        headers,
        // Adiciona headers CORS para garantir compatibilidade
        mode: 'cors',
        credentials: 'same-origin'
      });
      
      if (!res.ok) {
        // Tratamento genérico de erros para não expor detalhes sensíveis
        if (res.status === 401) {
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        } else if (res.status >= 500) {
          throw new Error('Serviço temporariamente indisponível. Tente novamente mais tarde.');
        } else {
          throw new Error('Não foi possível carregar os dados. Tente novamente.');
        }
      }
      
      const json = await res.json();
      setData(json);
    } catch (err) {
      // Mensagem genérica e segura para não expor detalhes internos
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscada();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-sm text-nexia-muted space-y-2">
        <div className="w-6 h-6 border-2 border-nexia-border border-t-blue-600 rounded-full animate-spin"></div>
        <p>Carregando dados da Escada...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm space-y-2">
        <p>{error || 'Não foi possível carregar os dados da Escada.'}</p>
        <button
          onClick={fetchEscada}
          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-semibold transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { faseB, fila, julesHoje, semana } = data;

  const items = [
    { label: 'Cortex', percent: semana?.cortex ?? 0 },
    { label: 'IAs grátis', percent: semana?.iasGratis ?? 0 },
    { label: 'Claude', percent: semana?.claude ?? 0 },
  ];

  return (
    <div className="space-y-4 p-4 rounded-xl bg-nexia-surface border border-nexia-border shadow-sm">
      {/* Header com título e selo condicional */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🪜</span>
          <span className="font-semibold text-white">Escada</span>
        </div>
        {faseB && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Pronto para fase B
          </span>
        )}
      </div>

      {/* Três barras de progresso da semana */}
      <div className="space-y-3">
        {items.map((item) => {
          const validPercent = Math.max(0, Math.min(100, Number(item.percent) || 0));
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs text-nexia-muted">
                <span>{item.label}</span>
                <span className="font-medium text-white">{validPercent}%</span>
              </div>
              <div className="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${validPercent}%` }}
                  role="progressbar"
                  aria-valuenow={validPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.label}: ${validPercent}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Números da fila e Jules hoje */}
      <div className="pt-2 border-t border-nexia-border flex items-center justify-between text-sm">
        <div className="text-nexia-muted">
          Fila: <span className="font-semibold text-white">{Number(fila) || 0}</span>
        </div>
        <div className="text-nexia-muted">
          Jules hoje <span className="font-semibold text-white">{Number(julesHoje) || 0}/15</span>
        </div>
      </div>
    </div>
  );
}
