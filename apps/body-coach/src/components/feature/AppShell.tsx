import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link, NavLink, Outlet } from 'react-router-dom';
import { CoachProvider, useCoach } from './CoachContext';
import { NutritionProvider } from './NutritionContext';
import { ReadinessProvider } from './ReadinessContext';
import { useAuth } from './AuthContext';
import CoachPanel from './CoachPanel';
import InstallButton from './InstallButton';
import { setUserDoc } from '@/lib/userData';
import { codigoIndicacao } from '@/lib/ferramentas/cartao';
import { usePapel } from '@/lib/usePapel';
import { enviarPendentes } from '@/lib/pendentes';
import { marcaGuardada, type Marca } from '@/lib/coach/profissionais';
import PortaoAcesso from './PortaoAcesso';
import TourGuiado from './TourGuiado';

// Menu enxuto: só as telas principais. As outras (Respirar, Equipe, Exames, Anti-Doping...) ficam em Ferramentas.
const navItems = [
  { to: '/', label: 'Hoje', icon: 'ri-sun-line' },
  { to: '/nutrition', label: 'Nutrição', icon: 'ri-restaurant-line' },
  { to: '/evolution', label: 'Evolução', icon: 'ri-line-chart-line' },
  { to: '/plan', label: 'Ficha de treino', icon: 'ri-calendar-line' },
  { to: '/chat', label: 'Conversa', icon: 'ri-chat-3-line' },
  { to: '/feed', label: 'Feed da equipe', icon: 'ri-group-line' },
  { to: '/ferramentas', label: 'Ferramentas', icon: 'ri-apps-2-line' },
  { to: '/avisos', label: 'Avisos no celular', icon: 'ri-notification-3-line' },
  { to: '/guia', label: 'Guia do app', icon: 'ri-book-open-line' },
  { to: '/profile', label: 'Perfil', icon: 'ri-user-3-line' },
];

// Menu do coach/personal: só as funções de quem cuida dos alunos.
const coachItems = [
  { to: '/coach/alunos', label: 'Meus alunos', icon: 'ri-team-line' },
  { to: '/chat', label: 'Conversa', icon: 'ri-chat-3-line' },
  { to: '/coach/evolucao', label: 'Evolução dos alunos', icon: 'ri-line-chart-line' },
  { to: '/coach/modelos', label: 'Modelos de ficha e dieta', icon: 'ri-file-copy-2-line' },
  { to: '/coach/anamnese', label: 'Anamnese', icon: 'ri-questionnaire-line' },
  { to: '/coach/demonstracoes', label: 'Vídeos de execução', icon: 'ri-video-add-line' },
  { to: '/coach/convites', label: 'Convidar alunos', icon: 'ri-user-add-line' },
  { to: '/feed', label: 'Feed da equipe', icon: 'ri-group-line' },
  { to: '/coach/financeiro', label: 'Financeiro', icon: 'ri-money-dollar-circle-line' },
  { to: '/ferramentas/mensalidade', label: 'Mensalidade por Pix', icon: 'ri-qr-code-line' },
  { to: '/coach/programas', label: 'Programas à venda', icon: 'ri-store-2-line' },
  { to: '/coach/marca', label: 'Minha marca', icon: 'ri-palette-line' },
  { to: '/coach/plano', label: 'Meu plano', icon: 'ri-vip-crown-line' },
  { to: '/avisos', label: 'Avisos no celular', icon: 'ri-notification-3-line' },
  { to: '/guia', label: 'Guia do app', icon: 'ri-book-open-line' },
  { to: '/profile', label: 'Perfil', icon: 'ri-user-3-line' },
];

// Botão de feedback sempre à mão (piloto com os primeiros alunos): leva a tela de onde veio.
function FeedbackLink({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const location = useLocation();
  if (location.pathname === '/feedback') return null;
  return compact ? (
    <Link
      to="/feedback"
      state={{ de: location.pathname }}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"
      aria-label="Enviar feedback"
      title="Enviar feedback"
    >
      <i className="ri-feedback-line text-xl"></i>
    </Link>
  ) : (
    <Link
      to="/feedback"
      state={{ de: location.pathname }}
      onClick={onNavigate}
      className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-600 transition hover:bg-background-100"
    >
      <i className="ri-feedback-line text-lg"></i>
      Enviar feedback
    </Link>
  );
}

// Marca no topo: a do coach (logo, nome e cor) quando ele configurou; senão a do NEXIA.
function useMarca() {
  const [m, setM] = useState<Marca | null>(() => marcaGuardada());
  useEffect(() => {
    const ouvir = (e: Event) => setM((e as CustomEvent<Marca | null>).detail ?? null);
    window.addEventListener('bc-marca', ouvir);
    return () => window.removeEventListener('bc-marca', ouvir);
  }, []);
  return m;
}

function BrandMark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const marca = useMarca();
  const caixa = size === 'md' ? 'h-9 w-9 rounded-xl' : 'h-8 w-8 rounded-lg';
  return (
    <div className="flex items-center gap-2.5" data-testid="marca-topo">
      {marca?.logo ? (
        <img src={marca.logo} alt="" className={`${caixa} object-contain`} />
      ) : (
        <div className={`flex items-center justify-center bg-primary-500 text-background-50 ${caixa}`}>
          <i className="ri-heart-3-line text-lg"></i>
        </div>
      )}
      <div className="min-w-0 leading-none">
        <p className="max-w-[11rem] truncate font-heading font-bold tracking-tight text-foreground-950">
          {marca?.nome || 'NEXIA'}
        </p>
        <p className="mt-0.5 text-xs font-medium tracking-[0.18em] text-foreground-400 uppercase">
          {marca?.nome ? 'com NEXIA Body Coach' : 'Body Coach AI'}
        </p>
      </div>
    </div>
  );
}

function CoachFab() {
  const { setOpen, unread } = useCoach();
  if (usePapel(false) === 'coach') return null;
  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-none transition hover:bg-primary-600 lg:flex"
      aria-label="Abrir coach"
    >
      <i className="ri-robot-2-line text-2xl"></i>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-xs font-semibold text-background-50">
          {unread}
        </span>
      )}
    </button>
  );
}

// Barra de abas do celular (como app nativo): as telas principais ficam a um toque.
function BottomTabs({ onMore }: { onMore: () => void }) {
  const { setOpen, unread } = useCoach();
  const navigate = useNavigate();
  const papel = usePapel(false);
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition active:scale-95 ${isActive ? 'text-primary-600' : 'text-foreground-500'}`;
  if (papel === 'coach') {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-background-200 bg-background-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegação principal">
        <div className="mx-auto flex max-w-md items-end px-1">
          <NavLink to="/coach/alunos" className={tab}><i className="ri-team-line text-xl"></i>Alunos</NavLink>
          <NavLink to="/chat" className={tab}><i className="ri-chat-3-line text-xl"></i>Conversa</NavLink>
          <NavLink to="/coach/evolucao" className={tab}><i className="ri-line-chart-line text-xl"></i>Evolução</NavLink>
          <NavLink to="/coach/financeiro" className={tab}><i className="ri-money-dollar-circle-line text-xl"></i>Financeiro</NavLink>
          <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-foreground-500 active:scale-95" aria-label="Mais opções">
            <i className="ri-menu-line text-xl"></i>Mais
          </button>
        </div>
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-background-200 bg-background-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegação principal">
      <div className="mx-auto flex max-w-md items-end px-1">
        <NavLink to="/" end className={tab}><i className="ri-sun-line text-xl"></i>Hoje</NavLink>
        <NavLink to="/nutrition" className={tab}><i className="ri-restaurant-line text-xl"></i>Nutrição</NavLink>
        <button onClick={() => navigate('/workout')} className="-mt-5 flex flex-1 flex-col items-center gap-0.5 text-xs font-semibold text-primary-700 active:scale-95" aria-label="Ir para o treino">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-lg ring-4 ring-background-50"><i className="ri-play-fill text-2xl"></i></span>
          Treino
        </button>
        <NavLink to="/evolution" className={tab}><i className="ri-line-chart-line text-xl"></i>Evolução</NavLink>
        <button onClick={() => setOpen(true)} className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-foreground-500 active:scale-95" aria-label="Abrir coach">
          <span className="relative"><i className="ri-robot-2-line text-xl"></i>{unread > 0 && <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-accent-500"></span>}</span>
          Coach
        </button>
        <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-foreground-500 active:scale-95" aria-label="Mais opções">
          <i className="ri-menu-line text-xl"></i>Mais
        </button>
      </div>
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { setOpen } = useCoach();
  const navigate = useNavigate();
  const { profile, user, signOut, isLocalDemo } = useAuth();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Atleta';
  // Coach vê só o menu de coach; aluno ganha "Minha equipe" (o papel fica guardado no aparelho).
  const papel = usePapel(!!user);
  const ehCoach = papel === 'coach';
  const itens = ehCoach
    ? coachItems
    : papel === 'aluno' ? [...navItems.slice(0, 5), { to: '/equipe', label: 'Minha equipe', icon: 'ri-user-heart-line' }, ...navItems.slice(5)]
    // Sem coach (treina sozinho): sem Conversa e Feed da equipe; um atalho para quem quiser entrar na equipe de um personal.
    : [...navItems.filter((i) => i.to !== '/chat' && i.to !== '/feed'), { to: '/acesso', label: 'Minha assinatura', icon: 'ri-vip-crown-line' }]
  const comAdmin = user?.email?.toLowerCase() === 'gcbezerra@gmail.com' ? [...itens, { to: '/admin/acessos', label: 'Acessos (admin)', icon: 'ri-shield-user-line' }] : itens;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-5">
        <BrandMark />
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {comAdmin.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-foreground-600 hover:bg-background-100'
              }`
            }
          >
            <i className={`${item.icon} text-lg`}></i>
            {item.label}
          </NavLink>
        ))}

        {!ehCoach && <button
          onClick={() => {
            navigate('/workout');
            onNavigate?.();
          }}
          className="mt-3 flex w-full items-center gap-3 rounded-lg bg-primary-500 px-3 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          <i className="ri-play-circle-line text-lg"></i>
          Iniciar treino
        </button>}

        <InstallButton />

{!ehCoach && <button
          onClick={() => setOpen(true)}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-600 transition hover:bg-background-100"
        >
          <i className="ri-mic-line text-lg"></i>
          Falar com o Coach
        </button>}

        <FeedbackLink onNavigate={onNavigate} />
      </nav>

      <div className="px-4 py-4">
        <div className="rounded-xl border border-background-200 bg-background-100/60 p-3">
          <div className="flex items-center gap-2">
            {profile?.photo_data ? <img src={profile.photo_data} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{displayName.charAt(0).toUpperCase()}</span>}
            <p className="truncate text-xs font-semibold text-foreground-700">{profile?.nickname || displayName}</p>
          </div>
          <p className="mt-0.5 text-xs text-foreground-400">{user?.email}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isLocalDemo ? 'bg-secondary-500' : 'bg-accent-500'}`}></span>
            <span className={`text-xs ${isLocalDemo ? 'text-secondary-700' : 'text-accent-700'}`}>
              {isLocalDemo ? 'Modo local (teste)' : 'Conectado'}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-xs font-medium text-foreground-600 transition hover:bg-background-100"
          >
            <i className="ri-logout-box-r-line"></i>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Veio de um link de convite do coach: depois do login/cadastro, vai para a conversa que conclui a entrada na equipe.
  // Entrou por um link de indicação: grava no perfil quem indicou (uma vez só, nunca a si mesmo).
  const { user, profile } = useAuth();
  useEffect(() => {
    if (!user || !profile || profile.indicado_por) return;
    let ref: string | null = null;
    try { ref = localStorage.getItem('bc_indicado_por'); } catch { /* sem armazenamento */ }
    if (!ref) return;
    try { localStorage.removeItem('bc_indicado_por'); } catch { /* sem armazenamento */ }
    if (ref === codigoIndicacao(user.id)) return;
    void setUserDoc(user.id, 'profile', 'main', { indicado_por: ref, indicado_em: new Date().toISOString() }, true).catch(() => {});
  }, [user, profile]);
  // Treinos salvos sem internet vão sozinhos quando a conexão volta.
  useEffect(() => {
    if (!user) return;
    const enviar = () => { void enviarPendentes(user.id); };
    enviar();
    window.addEventListener('online', enviar);
    return () => window.removeEventListener('online', enviar);
  }, [user]);
  useEffect(() => {
    try { if (localStorage.getItem('bc_convite') && location.pathname !== '/chat') navigate('/chat', { replace: true }); } catch { /* sem armazenamento */ }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background-50">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-background-200 bg-background-50 lg:block">
        <SidebarContent />
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-background-200 bg-background-50/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          {location.pathname !== '/' && (
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"
              aria-label="Voltar"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
          )}
          <BrandMark size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <InstallButton compact />
          <FeedbackLink compact />
          <button
            onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"
          aria-label="Abrir menu"
        >
            <i className="ri-menu-line text-xl"></i>
          </button>
        </div>
      </header>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground-950/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-background-50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-full text-foreground-500 hover:bg-background-100"
              aria-label="Fechar menu"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* main */}
      <main className="min-h-screen min-w-0 break-words lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:py-8 lg:pb-8">
          <PortaoAcesso><Outlet /></PortaoAcesso>
        </div>
      </main>

      <CoachFab />
      <BottomTabs onMore={() => setMobileOpen(true)} />
      <CoachPanel />
      <TourGuiado />
    </div>
  );
}

export default function AppShell() {
  return (
    <ReadinessProvider>
      <CoachProvider>
        <NutritionProvider>
          <Shell />
        </NutritionProvider>
      </CoachProvider>
    </ReadinessProvider>
  );
}