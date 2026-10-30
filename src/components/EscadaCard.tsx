import React, { useState, useEffect } from 'react';

interface EscadaData {
  semana: {
    cortex: number;
    iasGratis: number;
    claude: number;
  };
  filaPedidos: number;
  julesHoje: number;
  faseB: boolean;
}

const EscadaCard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EscadaData>({
    semana: {
      cortex: 0,
      iasGratis: 0,
      claude: 0,
    },
    filaPedidos: 0,
    julesHoje: 0,
    faseB: false,
  });

  useEffect(() => {
    loadEscadaData();
  }, []);

  const loadEscadaData = async () => {
    try {
      const response = await fetch('/escada');
      if (!response.ok) {
        throw new Error('Erro ao buscar dados da escada');
      }
      
      const result: EscadaData = await response.json();
      setData(result);
      
    } catch (err) {
      console.error('Erro ao carregar dados da escada:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-6 border border-gray-200" 
      data-testid="escada-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">🪜 Escada</h3>
        {data.faseB && (
          <div 
            className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded"
            data-testid="fase-b-selo"
          >
            Pronto para fase B
          </div>
        )}
      </div>
      
      {/* Barras de progresso da semana */}
      <div className="space-y-3 mb-6">
        <div data-testid="barra-cortex">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Cortex</span>
            <span>{data.semana.cortex}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${data.semana.cortex}%` }}
              data-testid="progresso-cortex"
            ></div>
          </div>
        </div>
        
        <div data-testid="barra-ias-gratis">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>IAs grátis</span>
            <span>{data.semana.iasGratis}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${data.semana.iasGratis}%` }}
              data-testid="progresso-ias-gratis"
            ></div>
          </div>
        </div>
        
        <div data-testid="barra-claude">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Claude</span>
            <span>{data.semana.claude}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${data.semana.claude}%` }}
              data-testid="progresso-claude"
            ></div>
          </div>
        </div>
      </div>
      
      {/* Números da fila e Jules hoje */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div 
          className="bg-gray-50 rounded-lg p-3" 
          data-testid="fila-pedidos"
        >
          <div className="text-xs text-gray-500 mb-1">Fila de pedidos</div>
          <div className="text-2xl font-bold text-gray-800">{data.filaPedidos}</div>
        </div>
        <div 
          className="bg-gray-50 rounded-lg p-3" 
          data-testid="jules-hoje"
        >
          <div className="text-xs text-gray-500 mb-1">Jules hoje</div>
          <div className="text-2xl font-bold text-gray-800">{data.julesHoje}/15</div>
        </div>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-4" data-testid="loading">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="text-center py-4 text-red-600 text-sm" data-testid="error">
          Erro ao carregar dados da escada
        </div>
      )}
    </div>
  );
};

export default EscadaCard;