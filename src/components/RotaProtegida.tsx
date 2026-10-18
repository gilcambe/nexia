import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Só mostra a página para quem está logado; os outros vão para /login e voltam depois.
export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-nexia-muted text-sm">Carregando...</div>;
  }
  if (!user) {
    return <Navigate to={"/login?next=" + encodeURIComponent(location.pathname + location.search)} replace />;
  }
  return <>{children}</>;
}
