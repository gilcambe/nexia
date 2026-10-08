import { useState } from 'react';
import { useNavigate, useLocation, NavLink, Outlet } from 'react-router-dom';
import { CoachProvider, useCoach } from './CoachContext';
import { NutritionProvider } from './NutritionContext';
import { ReadinessProvider } from './ReadinessContext';
import { useAuth } from './AuthContext';
import CoachPanel from './CoachPanel';
import InstallButton from './InstallButton';

const navItems = [
  { to: '/', label: 'Hoje', icon: 'ri-sun-line' },
  { to: '/nutrition', label: 'Nutrição', icon: 'ri-restaurant-line' },
  { to: '/evolution', label: 'Evolução', icon: 'ri-line-chart-line' },
  { to: '/plan', label: 'Ficha de treino', icon: 'ri-calendar-line' },
  { to: '/team', label: 'Equipe', icon: 'ri-group-line' },
  { to: '/exams', label: 'Saúde', icon: 'ri-stethoscope-line' },
  { to: '/antidoping', label: 'Anti-Doping', icon: 'ri-shield-check-line' },
  { to: '/profile', label: 'Perfil', icon: 'ri-user-3-line' },
];

function BrandMark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={
          size === 'md'
            ? 'flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-background-50'
            : 'flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-background-50'
        }
      >
        <i className="ri-heart-3-line text-lg"></i>
      </div>
      <div className="leading-none">
        <p className="font-heading font-bold tracking-tight text-foreground-950">
          NEXIA
        </p>
        <p className="mt-0.5 text-[10px] font-medium tracking-[0.18em] text-foreground-400 uppercase">
          Body Coach AI
        </p>
      </div>
    </div>
  );
}

function CoachFab() {
  const { setOpen, unread } = useCoach();
  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-none transition hover:bg-primary-600 lg:flex"
      aria-label="Abrir coach"
    >
      <i className="ri-robot-2-line text-2xl"></i>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-semibold text-background-50">
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
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95 ${isActive ? 'text-primary-600' : 'text-foreground-500'}`;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-background-200 bg-background-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegação principal">
      <div className="mx-auto flex max-w-md items-end px-1">
        <NavLink to="/" end className={tab}><i className="ri-sun-line text-xl"></i>Hoje</NavLink>
        <NavLink to="/nutrition" className={tab}><i className="ri-restaurant-line text-xl"></i>Nutrição</NavLink>
        <button onClick={() => navigate('/workout')} className="-mt-5 flex flex-1 flex-col items-center gap-0.5 text-[11px] font-semibold text-primary-700 active:scale-95" aria-label="Ir para o treino">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-lg ring-4 ring-background-50"><i className="ri-play-fill text-2xl"></i></span>
          Treino
        </button>
        <NavLink to="/evolution" className={tab}><i className="ri-line-chart-line text-xl"></i>Evolução</NavLink>
        <button onClick={() => setOpen(true)} className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-foreground-500 active:scale-95" aria-label="Abrir coach">
          <span className="relative"><i className="ri-robot-2-line text-xl"></i>{unread > 0 && <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-accent-500"></span>}</span>
          Coach
        </button>
        <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-foreground-500 active:scale-95" aria-label="Mais opções">
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
        {navItems.map((item) => (
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

        <button
          onClick={() => {
            navigate('/workout');
            onNavigate?.();
          }}
          className="mt-3 flex w-full items-center gap-3 rounded-lg bg-primary-500 px-3 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          <i className="ri-play-circle-line text-lg"></i>
          Iniciar treino
        </button>

        <InstallButton />

        <button
          onClick={() => setOpen(true)}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-600 transition hover:bg-background-100"
        >
          <i className="ri-mic-line text-lg"></i>
          Falar com o Coach
        </button>
      </nav>

      <div className="px-4 py-4">
        <div className="rounded-xl border border-background-200 bg-background-100/60 p-3">
          <p className="truncate text-xs font-semibold text-foreground-700">{displayName}</p>
          <p className="mt-0.5 text-[11px] text-foreground-400">{user?.email}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isLocalDemo ? 'bg-secondary-500' : 'bg-accent-500'}`}></span>
            <span className={`text-[11px] ${isLocalDemo ? 'text-secondary-700' : 'text-accent-700'}`}>
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
          <Outlet />
        </div>
      </main>

      <CoachFab />
      <BottomTabs onMore={() => setMobileOpen(true)} />
      <CoachPanel />
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