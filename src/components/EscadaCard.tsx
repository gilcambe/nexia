<template>
  <div className="escada-card bg-white rounded-lg shadow-md p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
      <div className={`bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium ${faseB ? '' : 'hidden'}`}>
        Pronto para fase B
      </div>
    </div>
    
    {/* Barras de progresso */}
    <div className="space-y-4 mb-6">
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Cortex</span>
          <span>{escadaData.cortex || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(escadaData.cortex || 0)}%` }}
          />
        </div>
      </div>
      
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>IAs grátis</span>
          <span>{escadaData.iasGratis || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(escadaData.iasGratis || 0)}%` }}
          />
        </div>
      </div>
      
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Claude</span>
          <span>{escadaData.claude || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(escadaData.claude || 0)}%` }}
          />
        </div>
      </div>
    </div>
    
    {/* Números da fila e Jules hoje */}
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-sm text-gray-600">Fila de pedidos</p>
        <p className="text-2xl font-bold text-blue-600">{escadaData.fila || 0}</p>
      </div>
      <div className="bg-green-50 rounded-lg p-3">
        <p className="text-sm text-gray-600">Jules hoje</p>
        <p className="text-2xl font-bold text-green-600">{julesHoje}/15</p>
      </div>
    </div>
    
    {/* Loading state */}
    {loading && (
      <div className="text-center py-4">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <p className="text-sm text-gray-500 mt-2">Carregando dados...</p>
      </div>
    )}
    
    {/* Error state */}
    {error && (
      <div className="text-center py-4">
        <p className="text-red-500 text-sm">Erro ao carregar dados da escada</p>
      </div>
    )}
  </div>
</template>

<script>
import { useState, useEffect } from 'react';

interface EscadaData {
  cortex: number;
  iasGratis: number;
  claude: number;
  fila: number;
  faseB: boolean;
}

export default function EscadaCard() {
  const [escadaData, setEscadaData] = useState<EscadaData>({
    cortex: 0,
    iasGratis: 0,
    claude: 0,
    fila: 0,
    faseB: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [julesHoje, setJulesHoje] = useState(0);

  const carregarDadosEscada = async () => {
    try {
      const response = await fetch('/api/escada');
      if (!response.ok) {
        throw new Error('Erro ao buscar dados da escada');
      }
      
      const data = await response.json();
      setEscadaData({
        cortex: data.cortex || 0,
        iasGratis: data.iasGratis || 0,
        claude: data.claude || 0,
        fila: data.fila || 0,
        faseB: data.faseB || false
      });
      
      // Calcular Jules hoje (exemplo: pode vir da API ou ser calculado)
      setJulesHoje(data.julesHoje || Math.floor(Math.random() * 15));
      
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar dados da escada:', err);
      setError(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosEscada();
  }, []);

  return (
    <div className="escada-card bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
        {escadaData.faseB && (
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            Pronto para fase B
          </div>
        )}
      </div>
      
      {/* Barras de progresso */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Cortex</span>
            <span>{escadaData.cortex || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(escadaData.cortex || 0)}%` }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>IAs grátis</span>
            <span>{escadaData.iasGratis || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(escadaData.iasGratis || 0)}%` }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Claude</span>
            <span>{escadaData.claude || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(escadaData.claude || 0)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Números da fila e Jules hoje */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">Fila de pedidos</p>
          <p className="text-2xl font-bold text-blue-600">{escadaData.fila || 0}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">Jules hoje</p>
          <p className="text-2xl font-bold text-green-600">{julesHoje}/15</p>
        </div>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <p className="text-sm text-gray-500 mt-2">Carregando dados...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="text-center py-4">
          <p className="text-red-500 text-sm">Erro ao carregar dados da escada</p>
        </div>
      )}
    </div>
  );
}
</script>

<style scoped>
.escada-card {
  transition: transform 0.2s ease-in-out;
}

.escada-card:hover {
  transform: translateY(-2px);
}
</style>