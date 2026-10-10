import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import AppShell from "../components/feature/AppShell";
import AuthGuard from "../components/feature/AuthGuard";
import Home from "../pages/home/page";
import Auth from "../pages/auth/page";
import { carregar } from "./carregar";

// Telas carregadas só quando o aluno abre (app abre mais rápido no 4G). Hoje e Entrar vêm junto.
const Workout = carregar(() => import("../pages/workout/page"));
const Evolution = carregar(() => import("../pages/evolution/page"));
const Nutrition = carregar(() => import("../pages/nutrition/page"));
const Plan = carregar(() => import("../pages/plan/page"));
const Profile = carregar(() => import("../pages/profile/page"));
const Team = carregar(() => import("../pages/team/page"));
const Chat = carregar(() => import("../pages/chat/page"));
const Convite = carregar(() => import("../pages/chat/Convite"));
const Feedback = carregar(() => import("../pages/feedback/page"));
const Termos = carregar(() => import("../pages/privacy/Termos"));
const Respirar = carregar(() => import("../pages/breathe/page"));
const Exams = carregar(() => import("../pages/exams/page"));
const AntiDoping = carregar(() => import("../pages/antidoping/page"));
const Onboarding = carregar(() => import("../pages/onboarding/page"));
const Privacy = carregar(() => import("../pages/privacy/page"));
const RelatorioAvaliacao = carregar(() => import("../pages/evolution/relatorio/page"));
const Compartilhado = carregar(() => import("../pages/compartilhado/page"));
const AlunosEvolucao = carregar(() => import("../pages/coach/AlunosEvolucao"));
const AlunoEvolucao = carregar(() => import("../pages/coach/AlunoEvolucao"));
const RelatorioAluno = carregar(() => import("../pages/coach/RelatorioAluno"));
const Demonstracoes = carregar(() => import("../pages/coach/Demonstracoes"));
const Ferramentas = carregar(() => import("../pages/ferramentas/page"));

const routes: RouteObject[] = [
  {
    path: "/auth",
    element: <Auth />,
  },
  {
    path: "/convite/:codigo",
    element: <Convite />,
  },
  {
    path: "/termos",
    element: <Termos />,
  },
  {
    path: "/privacidade",
    element: <Privacy />,
  },
  {
    path: "/onboarding",
    element: <Onboarding />,
  },
  {
    path: "/evolution/relatorio/:id",
    element: (
      <AuthGuard>
        <RelatorioAvaliacao />
      </AuthGuard>
    ),
  },
  {
    path: "/compartilhado/:token",
    element: <Compartilhado />,
  },
  {
    path: "/coach/evolucao/:uid/relatorio/:id",
    element: (
      <AuthGuard>
        <RelatorioAluno />
      </AuthGuard>
    ),
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "workout", element: <Workout /> },
      { path: "nutrition", element: <Nutrition /> },
      { path: "evolution", element: <Evolution /> },
      { path: "plan", element: <Plan /> },
      { path: "profile", element: <Profile /> },
      { path: "team", element: <Team /> },
      { path: "chat", element: <Chat /> },
      { path: "coach/evolucao", element: <AlunosEvolucao /> },
      { path: "coach/demonstracoes", element: <Demonstracoes /> },
      { path: "coach/evolucao/:uid", element: <AlunoEvolucao /> },
      { path: "feedback", element: <Feedback /> },
      { path: "respirar", element: <Respirar /> },
      { path: "ferramentas", element: <Ferramentas /> },
      { path: "ferramentas/:id", element: <Ferramentas /> },
      { path: "exams", element: <Exams /> },
      { path: "antidoping", element: <AntiDoping /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;