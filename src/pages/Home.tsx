import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div>
      <h1>Bem-vindo à aplicação NEXIA</h1>
      <p>Esta é a página inicial.</p>
      <nav>
        <ul>
          <li><Link to="/cortex-app">Acessar Cortex (Master)</Link></li>
          <li><Link to="/execucoes">Ver Execuções (Master)</Link></li>
          {/* Adicione outros links de navegação aqui */}
        </ul>
      </nav>
    </div>
  );
};

export default Home;
