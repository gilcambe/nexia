import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import Card from '@/components/base/Card';
import { PLANOS_PREMIUM, ECONOMIA_ANUAL, PRECOS } from '@/lib/acesso';

// Página de vendas /planos (para o tráfego do Instagram): preços, o que dá confiança e as dúvidas que travam a compra.
// Prova social honesta: só fatos que a pessoa pode conferir no app. Depoimentos entram só quando houver depoimentos reais
// publicados com autorização; não há texto inventado aqui.

const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(',00', '')}`;

const CONFIANCA = [
  { icone: 'ri-gift-line', titulo: 'Teste antes de pagar', texto: '14 dias de Premium grátis, sem cartão. O plano Básico é grátis para sempre.' },
  { icone: 'ri-qr-code-line', titulo: 'Pix, sem cobrança automática', texto: 'Você paga quando quiser. Nada é debitado sozinho no fim do mês.' },
  { icone: 'ri-shield-check-line', titulo: 'Seus dados são seus', texto: 'Só você vê. Seu personal só vê se você entrar na equipe dele.' },
  { icone: 'ri-wifi-off-line', titulo: 'Funciona na academia sem sinal', texto: 'O treino do dia abre mesmo sem internet.' },
];

const DUVIDAS = [
  { p: 'Como eu pago?', r: 'Por Pix. Dentro do app, em "Minha assinatura", aparece o QR Code e o copia e cola com o valor certo. Depois de pagar, toque em "Já paguei" e o acesso é liberado assim que o Pix for confirmado.' },
  { p: 'Vou ser cobrado todo mês sem perceber?', r: 'Não. Não existe cobrança automática nem cartão salvo. Se você não pagar de novo, o Premium acaba e você volta para o Básico, que é grátis.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim, é só não renovar. Você não perde seus treinos, refeições e evolução: tudo continua no app.' },
  { p: 'O que muda do grátis para o Premium?', r: 'O Básico já tem treino do dia, dieta e registro de refeições. O Premium libera o coach de IA sem limite, evolução com fotos e medidas, exames, equipe e as ferramentas extras.' },
  { p: 'Vale a pena o anual?', r: `O anual sai por ${reais(PLANOS_PREMIUM.anual.valor)}, cerca de ${ECONOMIA_ANUAL}% mais barato que 12 meses no mensal.` },
  { p: 'Tenho um cupom ou convite, onde uso?', r: 'No cadastro, em "Tenho um convite", ou na hora de pagar o Pix, em "Tenho um cupom ou convite". O mesmo código vale nos dois lugares.' },
  { p: 'Sou personal. Meus alunos pagam o Premium?', r: 'Não. Quem paga é você, pelo plano Coach, e seus alunos usam o Premium enquanto estiverem na sua equipe. Até 3 alunos é grátis para sempre.' },
  { p: 'Funciona no iPhone?', r: 'Sim, pelo Safari: toque em Compartilhar e depois em "Adicionar à Tela de Início". No Android, instale pela loja ou pelo navegador.' },
];

export default function Planos() {
  const { user } = useAuth();
  const { search } = useLocation();
  const ref = new URLSearchParams(search).get('ref');
  const comRef = (base: string) => (ref ? `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}` : base);
  useEffect(() => { document.title = 'Planos e preços · NEXIA Body Coach'; }, []);

  // Logado: vai direto para "Minha assinatura" (onde está o Pix). Sem conta: cria a conta e volta para lá.
  const pix = user
    ? <Link to="/acesso" className="flex items-center justify-center gap-2 rounded-xl bg-[#ea580c] px-5 py-3.5 text-base font-bold text-white active:scale-[0.98]"><i className="ri-qr-code-line"></i> Pagar com Pix</Link>
    : <Link to={comRef('/auth?modo=criar')} state={{ from: '/acesso' }} className="flex items-center justify-center gap-2 rounded-xl bg-[#ea580c] px-5 py-3.5 text-base font-bold text-white active:scale-[0.98]"><i className="ri-qr-code-line"></i> Começar grátis e pagar com Pix depois</Link>;
  const coach = user ? '/coach/plano' : comRef('/auth?papel=coach');

  return (
    <div className="min-h-screen bg-background-50 text-foreground-950">
      <header className="bg-[#1c1917] px-4 pb-8 pt-6 text-white">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between">
            <Link to={user ? '/' : '/conheca'} className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-9 w-9 rounded-xl" />
              <span className="font-heading text-lg font-bold tracking-tight">Body <span className="text-[#fb923c]">Coach</span></span>
            </Link>
            {!user && <Link to="/auth" className="rounded-full border border-white/20 px-3 py-1.5 text-sm font-semibold">Entrar</Link>}
          </div>
          <h1 className="mt-8 font-heading text-3xl font-extrabold leading-tight">Planos simples,<br />sem <span className="text-[#fb923c]">pegadinha</span></h1>
          <p className="mt-2 text-sm text-stone-300">Comece grátis. Pague por Pix só se gostar. Sem cartão e sem cobrança automática.</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-10 px-4 py-8">
        <section aria-label="Planos" className="space-y-3">
          <Card padding="p-4">
            <div className="flex items-baseline justify-between"><p className="font-bold">Básico</p><p className="text-xl font-extrabold">Grátis</p></div>
            <p className="mt-1 text-sm text-foreground-600">Para sempre. Treino do dia, dieta e registro de refeições.</p>
          </Card>
          <div className="relative rounded-2xl border-2 border-[#ea580c] bg-background-50 p-4" data-testid="plano-premium">
            <span className="absolute -top-3 left-4 rounded-full bg-[#ea580c] px-2.5 py-0.5 text-[11px] font-bold text-white">14 dias grátis</span>
            <p className="font-bold">Premium</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-background-100 p-3">
                <p className="text-xs text-foreground-500">{PLANOS_PREMIUM.mensal.nome}</p>
                <p className="text-xl font-extrabold">{reais(PLANOS_PREMIUM.mensal.valor)}<span className="text-sm font-medium text-foreground-500">/mês</span></p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/30">
                <p className="text-xs text-foreground-500">{PLANOS_PREMIUM.anual.nome} · {ECONOMIA_ANUAL}% mais barato</p>
                <p className="text-xl font-extrabold">{reais(PLANOS_PREMIUM.anual.valor)}<span className="text-sm font-medium text-foreground-500">/ano</span></p>
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground-600">Coach de IA sem limite, evolução com fotos e medidas, exames, equipe e todas as ferramentas.</p>
            <div className="mt-4">{pix}</div>
          </div>
          <Card padding="p-4">
            <p className="font-bold">Para personal</p>
            <ul className="mt-2 space-y-1 text-sm">
              {PRECOS.faixas.map((f) => (
                <li key={f.nome} className="flex justify-between gap-2"><span>{f.nome} <span className="text-foreground-500">· {f.alunos}</span></span><span className="font-semibold">{f.preco}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-foreground-500">Parceiro (nutricionista ou personal que divide o aluno): {PRECOS.parceiro}.</p>
            <Link to={coach} className="mt-3 flex items-center justify-center rounded-xl border border-background-200 py-2.5 text-sm font-bold">Ver plano do personal</Link>
          </Card>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold">Por que dá para confiar</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {CONFIANCA.map((c) => (
              <Card key={c.titulo} padding="p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-xl text-[#ea580c]"><i className={c.icone}></i></span>
                <p className="mt-2 text-sm font-bold leading-snug">{c.titulo}</p>
                <p className="mt-1 text-xs text-foreground-600">{c.texto}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-bold">Dúvidas antes de assinar</h2>
          <div className="mt-4 space-y-2">
            {DUVIDAS.map((q) => (
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
          <h2 className="font-heading text-2xl font-bold">Teste 14 dias de graça</h2>
          <p className="mb-5 mt-1 text-sm text-stone-300">Sem cartão. Se não gostar, continua no Básico.</p>
          {pix}
        </section>
      </main>

      <footer className="border-t border-background-200 px-4 py-6 text-center text-xs text-foreground-500">
        <Link to="/termos" className="underline">Termos de uso</Link>
        <span className="mx-2">·</span>
        <Link to="/privacidade" className="underline">Privacidade</Link>
      </footer>
    </div>
  );
}
