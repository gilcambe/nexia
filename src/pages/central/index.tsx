import React from 'react';
import LoteClientes from './LoteClientes';

const CentralPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Central</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Other cards would go here */}
        <div className="bg-white p-4 rounded shadow">
          <LoteClientes />
        </div>
      </div>
    </div>
  );
};

export default CentralPage;
