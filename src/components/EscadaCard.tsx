import React, { useState, useEffect } from 'react';

interface EscadaData {
  cortex: number;
  gratis: number;
  claude: number;
  filaPedidos: number;
  julesHoje: number;
  faseB: boolean;
}

const EscadaCard: React.FC = () => {
  const [escadaData, setEscadaData] = useState<EscadaData>({
    cortex: 0,
    gratis: 0,
    claude: 0,
    filaPedidos: 0,
    julesHoje: 0,
    faseB: false
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const token = localStorage.getItem('nexia_token') || sessionStorage.getItem('nexia_token') || '';
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/escada', { headers });
        
        if (!response.ok) {
          throw new Error('Erro ao buscar dados da escada');
        }
        
        const data = await response.json();
        
        const semana = data.semana || data;
        const fila = semana.filaPedidos !== undefined ? semana.filaPedidos : (semana.filaAtual !== undefined ? semana.filaAtual : (data.fila || 0));
        
        setEscadaData({
          cortex: Number(semana.cortex ?? data.cortex ?? 0),
          gratis: Number(semana.gratis ?? semana.iasGratis ?? data.gratis ?? 0),
          claude: Number(semana.claude ?? data.claude ?? 0),
          filaPedidos: Number(fila),
          julesHoje: Number(semana.julesHoje ?? data.julesHoje ?? 0),
          faseB: Boolean(semana.faseB ?? data.faseB ?? false)
        });
        
      } catch (err) {
        console.error('Erro ao carregar dados da escada:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    carregar();
  }, []);

  if (loading) {
    return (
      <div className="escada-card">
        <div className="loading">
          <div className="spinner"></div>
          <span>Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="escada-card">
        <div className="error">
          Erro ao carregar dados da escada
        </div>
      </div>
    );
  }

  return (
    <div className="escada-card">
      <div className="card-header">
        <h3>🪜 Escada</h3>
        {escadaData.faseB && <div className="status-badge ready">Pronto para fase B</div>}
      </div>
      
      <div className="progress-section">
        <div className="progress-item">
          <div className="progress-info">
            <span className="progress-label">Cortex</span>
            <span className="progress-value">{escadaData.cortex}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill cortex" style={{ width: `${escadaData.cortex}%` }}></div>
          </div>
        </div>
        
        <div className="progress-item">
          <div className="progress-info">
            <span className="progress-label">IAs grátis</span>
            <span className="progress-value">{escadaData.gratis}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill gratis" style={{ width: `${escadaData.gratis}%` }}></div>
          </div>
        </div>
        
        <div className="progress-item">
          <div className="progress-info">
            <span className="progress-label">Claude</span>
            <span className="progress-value">{escadaData.claude}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill claude" style={{ width: `${escadaData.claude}%` }}></div>
          </div>
        </div>
      </div>
      
      <div className="stats-section">
        <div className="stat-item">
          <div className="stat-label">Fila de pedidos</div>
          <div className="stat-value">{escadaData.filaPedidos}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Jules hoje</div>
          <div className="stat-value">{escadaData.julesHoje}/15</div>
        </div>
      </div>
    </div>
  );
};

export default EscadaCard;