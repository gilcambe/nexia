import React from 'react';
import Seo from '../../components/Seo';

const NOME_PRODUTO = 'Cortex';

const CortexPage: React.FC = () => {
  return (
    <div>
      <Seo 
        title={NOME_PRODUTO} 
        description={`Plataforma ${NOME_PRODUTO} - IA avançada para automação de tarefas`} 
        url="https://nome.pages.dev/cortex"
      />
      
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>{NOME_PRODUTO}</h1>
        <p>Página pública da plataforma {NOME_PRODUTO}</p>
      </div>
    </div>
  );
};

export default CortexPage;