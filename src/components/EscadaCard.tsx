import { useState, useEffect } from 'react';

interface EscadaData {
  semana: {
    cortex: number;
    iasGratis: number;
    claude: number;
  };
  fila: number;
  julesHoje: number;
  faseB: boolean;
}

interface ProgressBarProps {
  label: string;
  valor: number;
}

function ProgressBar({ label, valor }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="escada-progress-item" data-testid={`escada-progress-${label.toLowerCase().replace(/ /g, '-')}`}>
      <div className="escada-progress-header">
        <span className="escada-progress-label">{label}</span>
        <span className="escada-progress-valor">{valor}%</span>
      </div>
      <div className="escada-progress-track">
        <div
          className="escada-progress-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
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
    let ignorar = false;
    const controller = new AbortController();
    fetch('/escada', {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar escada');
        return res.json();
      })
      .then((json: EscadaData) => {
        if (!ignorar) {
          setData(json);
          setCarregando(false);
        }
      })
      .catch((e) => {
        if (!ignorar && e.name !== 'AbortError') {
          setErro(e.message);
          setCarregando(false);
        }
      });
    return () => {
      ignorar = true;
      controller.abort();
    };
  }, []);

  if (carregando) return <div className="escada-carregando" role="status" aria-label="Carregando">Carregando escada…</div>;
  if (erro) return <div className="escada-erro" role="alert">{erro}</div>;
  if (!data) return null;

  return (
    <section className="escada-card" data-testid="escada-card">
      <h2 className="escada-titulo">🪜 Escada</h2>
      <div className="escada-barras" role="region" aria-label="Progresso da semana">
        <ProgressBar label="Cortex" valor={data.semana.cortex} />
        <ProgressBar label="IAs grátis" valor={data.semana.iasGratis} />
        <ProgressBar label="Claude" valor={data.semana.claude} />
      </div>
      <div className="escada-numeros" data-testid="escada-fila">Fila: {data.fila}</div>
      <div className="escada-jules" data-testid="escada-jules">Jules hoje {data.julesHoje}/15</div>
      {data.faseB && (
        <span className="escada-selo escada-selo-pronto" data-testid="escada-selo-fase-b" role="status" aria-label="Pronto para fase B">
          Pronto para fase B
        </span>
      )}
    </section>
  );
}