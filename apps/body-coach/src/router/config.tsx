import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import AppShell from "../components/feature/AppShell";
import AuthGuard from "../components/feature/AuthGuard";
import SoPapel from "../components/feature/SoPapel";
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
const Conheca = carregar(() => import("../pages/conheca/page"));
const Planos = carregar(() => import("../pages/planos/page"));
const Instalar = carregar(() => import("../pages/instalar/page"));
const Respirar = carregar(() => import("../pages/breathe/page"));
const Exams = carregar(() => import("../pages/exams/page"));
const AntiDoping = carregar(() => import("../pages/antidoping/page"));
const Onboarding = carregar(() => import("../pages/onboarding/page"));
const Privacy = carregar(() => import("../pages/privacy/page"));
const RelatorioAvaliacao = carregar(() => import("../pages/evolution/relatorio/page"));
const Compartilhado = carregar(() => import("../pages/compartilhado/page"));
const AlunosEvolucao = carregar(() => import("../pages/coach/AlunosEvolucao"));
const AlunoEvolucao = carregar(() => import("../pages/coach/AlunoEvolucao"));
const Presenca = carregar(() => import("../pages/coach/Presenca"));
const RelatorioAluno = carregar(() => import("../pages/coach/RelatorioAluno"));
const Demonstracoes = carregar(() => import("../pages/coach/Demonstracoes"));
const MeusAlunos = carregar(() => import("../pages/coach/MeusAlunos"));
const AlunoPlano = carregar(() => import("../pages/coach/AlunoPlano"));
const AnamneseCoach = carregar(() => import("../pages/coach/AnamneseCoach"));
const Modelos = carregar(() => import("../pages/coach/Modelos"));
const ModeloEditar = carregar(() => import("../pages/coach/ModeloEditar"));
const Anamnese = carregar(() => import("../pages/anamnese/page"));
const Avisos = carregar(() => import("../pages/avisos/page"));
const Financeiro = carregar(() => import("../pages/coach/Financeiro"));
const Programas = carregar(() => import("../pages/coach/Programas"));
const Loja = carregar(() => import("../pages/loja/page"));
const Feed = carregar(() => import("../pages/feed/page"));
const Equipe = carregar(() => import("../pages/equipe/page"));
const Convites = carregar(() => import("../pages/coach/Convites"));
const MarcaCoach = carregar(() => import("../pages/coach/Marca"));
const Ferramentas = carregar(() => import("../pages/ferramentas/page"));
const MeuAcesso = carregar(() => import("../pages/acesso/page"));
const AcessosAdmin = carregar(() => import("../pages/admin/Acessos"));
const PainelAdmin = carregar(() => import("../pages/admin/Painel"));
const Guia = carregar(() => import("../pages/guia/page"));
const MeuPlano = carregar(() => import("../pages/coach/MeuPlano"));
const Testador = carregar(() => import("../pages/testador/page"));

// SoPapel: telas só do coach e telas só do aluno (o coach não vê as do aluno e vice-versa).
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
    // link curto de convite (o mesmo destino de /convite/:codigo)
    path: "/c/:codigo",
    element: <Convite />,
  },
  {
    path: "/conheca",
    element: <Conheca />,
  },
  {
    // página de vendas pública: preços, confiança e dúvidas, com botão do Pix
    path: "/planos",
    element: <Planos />,
  },
  {
    // página pública "Instalar o app": Android vai para a Play Store (app sem barra de endereço)
    path: "/instalar",
    element: <Instalar />,
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
    path: "/loja/:codigo",
    element: <Loja />,
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
      { index: true, element: <SoPapel papel="aluno"><Home /></SoPapel> },
      { path: "workout", element: <SoPapel papel="aluno"><Workout /></SoPapel> },
      { path: "nutrition", element: <SoPapel papel="aluno"><Nutrition /></SoPapel> },
      { path: "evolution", element: <SoPapel papel="aluno"><Evolution /></SoPapel> },
      { path: "plan", element: <SoPapel papel="aluno"><Plan /></SoPapel> },
      { path: "profile", element: <Profile /> },
      { path: "team", element: <SoPapel papel="aluno"><Team /></SoPapel> },
      { path: "chat", element: <Chat /> },
      { path: "coach/alunos", element: <SoPapel papel="coach"><MeusAlunos /></SoPapel> },
      { path: "coach/alunos/:uid", element: <SoPapel papel="coach"><AlunoPlano /></SoPapel> },
      { path: "coach/anamnese", element: <SoPapel papel="coach"><AnamneseCoach /></SoPapel> },
      { path: "coach/modelos", element: <SoPapel papel="coach"><Modelos /></SoPapel> },
      { path: "coach/convites", element: <SoPapel papel="coach"><Convites /></SoPapel> },
      { path: "coach/marca", element: <SoPapel papel="coach"><MarcaCoach /></SoPapel> },
      { path: "equipe", element: <SoPapel papel="aluno"><Equipe /></SoPapel> },
      { path: "coach/modelos/:id", element: <SoPapel papel="coach"><ModeloEditar /></SoPapel> },
      { path: "anamnese", element: <SoPapel papel="aluno"><Anamnese /></SoPapel> },
      { path: "avisos", element: <Avisos /> },
      { path: "coach/financeiro", element: <SoPapel papel="coach"><Financeiro /></SoPapel> },
      { path: "coach/programas", element: <SoPapel papel="coach"><Programas /></SoPapel> },
      { path: "feed", element: <Feed /> },
      { path: "coach/evolucao", element: <SoPapel papel="coach"><AlunosEvolucao /></SoPapel> },
      { path: "coach/demonstracoes", element: <SoPapel papel="coach"><Demonstracoes /></SoPapel> },
      { path: "coach/presenca/:uid", element: <SoPapel papel="coach"><Presenca /></SoPapel> },
      { path: "coach/evolucao/:uid", element: <SoPapel papel="coach"><AlunoEvolucao /></SoPapel> },
      { path: "feedback", element: <Feedback /> },
      { path: "acesso", element: <MeuAcesso /> },
      { path: "testador", element: <Testador /> },
      { path: "admin/acessos", element: <AcessosAdmin /> },
      { path: "admin/painel", element: <PainelAdmin /> },
      { path: "guia", element: <Guia /> },
      { path: "coach/plano", element: <SoPapel papel="coach"><MeuPlano /></SoPapel> },
      { path: "respirar", element: <SoPapel papel="aluno"><Respirar /></SoPapel> },
      { path: "ferramentas", element: <Ferramentas /> },
      { path: "ferramentas/:id", element: <Ferramentas /> },
      { path: "exams", element: <SoPapel papel="aluno"><Exams /></SoPapel> },
      { path: "antidoping", element: <SoPapel papel="aluno"><AntiDoping /></SoPapel> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;