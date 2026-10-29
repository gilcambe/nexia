import React, { useEffect, useState } from 'react';

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/escada');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      
      // Validação defensiva dos dados
      if (!json || typeof json !== 'object') throw new Error('Resposta inválida');
      
      setData({
        faseB: Boolean(json.faseB),
        fila: Number(json.fila) || 0,
        julesHoje: Number(json.julesHoje) || 0,
        semana: {
          cortex: Number(json.semana?.cortex) || 0,
          iasGratis: Number(json.semana?.iasGratis) || 0,
          claude: Number(json.semana?.claude) || 0,
        }
      });
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-nexia-surface2 text-sm text-nexia-muted flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-nexia-accent border-t-transparent rounded-full animate-spin"></div>
        Carregando dados da Escada...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 space-y-2">
        <p>Erro ao carregar Escada: {error || 'Dados indisponíveis'}</p>
        <button onClick={fetchData} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-semibold transition-colors">
          Tentar novamente
        </button>
      </div>
    );
  }

  const items = [
    { label: 'Cortex', percent: data.semana.cortex },
    { label: 'IAs grátis', percent: data.semana.iasGratis },
    { label: 'Claude', percent: data.semana.claude },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white text-base">🪜 Escada</h3>
        </div>
        {data.faseB && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            Pronto para fase B
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-xs text-nexia-muted font-medium">
              <span>{item.label}</span>
              <span>{item.percent}%</span>
            </div>
            <div className="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
              <div
                className="h-full bg-nexia-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                role="progressbar"
                aria-valuenow={item.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.label}: ${item.percent}%`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-nexia-border flex items-center justify-between text-sm">
        <div className="font-medium text-white">
          Fila: <span className="text-nexia-muted font-normal">{data.fila}</span>
        </div>
        <div className="font-medium text-white">
          Jules hoje <span className="text-nexia-muted font-normal">{data.julesHoje} / 15</span>
        </div>
      </div>
    </div>
  );
}
