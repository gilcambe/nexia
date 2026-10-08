import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import AppShell from "../components/feature/AppShell";
import AuthGuard from "../components/feature/AuthGuard";
import Home from "../pages/home/page";
import Workout from "../pages/workout/page";
import Evolution from "../pages/evolution/page";
import Nutrition from "../pages/nutrition/page";
import Plan from "../pages/plan/page";
import Profile from "../pages/profile/page";
import Team from "../pages/team/page";
import Chat from "../pages/chat/page";
import Convite from "../pages/chat/Convite";
import Respirar from "../pages/breathe/page";
import Exams from "../pages/exams/page";
import AntiDoping from "../pages/antidoping/page";
import Onboarding from "../pages/onboarding/page";
import Auth from "../pages/auth/page";
import Privacy from "../pages/privacy/page";

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
    path: "/privacidade",
    element: <Privacy />,
  },
  {
    path: "/onboarding",
    element: <Onboarding />,
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
      { path: "respirar", element: <Respirar /> },
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