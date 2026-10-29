import React, { useState, useEffect } from 'react';

interface EscadaData {
  cortex: number;
  iasGratis: number;
  claude: number;
  fila: number;
  faseB: boolean;
  julesHoje?: number;
}

const EscadaCard: React.FC = () => {
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

  useEffect(() => {
    const fetchEscadaData = async () => {
      try {
        const resposta = await fetch('/api/escada');
        if (!resposta.ok) throw new Error('Erro ao buscar dados da escada');
        const dados = await resposta.json();
        setEscadaData({
          cortex: dados.semana?.cortex ?? 0,
          iasGratis: dados.semana?.iasGratis ?? 0,
          claude: dados.semana?.claude ?? 0,
          fila: dados.fila ?? 0,
          faseB: dados.faseB ?? false
        });
        setJulesHoje(dados.julesHoje ?? 0);
        setLoading(false);
      } catch {
        setError(true);
        setLoading(false);
      }
    };

    fetchEscadaData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
          <div className="animate-pulse bg-gray-200 px-3 py-1 rounded-full text-sm font-medium w-32"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span className="bg-gray-200 h-4 w-20 rounded"></span>
                <span className="bg-gray-200 h-4 w-8 rounded"></span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gray-200 h-2 rounded-full w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🪜 Escada</h3>
        <p className="text-red-600 text-sm">Erro ao carregar dados da escada</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">🪜 Escada</h3>
        {escadaData.faseB && (
          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            Pronto para fase B
          </div>
        )}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Cortex</span>
            <span>{escadaData.cortex}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${escadaData.cortex}%` }}
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>IAs grátis</span>
            <span>{escadaData.iasGratis}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${escadaData.iasGratis}%` }}
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Claude</span>
            <span>{escadaData.claude}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${escadaData.claude}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-600">Fila</p>
          <p className="text-2xl font-bold text-gray-800">{escadaData.fila}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-600">Jules hoje</p>
          <p className="text-2xl font-bold text-gray-800">{julesHoje}/15</p>
        </div>
      </div>
    </div>
  );
};

export default EscadaCard;