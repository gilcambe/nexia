import React, { useState, useEffect } from 'react';

export default function Central() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch('/api/custos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((json) => {
        setDados(json);
        setCarregando(false);
      })
      .catch(() => {
        setErro('Não foi possível carregar os custos.');
        setCarregando(false);
      });
  }, []);

  if (carregando) {
    return <div className="central-custos">Carregando custos...</div>;
  }
  if (erro) {
    return <div className="central-custos alerta">{erro}</div>;
  }
  if (!dados) return null;

  return (
    <div className="central-custos">
      <h2>Custos do mês</h2>

      <div className="resumo">
        <div className="card">
          <span className="rotulo">Custo total do mês</span>
          <span className="valor">R$ {dados.custoTotal.toFixed(2)}</span>
        </div>
        <div className="card">
          <span className="rotulo">% do custo sobre a receita do plano</span>
          <span className="valor">{dados.percentualCustoReceita.toFixed(1)}%</span>
        </div>
      </div>

      {dados.alertaTetoGlobal && (
        <div className="alerta global">
          ⚠️ Circuito global ativo: teto global excedido.
        </div>
      )}

      <div className="secao">
        <h3>Custo médio por plano</h3>
        <ul>
          {Object.entries(dados.custoMedioPorPlano || {}).map(([plano, media]) => (
            <li key={plano}>
              {plano}: R$ {media.toFixed(2)}
            </li>
          ))}
        </ul>
      </div>

      <div className="secao">
        <h3>Top 10 clientes que mais gastam</h3>
        <ol>
          {dados.top10Clientes.map((c, i) => (
            <li key={i}>
              {c.cliente} — R$ {c.total.toFixed(2)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
