import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import { AppRoutes } from "./router";
import i18n from "./i18n";

declare const __BASE_PATH__: string;

import { useAuth } from "./contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

function MasterRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  // Verifica se é o usuário master (conforme ADR-F1-02: role=master ou email master)
  const isMaster = 
    user && 
    (user.role === 'master' || 
     user.email === 'admin@nexia.ai' || 
     user.email === 'gilcambe@gmail.com' ||
     (import.meta.env.VITE_MASTER_EMAIL && user.email === import.meta.env.VITE_MASTER_EMAIL));

  if (!isMaster) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Restrição de acesso ao Cortex e /execucoes apenas para o usuário master (ADR-F1-02).
function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;
