import React from 'react';
import Link from 'next/link'; // Assumindo que Next.js é usado para links

// Importar componentes e dados de guias (serão definidos em guias.ts)
import { guias, GuiasMap } from './guias';

interface CardData {
  id: string;
  title: string;
  description: string;
  link: string;
}

// Dados fictícios para os cards (substitua pelos dados reais)
const cardsData: CardData[] = [
  { id: 'painel', title: 'Painel', description: 'Visão geral do sistema.', link: '/central/painel' },
  { id: 'cortex', title: 'Cortex', description: 'Acesso ao Cortex.', link: '/central/cortex' },
  { id: 'maquinas', title: 'Máquinas', description: 'Gerenciamento de máquinas.', link: '/central/maquinas' },
  { id: 'ia-vagas', title: 'IA Vagas', description: 'Busca de vagas com IA.', link: '/central/ia-vagas' },
  { id: 'saude', title: 'Saúde', description: 'Informações de saúde.', link: '/central/saude' },
  { id: 'avisos', title: 'Avisos', description: 'Notificações importantes.', link: '/central/avisos' },
  { id: 'pedidos', title: 'Pedidos', description: 'Histórico de pedidos.', link: '/central/pedidos' },
  { id: 'mais', title: 'Mais', description: 'Outras funcionalidades.', link: '/central/mais' },
  { id: 'sites-clientes', title: 'Sites de Clientes', description: 'Acesso aos sites dos clientes.', link: '/central/sites-clientes' },
  { id: 'lote', title: 'Lote', description: 'Operações em lote.', link: '/central/lote' },
  { id: 'moldes', title: 'Moldes', description: 'Gerenciamento de moldes.', link: '/central/moldes' },
];

// Componente do botão "ComoUsar"
const BotaoComoUsar = ({ cardId }: { cardId: string }) => {
  const guide = guias[cardId as keyof GuiasMap];
  if (!guide) {
    return null; // Não renderiza se não houver guia correspondente
  }
  // Assumindo que você terá um modal ou página para exibir o guia
  const handleClick = () => {
    console.log(`Abrindo guia para o card: ${cardId}`);
    // Implementar lógica para abrir o modal/página do guia aqui
    alert(`Guia para ${guide.title}:\n${guide.content}`);
  };

  return (
    <button onClick={handleClick} className="como-usar-button" aria-label={`Como usar ${guide.title}`}>
      ?
    </button>
  );
};

const CentralPage = () => {
  return (
    <div className="central-container">
      <h1>Central NEXIA</h1>
      <div className="cards-grid">
        {cardsData.map((card) => (
          <div key={card.id} className="card">
            <Link href={card.link} className="card-link">
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </Link>
            <BotaoComoUsar cardId={card.id} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CentralPage;

