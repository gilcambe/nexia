import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida';
import CortexApp from './pages/CortexApp';
import Execucoes from './pages/Execucoes';
import Home from './pages/Home'; // Assumindo uma página Home existente

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Rotas protegidas pelo RotaProtegida */}
      <Route element={<RotaProtegida />}>
        <Route path="/cortex-app" element={<CortexApp />} />
        <Route path="/execucoes" element={<Execucoes />} />
        {/* As rotas /api/cortex e /api/cortex-agent são backend e serão tratadas em functions/src/cortex.ts */}
      </Route>

      {/* Outras rotas não protegidas ou com outras permissões */}

      {/* Captura de rotas não encontradas */}
      <Route path="*" element={<div>404 - Página Não Encontrada</div>} />
    </Routes>
  );
};
