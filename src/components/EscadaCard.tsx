import { useState, useEffect } from 'react';

interface EscadaData {
  semana: {
    cortex: number;
    iasGratis: number;
    claude: number;
  };
  fila: number;
  faseB: boolean;
  julesHoje: number;
}

export default function EscadaCard() {
  const [data, setData] = useState<EscadaData>({
    semana: {
      cortex: 0,
      iasGratis: 0,
      claude: 0
    },
    fila: 0,
    faseB: false,
    julesHoje: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const response = await fetch('/api/escada');
        if (!response.ok) {
          throw new Error('Erro ao buscar dados da escada');
        }
        const dados = await response.json();
        setData({
          semana: {
            cortex: dados.semana?.cortex || 0,
            iasGratis: dados.semana?.iasGratis || 0,
            claude: dados.semana?.claude || 0
          },
          fila: dados.fila || 0,
          faseB: dados.faseB || false,
          julesHoje: dados.julesHoje || 0
        });
      } catch (err) {
        setError(true);
        console.error('Erro ao carregar dados da escada:', err);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
        </div>
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <p className="text-sm text-gray-500 mt-2">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-red-500 text-sm">Erro ao carregar dados da escada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
        {data.faseB && (
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            Pronto para fase B
          </div>
        )}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Cortex</span>
            <span>{data.semana.cortex}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${data.semana.cortex}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>IAs grátis</span>
            <span>{data.semana.iasGratis}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${data.semana.iasGratis}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Claude</span>
            <span>{data.semana.claude}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${data.semana.claude}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">Fila de pedidos</p>
          <p className="text-2xl font-bold text-blue-600">{data.fila}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">Jules hoje</p>
          <p className="text-2xl font-bold text-green-600">{data.julesHoje}/15</p>
        </div>
      </div>
    </div>
  );
}