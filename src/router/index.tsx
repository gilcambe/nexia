import { useNavigate, useRoutes } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";

const Home = lazy(() => import("../pages/home/page"));
const Sentinel = lazy(() => import("../pages/sentinel/page"));
const Pipeline = lazy(() => import("../pages/pipeline/page"));
const Codigo = lazy(() => import("../pages/codigo/page"));
const Docs = lazy(() => import("../pages/docs/page"));
const CortexApp = lazy(() => import("../pages/cortex-app/page"));
const SwarmControl = lazy(() => import("../pages/swarm-control/page"));
const QACenter = lazy(() => import("../pages/qa-center/page"));
const TenantPage = lazy(() => import("../pages/tenant/page"));
const LoginPage = lazy(() => import("../pages/login/page"));
const NotFound = lazy(() => import("../pages/NotFound"));
const PrivacidadePage = lazy(() => import("../pages/legais/privacidade/page"));
const TermosPage = lazy(() => import("../pages/legais/termos/page"));
const CookiesPage = lazy(() => import("../pages/legais/cookies/page"));
const LGPDPage = lazy(() => import("../pages/legais/lgpd/page"));

const routes: RouteObject[] = [
  { path: "/", element: <Home /> },
  { path: "/sentinel", element: <Sentinel /> },
  { path: "/pipeline", element: <Pipeline /> },
  { path: "/codigo", element: <Codigo /> },
  { path: "/docs", element: <Docs /> },
  { path: "/cortex-app", element: <CortexApp /> },
  { path: "/swarm-control", element: <SwarmControl /> },
  { path: "/qa-center", element: <QACenter /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/ces", element: <TenantPage tenant="ces" /> },
  { path: "/bezsan", element: <TenantPage tenant="bezsan" /> },
  { path: "/vp", element: <TenantPage tenant="vp" /> },
  { path: "/viajante-pro", element: <TenantPage tenant="vp" /> },
  { path: "/splash", element: <TenantPage tenant="splash" /> },
  { path: "/privacidade", element: <PrivacidadePage /> },
  { path: "/termos", element: <TermosPage /> },
  { path: "/cookies", element: <CookiesPage /> },
  { path: "/lgpd", element: <LGPDPage /> },
  { path: "*", element: <NotFound /> },
];

const Loader = () => (
  <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
    <i className="ri-loader-4-line animate-spin text-nexia-cyan text-2xl" />
  </div>
);

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();

  useEffect(() => {
    (window as Window & { REACT_APP_NAVIGATE?: typeof navigate }).REACT_APP_NAVIGATE = navigate;
  });

  return <Suspense fallback={<Loader />}>{element}</Suspense>;
}
