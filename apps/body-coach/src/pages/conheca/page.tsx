import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import Card from '@/components/base/Card';
import Telas from './Telas';

// Página de vendas pública (quem abre o link sem estar logado cai aqui).
// Depoimentos: só entram quando existir a ação pública `depoimentos_publicos`; hoje não existe, então a seção não aparece.

const GANHOS = [
  { icone: 'ri-run-line', titulo: 'Treino do dia pronto', texto: 'Abra o app e saiba exatamente o que fazer hoje.' },
  { icone: 'ri-restaurant-2-line', titulo: 'Dieta e água', texto: 'Cardápio do seu jeito e lembrete para beber água.' },
  { icone: 'ri-line-chart-line', titulo: 'Evolução com fotos e medidas', texto: 'Veja o antes e depois e quanto você já mudou.' },
  { icone: 'ri-robot-2-line', titulo: 'Coach de IA que responde', texto: 'Tire dúvidas de treino e dieta a qualquer hora.' },
  { icone: 'ri-notification-3-line', titulo: 'Avisos no celular', texto: 'Hora do treino, da refeição e da água.' },
  { icone: 'ri-wifi-off-line', titulo: 'Funciona sem internet', texto: 'Na academia sem sinal, o treino abre igual.' },
];

const PERSONAL = [
  'Monte ficha e dieta em minutos',
  'Seus alunos no app com a sua marca',
  'Cobrança por Pix',
  'Loja para vender seus programas',
  '3 alunos grátis para sempre',
];

const PERGUNTAS: { p: string; r: ReactNode }[] = [
  { p: 'É grátis mesmo?', r: 'Sim. O plano Básico é grátis para sempre. O Premium tem 14 dias grátis e você só continua se quiser.' },
  { p: 'Preciso de personal?', r: 'Não. O app monta seu treino e sua dieta sozinho. Se você tiver personal, ele pode acompanhar você por aqui.' },
  { p: 'Funciona no iPhone?', r: 'Sim, pelo Safari: toque em Compartilhar e depois em "Adicionar à Tela de Início". No Android, é só instalar.' },
  {
    p: 'Meus dados ficam seguros?',
    r: (
      <>
        Sim. Só você (e o seu personal, se você autorizar) vê seus dados.{' '}
        <Link to="/privacidade" className="font-semibold text-[#ea580c] underline">Veja a política de privacidade</Link>.
      </>
    ),
  },
];

export default function Conheca() {
  const { search } = useLocation();
  const ref = new URLSearchParams(search).get('ref');
  const comRef = (base: string) => (ref ? `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}` : base);
  const aluno = comRef('/auth?modo=criar');
  const personal = comRef('/auth?papel=coach');

  const { user } = useAuth();
  useEffect(() => { document.title = 'NEXIA Body Coach: seu personal no bolso'; }, []);
  if (user) return <Navigate to="/" replace />;

  const botoes = (
    <div className="flex flex-col gap-3">
      <Link to={aluno} className="flex items-center justify-center gap-2 rounded-xl bg-[#ea580c] px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-900/30 active:scale-[0.98]">
        <i className="ri-user-heart-line"></i> Sou aluno · começar grátis
      </Link>
      <Link to={personal} className="flex items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3.5 text-base font-bold text-white active:scale-[0.98]">
        <i className="ri-team-line"></i> Sou personal
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background-50 text-foreground-950">
      {/* Topo */}
      <header className="bg-[#1c1917] px-4 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-9 w-9 rounded-xl" />
              <span className="font-heading text-lg font-bold tracking-tight">Body <span className="text-[#fb923c]">Coach</span></span>
            </div>
            <Link to="/auth" className="rounded-full border border-white/20 px-3 py-1.5 text-sm font-semibold">Entrar</Link>
          </div>
          <div className="mt-10 text-center">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="NEXIA Body Coach" className="mx-auto h-20 w-20 rounded-3xl shadow-2xl shadow-orange-600/30" />
            <h1 className="mt-6 font-heading text-4xl font-extrabold leading-tight">Seu personal<br />no <span className="text-[#fb923c]">bolso</span></h1>
            <p className="mx-auto mt-3 max-w-sm text-base text-stone-300">Treino, dieta e evolução num app só, com coach de IA.</p>
          </div>
          <div className="mt-8">{botoes}</div>
          <p className="mt-3 text-center text-xs text-stone-400">Grátis para sempre no plano Básico. Sem cartão.</p>
          <div className="mt-10"><Telas /></div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-12 px-4 py-10">
        <section>
          <h2 className="font-heading text-2xl font-bold">O que você ganha</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {GANHOS.map((g) => (
              <Card key={g.titulo} padding="p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-xl text-[#ea580c]"><i className={g.icone}></i></span>
                <p className="mt-2 text-sm font-bold leading-snug">{g.titulo}</p>
                <p className="mt-1 text-xs text-foreground-600">{g.texto}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-[#1c1917] p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-[#fb923c]">Para personal</p>
          <h2 className="mt-1 font-heading text-2xl font-bold">Seus alunos num app com a sua cara</h2>
          <ul className="mt-4 space-y-2.5">
            {PERSONAL.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm">
                <i className="ri-checkbox-circle-fill mt-0.5 text-lg leading-none text-[#fb923c]"></i>{t}
              </li>
            ))}
          </ul>
          <Link to={personal} className="mt-5 flex items-center justify-center rounded-xl bg-[#ea580c] py-3 text-sm font-bold text-white">Começar como personal</Link>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold">Preços</h2>
          <div className="mt-4 space-y-3">
            <Card padding="p-4">
              <div className="flex items-baseline justify-between"><p className="font-bold">Básico</p><p className="text-xl font-extrabold">Grátis</p></div>
              <p className="mt-1 text-sm text-foreground-600">Para sempre. Treino, dieta e evolução.</p>
            </Card>
            <div className="relative rounded-2xl border-2 border-[#ea580c] bg-background-50 p-4">
              <span className="absolute -top-3 left-4 rounded-full bg-[#ea580c] px-2.5 py-0.5 text-[11px] font-bold text-white">14 dias grátis</span>
              <div className="flex items-baseline justify-between"><p className="font-bold">Premium</p><p className="text-xl font-extrabold">R$ 19,90<span className="text-sm font-medium text-foreground-500">/mês</span></p></div>
              <p className="mt-1 text-sm text-foreground-600">Coach de IA sem limite e todos os recursos.</p>
            </div>
            <Card padding="p-4">
              <div className="flex items-baseline justify-between"><p className="font-bold">Coach</p><p className="text-xl font-extrabold"><span className="text-sm font-medium text-foreground-500">a partir de </span>R$ 49</p></div>
              <p className="mt-1 text-sm text-foreground-600">Para personal. 3 alunos grátis para sempre.</p>
            </Card>
          </div>
          <Link to={comRef('/planos')} className="mt-3 block text-center text-sm font-semibold text-[#ea580c] underline">Ver todos os planos e dúvidas</Link>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold">Perguntas</h2>
          <div className="mt-4 space-y-2">
            {PERGUNTAS.map((q) => (
              <details key={q.p} className="group rounded-2xl border border-background-200 bg-background-50 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
                  {q.p}<i className="ri-arrow-down-s-line text-xl transition group-open:rotate-180"></i>
                </summary>
                <p className="mt-2 text-sm text-foreground-600">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-[#1c1917] p-5 text-center text-white">
          <h2 className="font-heading text-2xl font-bold">Comece hoje, de graça</h2>
          <p className="mb-5 mt-1 text-sm text-stone-300">Leva menos de 1 minuto.</p>
          {botoes}
        </section>
      </main>

      <footer className="border-t border-background-200 px-4 py-6 text-center text-xs text-foreground-500">
        <Link to="/termos" className="underline">Termos de uso</Link>
        <span className="mx-2">·</span>
        <Link to="/privacidade" className="underline">Privacidade</Link>
        <p className="mt-2">Feito pela NEXIA</p>
      </footer>
    </div>
  );
}
