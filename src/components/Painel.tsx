import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PainelProps {
  // Add any props you need here
}

const Painel: React.FC<PainelProps> = () => {
  const [activeTab, setActiveTab] = useState<string>('default');
  const navigate = useNavigate();

  const handleVerTodosClick = () => {
    // Change to the desired tab
    setActiveTab('todos');

    // Add a step to the history
    window.history.pushState({}, '', '/painel/todos');

    // Navigate to the desired route
    navigate('/painel/todos');
  };

  return (
    <div className="painel-container">
      {/* Your existing tabs and content */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'default' ? 'active' : ''}`}
          onClick={() => setActiveTab('default')}
        >
          Default
        </button>
        <button
          className={`tab ${activeTab === 'todos' ? 'active' : ''}`}
          onClick={() => setActiveTab('todos')}
        >
          Todos
        </button>
        <button
          className="ver-todos-button"
          onClick={handleVerTodosClick}
        >
          Ver todos
        </button>
      </div>

      {/* Your existing content based on activeTab */}
      {activeTab === 'default' && (
        <div className="default-content">
          {/* Default content */}
        </div>
      )}

      {activeTab === 'todos' && (
        <div className="todos-content">
          {/* Todos content */}
        </div>
      )}
    </div>
  );
};

export default Painel;
