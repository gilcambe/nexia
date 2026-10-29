import { useState } from 'react';
import EscadaCard from '../components/EscadaCard';

export default function Central() {
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'cortex'>('geral');
  const abas = [
    { id: 'geral', nome: 'Geral' },
    { id: 'cortex', nome: '🧠 Cortex' }
  ];

  return (
    <div className="central-page">
      <h1>Central</h1>
      <nav className="tabs" role="tablist">
        {abas.map((aba) => (
          <button
            key={aba.id}
            role="tab"
            aria-selected={abaAtiva === aba.id}
            className={`tab-btn tab-${aba.id} ${abaAtiva === aba.id ? 'active' : ''}`}
            data-tab={aba.id}
            data-testid={`tab-${aba.id}`}
            onClick={() => setAbaAtiva(aba.id)}
          >
            {aba.nome}
          </button>
        ))}
      </nav>
      <div className="tab-content">
        {abaAtiva === 'cortex' ? (
          <div className="cards-container cortex-tab" data-testid="aba-cortex">
            <EscadaCard />
          </div>
        ) : (
          <div className="cards-container geral-tab">
            {/* Other cards would go here */}
          </div>
        )}
      </div>
    </div>
  );
}