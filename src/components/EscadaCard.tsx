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
    
    // Validar campos obrigatórios
    const required = ['faseB', 'fila', 'julesHoje', 'semana'];
    for (const key of required) {
      if (!(key in raw)) {
        throw new Error(`Campo obrigatório ausente: ${key}`);
      }
    }
    
    // Validar faseB
    if (typeof raw.faseB !== 'boolean') {
      throw new Error('faseB deve ser booleano');
    }
    
    // Validar números
    ['fila', 'julesHoje'].forEach(key => {
      const val = Number(raw[key]);
      if (isNaN(val) || val < 0) {
        throw new Error(`${key} deve ser número não negativo`);
      }
    });
    
    // Validar semana
    if (!raw.sema || typeof raw.semana !== 'object') {
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
        claude: sanitizeNumber(raw.sema.claude)
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
      // Reset para valores seguros
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
      <div className="escada-card error-state">
        <p>Erro ao carregar Escada: {error}</p>
        <button onClick={fetchData} className="retry-btn">Tentar novamente</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="escada-card loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando dados da Escada...</p>
      </div>
    );
  }

  return (
    <div className="escada-card">
      <div className="card-header">
        <h2>🪜 Escada</h2>
        {data.faseB && (
          <span className="fase-badge">Pronto para fase B</span>
        )}
      </div>

      <div className="progress-bars">
        {progressItems.map((item) => (
          <div key={item.label} className="progress-item">
            <div className="progress-label">{item.label}</div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${item.percent}%` }}
                role="progressbar"
                aria-valuenow={item.percent}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`${item.label}: ${item.percent}%`}
              >
                <span className="progress-text">{item.percent}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="queue-info">
        <div className="queue-item">Fila Cortex: {data.fila}</div>
        <div className="queue-item">Fila IAs grátis: {data.fila}</div>
        <div className="queue-item">Fila Claude: {data.fila}</div>
      </div>

      <div className="jules-info">
        Jules hoje {data.julesHoje} / 15
      </div>
    </div>
  );
};

export default EscadaCard;