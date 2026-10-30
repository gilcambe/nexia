import React, { useState, useEffect } from 'react';

const EscadaCard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cortexProgress, setCortexProgress] = useState(0);
  const [gratisProgress, setGratisProgress] = useState(0);
  const [claudeProgress, setClaudeProgress] = useState(0);
  const [filaPedidos, setFilaPedidos] = useState(0);
  const [julesHoje, setJulesHoje] = useState(0);
  const [faseB, setFaseB] = useState(false);

  useEffect(() => {
    const loadEscadaData = async () => {
      try {
        const response = await fetch('/api/escada');
        if (!response.ok) {
          throw new Error('Erro ao buscar dados da escada');
        }
        
        const data = await response.json();
        
        // Atualizar os dados recebidos
        setCortexProgress(data.semana?.cortex || 0);
        setGratisProgress(data.semana?.iasGratis || 0);
        setClaudeProgress(data.semana?.claude || 0);
        setFilaPedidos(data.filaPedidos || 0);
        setJulesHoje(data.julesHoje || 0);
        setFaseB(data.faseB || false);
        
      } catch (error) {
        console.error('Erro ao carregar dados da escada:', error);
        setError('Erro ao carregar dados da escada');
      } finally {
        setLoading(false);
      }
    };

    loadEscadaData();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">🪜 Escada</h3>
        {faseB && (
          <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Pronto para fase B
          </div>
        )}
      </div>
      
      {/* Barras de progresso da semana */}
      <div className="space-y-3 mb-6">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Cortex</span>
            <span>{cortexProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${cortexProgress}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>IAs grátis</span>
            <span>{gratisProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${gratisProgress}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Claude</span>
            <span>{claudeProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${claudeProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Números da fila e Jules hoje */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Fila de pedidos</div>
          <div className="text-2xl font-bold text-gray-800">{filaPedidos}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Jules hoje</div>
          <div className="text-2xl font-bold text-gray-800">{julesHoje}/15</div>
        </div>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="text-center py-4 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default EscadaCard;