import React, { useState, useEffect } from 'react';

export default function EscadaCard() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    fetch('/escada')
      .then((resp) => {
        if (!resp.ok) throw new Error('Falha ao carregar escada');
        return resp.json();
      })
      .then((d) => setDados(d))
      .catch((e) => setErro(e.message));
  }, []);

  if (!dados) {
    return (
      <div className="escada-card carregando">
        <h3>🪜 Escada</h3>
        <p>Carregando escada…</p>
      </div>
    );
  }

  const pct = (v) => Math.max(0, Math.min(100, Math.round((v || 0) * 100)));
  const cortex = pct(dados.cortexSemana);
  const ias = pct(dados.iasGratis);
  const claude = pct(dados.claude);

  return (
    <div className="escada-card">
      <h3>🪜 Escada</h3>
      <div className="progress-bars">
        <div className="bar">
          <label>Cortex <span>{cortex}%</span></label>
          <div className="track"><div className="fill" style={{ width: `${cortex}%` }} /></div>
        </div>
        <div className="bar">
          <label>IAs grátis <span>{ias}%</span></label>
          <div className="track"><div className="fill" style={{ width: `${ias}%` }} /></div>
        </div>
        <div className="bar">
          <label>Claude <span>{claude}%</span></label>
          <div className="track"><div className="fill" style={{ width: `${claude}%` }} /></div>
        </div>
      </div>
      <div className="numeros">
        <span><strong>Na fila:</strong> {dados.fila ?? 0}</span>
        <span><strong>Jules hoje:</strong> {dados.julesToday ?? 0}/15</span>
      </div>
      {dados.faseB && <span className="badge pronto">Pronto para fase B</span>}
      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}

<style>
.escada-card {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius, 12px);
  background: var(--surface, #ffffff);
  padding: 16px;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.08));
}
.escada-card h3 {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  color: var(--text, #111827);
}
.progress-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}
.bar label {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text, #111827);
  margin-bottom: 4px;
}
.track {
  height: 8px;
  background: var(--muted-bg, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--primary, #2563eb);
  border-radius: 4px;
  transition: width 0.4s ease;
}
.numeros {
  display: flex;
  gap: 16px;
  font-size: 0.9rem;
  color: var(--text, #111827);
  margin-bottom: 10px;
}
.badge.pronto {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--accent, #16a34a);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
}
.erro {
  color: var(--error, #dc2626);
  font-size: 0.85rem;
  margin-top: 8px;
}
.carregando {
  color: var(--muted, #6b7280);
  font-size: 0.9rem;
  text-align: center;
  padding: 20px;
}
</style>