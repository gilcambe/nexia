import { useState, useEffect } from 'react';

interface EscadaData {
  progresso: {
    cortex: number;
    iaGratis: number;
    claude: number;
  };
  fila: {
    esperando: number;
    processando: number;
    concluido: number;
  };
  jules: {
    feito: number;
    meta: number;
  };
  faseB: boolean;
}

interface ProgressBarProps {
  label: string;
  valor: number;
}

function ProgressBar({ label, valor }: ProgressBarProps) {
  return (
    <div className="progress-item" data-testid={`progress-${label.toLowerCase()}`}>
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-valor">{valor}%</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
          role="progressbar"
          aria-valuenow={valor}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export default function EscadaCard() {
  const [data, setData] = useState<EscadaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch('/escada')
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar escada');
        return res.json();
      })
      .then((json: EscadaData) => {
        setData(json);
        setCarregando(false);
      })
      .catch((e) => {
        setErro(e.message);
        setCarregando(false);
      });
  }, []);

  if (carregando) {
    return (
      <div className="escada-card" data-testid="escada-card">
        <p>Carregando...</p>
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="escada-card" data-testid="escada-card">
        <p className="erro">Erro: {erro || 'dados não encontrados'}</p>
      </div>
    );
  }

  return (
    <div className="escada-card" data-testid="escada-card">
      <h2 className="escada-titulo">🪜 Escada</h2>

      <section className="escada-progresso" aria-label="Progresso da semana">
        <h3>Progresso da semana</h3>
        <ProgressBar label="Cortex" valor={data.progresso.cortex} />
        <ProgressBar label="IAs grátis" valor={data.progresso.iaGratis} />
        <ProgressBar label="Claude" valor={data.progresso.claude} />
      </section>

      <section className="escada-fila" aria-label="Números da fila">
        <h3>Fila</h3>
        <div className="fila-numeros">
          <span className="fila-item" data-testid="fila-esperando">
            Esperando: {data.fila.esperando}
          </span>
          <span className="fila-item" data-testid="fila-processando">
            Processando: {data.fila.processando}
          </span>
          <span className="fila-item" data-testid="fila-concluido">
            Concluído: {data.fila.concluido}
          </span>
        </div>
      </section>

      <section className="escada-jules" aria-label="Jules hoje">
        <h3>Jules hoje</h3>
        <p className="jules-texto" data-testid="jules-hoje">
          Jules hoje {data.jules.feito}/{data.jules.meta}
        </p>
      </section>

      {data.faseB && (
        <section className="escada-selo" aria-label="Selo fase B">
          <span className="selo verde" data-testid="selo-fase-b">
            ✅ Pronto para fase B
          </span>
        </section>
      )}
    </div>
  );
}
