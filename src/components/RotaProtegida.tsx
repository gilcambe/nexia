import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext'; // Assumindo que AuthContext existe e fornece user

const RotaProtegida: React.FC = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Carregando...</div>; // Ou um spinner de carregamento
  }

  if (!user) {
    // Não autenticado, redireciona para a home
    return <Navigate to="/" replace />;
  }

  // Verifica se o usuário é master conforme ADR-F1-02
  // Assumindo que user.customClaims.role é a forma de verificar o role no frontend
  if (!user.customClaims || user.customClaims.role !== 'master') {
    // Não é master, redireciona para a home ou página de acesso negado
    return <Navigate to="/" replace />;
  }

  return <Outlet />; // Renderiza as rotas filhas se autorizado
};

export default RotaProtegida;
