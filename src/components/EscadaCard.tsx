import { useState, useEffect } from 'react';

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

const EscadaCard = () => {
  const [data, setData] = useState<EscadaData>({
    faseB: false,
    fila: 0,
    julesHoje: 0,
    semana: {
      cortex: 0,
      iasGratis: 0,
      claude: 0
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sanitizeNumber = (val: any): number => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const validateData = (raw: any): EscadaData => {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Resposta inválida da API');
    }
    
    const required = ['faseB', 'fila', 'julesHoje', 'semana'];
    for (const key of required) {
      if (!(key in raw)) {
        throw new Error(`Campo obrigatório ausente: ${key}`);
      }
    }
    
    if (typeof raw.faseB !== 'boolean') {
      throw new Error('faseB deve ser booleano');
    }
    
    ['fila', 'julesHoje'].forEach(key => {
      const val = Number(raw[key]);
      if (isNaN(val) || val < 0) {
        throw new Error(`${key} deve ser número não negativo`);
      }
    });
    
    if (!raw.semana || typeof raw.semana !== 'object') {
      throw new Error('semana deve ser objeto');
    }
    
    ['cortex', 'iasGratis', 'claude'].forEach(key => {
      const val = Number(raw.semana[key]);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new Error(`semana.${key} deve ser número entre 0 e 100`);
      }
    });
    
    return {
      faseB: raw.faseB,
      fila: sanitizeNumber(raw.fila),
      julesHoje: sanitizeNumber(raw.julesHoje),
      semana: {
        cortex: sanitizeNumber(raw.semana.cortex),
        iasGratis: sanitizeNumber(raw.semana.iasGratis),
        claude: sanitizeNumber(raw.semana.claude)
      }
    };
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/escada');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const raw = await response.json();
      const validated = validateData(raw);
      setData(validated);
    } catch (err) {
      console.error('[EscadaCard] Erro ao buscar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setData({
        faseB: false,
        fila: 0,
        julesHoje: 0,
        semana: {
          cortex: 0,
          iasGratis: 0,
          claude: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const progressItems = [
    { label: 'Cortex', percent: data.semana.cortex },
    { label: 'IAs grátis', percent: data.semana.iasGratis },
    { label: 'Claude', percent: data.semana.claude }
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
        <p className="text-sm">Erro ao carregar Escada: {error}</p>
        <button onClick={fetchData} className="mt-2 text-xs font-semibold underline hover:opacity-80">Tentar novamente</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-nexia-border bg-nexia-surface p-4 shadow-sm flex flex-col items-center justify-center gap-2 min-h-[140px]">
        <div className="w-6 h-6 border-2 border-nexia-border border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-xs text-nexia-muted">Carregando dados da Escada...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-nexia-border bg-nexia-surface p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">🪜 Escada</h3>
        {data.faseB && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            Pronto para fase B
          </span>
        )}
      </div>

      <div className="space-y-3">
        {progressItems.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-nexia-muted">
              <span>{item.label}</span>
              <span>{item.percent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-nexia-surface2 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${item.percent}%` }}
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

      <div className="pt-2 border-t border-nexia-border/50 flex items-center justify-between text-sm text-nexia-muted">
        <div>Fila: <span className="font-semibold text-white">{data.fila}</span></div>
        <div>Jules hoje <span className="font-semibold text-white">{data.julesHoje} / 15</span></div>
      </div>
    </div>
  );
};

export default EscadaCard;
