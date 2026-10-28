import { useNavigate, useRoutes } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import RotaProtegida from "@/components/RotaProtegida";

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
const ProjetosPage = lazy(() => import("../pages/projetos/page"));
const AprovacoesPage = lazy(() => import("../pages/aprovacoes/page"));
const ExecucoesPage = lazy(() => import("../pages/execucoes/page"));
const AuditoriaPage = lazy(() => import("../pages/auditoria/page"));
const RobosPage = lazy(() => import("../pages/robos/page"));
const LeadsPage = lazy(() => import("../pages/leads/page"));
const ClientesPage = lazy(() => import("../pages/clientes/page"));
const CentralPage = lazy(() => import("../pages/central/page"));
const MeuCortexPage = lazy(() => import("../pages/meu-cortex/page"));
const CortexPage = lazy(() => import("../pages/cortex/page"));
const AssistentePublico = lazy(() => import("../pages/cortex/Assistentes").then(m => ({ default: m.AssistentePublico })));
const BriefingPublico = lazy(() => import("../pages/BriefingPublico"));
const NotFound = lazy(() => import("../pages/NotFound"));
const PrivacidadePage = lazy(() => import("../pages/legais/privacidade/page"));
const TermosPage = lazy(() => import("../pages/legais/termos/page"));
const CookiesPage = lazy(() => import("../pages/legais/cookies/page"));
const LGPDPage = lazy(() => import("../pages/legais/lgpd/page"));

const routes: RouteObject[] = [
  { path: "/", element: <Home /> },
  { path: "/sentinel", element: <RotaProtegida><Sentinel /></RotaProtegida> },
  { path: "/pipeline", element: <RotaProtegida><Pipeline /></RotaProtegida> },
  { path: "/codigo", element: <RotaProtegida><Codigo /></RotaProtegida> },
  { path: "/docs", element: <Docs /> },
  { path: "/cortex-app", element: <RotaProtegida><CortexApp /></RotaProtegida> },
  { path: "/swarm-control", element: <RotaProtegida><SwarmControl /></RotaProtegida> },
  { path: "/qa-center", element: <RotaProtegida><QACenter /></RotaProtegida> },
  { path: "/login", element: <LoginPage /> },
  { path: "/projetos", element: <ProjetosPage /> },
  { path: "/aprovacoes", element: <AprovacoesPage /> },
  { path: "/execucoes", element: <ExecucoesPage /> },
  { path: "/auditoria", element: <AuditoriaPage /> },
  { path: "/robos", element: <RobosPage /> },
  { path: "/leads", element: <LeadsPage /> },
  { path: "/clientes", element: <ClientesPage /> },
  { path: "/central", element: <CentralPage /> },
  { path: "/cortex", element: <CortexPage /> },
  { path: "/cortex/api", element: <ApiDocsPage /> },
  { path: "/cortex/a/:id", element: <AssistentePublico /> },
  { path: "/briefing/:codigo", element: <BriefingPublico /> },
  { path: "/meu-cortex", element: <MeuCortexPage /> },
  { path: "/ces", element: <TenantPage tenant="ces" /> },
  { path: "/bezsan", element: <TenantPage tenant="bezsan" /> },
  { path: "/vp", element: <TenantPage tenant="vp" /> },
  { path: "/viajante-pro", element: <TenantPage tenant="vp" /> },
  { path: "/splash", element: <TenantPage tenant="splash" /> },
  { path: "/privacidade", element: <PrivacidadePage /> },
  { path: "/termos", element: <TermosPage /> },
  { path: "/cortex/privacidade", element: <PrivacidadePage /> },
  { path: "/cortex/termos", element: <TermosPage /> },
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
