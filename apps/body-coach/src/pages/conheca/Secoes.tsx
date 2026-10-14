import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';

export function SecaoHero() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center bg-background-50 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 via-transparent to-primary-500/5" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
          </span>
          Fase de testes gratuita — vagas limitadas
        </span>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground-900 tracking-tight leading-[1.1] mb-6">
          Treino, alimentação e evolução<br />
          <span className="text-primary-600">com IA que te conhece de verdade</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-foreground-600 mb-10 leading-relaxed">
          O Body Coach AI monta seu treino, ajusta sua dieta e acompanha sua evolução
          semanalmente — tudo personalizado ao seu objetivo, rotina e histórico.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth"
            className="group w-full sm:w-auto rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary-500/30 hover:bg-primary-700 hover:shadow-primary-500/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Começar grátis agora
          </Link>
          <Link
            to="/termos"
            className="w-full sm:w-auto rounded-xl border-2 border-primary-200 px-8 py-4 text-base font-semibold text-primary-700 hover:bg-primary-50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Ver como funciona
          </Link>
        </div>
        <p className="mt-6 text-sm text-foreground-500">Sem cartão de crédito · Cancele quando quiser · Dados protegidos pela LGPD</p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background-50 to-transparent pointer-events-none" />
    </section>
  );
}

export function SecaoBeneficios() {
  const beneficios = [
    {
      icone: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      titulo: "Treino personalizado",
      descricao: "IA gera seu treino semanal baseado no seu objetivo, equipamentos, histórico e tempo disponível."
    },
    {
      icone: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      titulo: "Nutrição inteligente",
      descricao: "Plano alimentar com macros, receitas e lista de compras adaptado às suas preferências e restrições."
    },
    {
      icone: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      ),
      titulo: "Evolução medida",
      descricao: "Relatórios semanais com gráficos de força, composição corporal, aderência e prontidão."
    },
    {
      icone: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      titulo: "Coach humano opcional",
      descricao: "Tenha um coach real revisando seu plano, tirando dúvidas e ajustando a rota quando precisar."
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <header className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground-900 mb-4">
            Tudo que você precisa para evoluir<br />
            <span className="text-primary-600">em um só lugar</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-foreground-600">
            Pare de adivinhar. Treine com propósito, coma com estratégia e veja os resultados.
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {beneficios.map((b, i) => (
            <Card key={i} className="h-full hover:shadow-lg transition-shadow duration-300 border-primary-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 mb-4">
                {b.icone}
              </div>
              <h3 className="text-lg font-semibold text-foreground-900 mb-2">{b.titulo}</h3>
              <p className="text-foreground-600 leading-relaxed">{b.descricao}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoDepoimentos() {
  const depoimentos = [
    {
      nome: "Marina S.",
      cargo: "Aluna há 8 meses",
      avatar: "MS",
      texto: "Nunca consegui seguir academia por mais de 3 meses. Com o Body Coach, meu treino muda junto comigo — quando viajo, quando estou cansada, quando quero focar em glúteo. Em 8 meses perdi 12kg e ganhei força que não tinha aos 20 anos.",
      estrelas: 5
    },
    {
      nome: "Rafael M.",
      cargo: "Aluno há 5 meses",
      avatar: "RM",
      texto: "A nutrição foi o game changer. Receitas práticas, lista de mercado pronta, macros certos pro meu objetivo. O app me avisa quando bate a meta de proteína. Simples e funciona.",
      estrelas: 5
    },
    {
      nome: "Juliana K.",
      cargo: "Aluna há 1 ano",
      avatar: "JK",
      texto: "O relatório semanal me mantém honesta. Vejo minha aderência, força, medidas — e o coach humano me manda áudio ajustando o treino quando sinto dor no ombro. Vale cada centavo.",
      estrelas: 5
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-background-50">
      <div className="mx-auto max-w-6xl px-4">
        <header className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground-900 mb-4">
            Resultado de quem<br />
            <span className="text-primary-600">confiou no processo</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-foreground-600">
            Pessoas reais, rotinas reais, evolução real.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {depoimentos.map((d, i) => (
            <Card key={i} className="h-full border-primary-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-lg">
                  {d.avatar}
                </div>
                <div>
                  <p className="font-medium text-foreground-900">{d.nome}</p>
                  <p className="text-sm text-foreground-500">{d.cargo}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 mb-4" aria-label={`Avaliação ${d.estrelas} de 5 estrelas`}>
                {[...Array(d.estrelas)].map((_, i) => (
                  <svg key={i} className="h-5 w-5 text-yellow-400 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                ))}
              </div>
              <p className="text-foreground-600 leading-relaxed italic">"{d.texto}"</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoPlanos() {
  const planos = [
    {
      nome: "Autônomo",
      preco: "R$ 29",
      periodo: "/mês",
      destaque: false,
      features: [
        "Treino IA personalizado semanal",
        "Nutrição com macros e receitas",
        "Evolução semanal automática",
        "Chat com IA 24/7",
        "App mobile + web"
      ],
      cta: "Começar grátis",
      link: "/auth"
    },
    {
      nome: "Com Coach",
      preco: "R$ 149",
      periodo: "/mês",
      destaque: true,
      features: [
        "Tudo do Autônomo",
        "Coach humano dedicado",
        "Revisão quinzenal de plano",
        "Áudios personalizados semanais",
        "Prioridade no suporte"
      ],
      cta: "Quero meu coach",
      link: "/auth"
    },
    {
      nome: "Equipe/Box",
      preco: "Sob consulta",
      periodo: "",
      destaque: false,
      features: [
        "Gestão de múltiplos alunos",
        "Dashboard do coach",
        "Marca branca do seu box",
        "Relatórios consolidados",
        "API para integrações"
      ],
      cta: "Falar com vendas",
      link: "/auth"
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <header className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground-900 mb-4">
            Escolha seu plano<br />
            <span className="text-primary-600">sem surpresas</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-foreground-600">
            Todos os planos incluem fase de testes gratuita. Cancele quando quiser.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {planos.map((p, i) => (
            <Card
              key={i}
              className={`h-full relative flex flex-col ${p.destaque ? 'ring-2 ring-primary-500 shadow-xl scale-105 z-10' : 'border-primary-100'}`}
            >
              {p.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                    Mais popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground-900 mb-2">{p.nome}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground-900">{p.preco}</span>
                  <span className="text-foreground-500">{p.periodo}</span>
                </div>
              </div>
              <ul className="flex-1 space-y-3 mb-6" role="list">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <svg className="flex-shrink-0 mt-0.5 h-5 w-5 text-primary-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    <span className="text-foreground-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={p.link}
                className={`w-full text-center rounded-xl px-6 py-3 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${p.destaque
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30'
                  : 'bg-white border-2 border-primary-200 text-primary-700 hover:bg-primary-50'}
                }
              >
                {p.cta}
              </Link>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-foreground-500">
          Preços em Reais (BRL). Impostos incluídos. Fase de testes de 14 dias em todos os planos.
        </p>
      </div>
    </section>
  );
}

export function SecaoCTA() {
  return (
    <section className="py-16 sm:py-24 bg-primary-600">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Pronto para evoluir de verdade?
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-primary-100 mb-8">
          Comece sua fase de testes gratuita hoje. Sem cartão, sem compromisso, só resultado.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth"
            className="w-full sm:w-auto rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-600 hover:bg-primary-50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
          >
            Começar minha avaliação grátis
          </Link>
          <Link
            to="/termos"
            className="w-full sm:w-auto rounded-xl border-2 border-primary-300 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
          >
            Ler os termos primeiro
          </Link>
        </div>
      </div>
    </section>
  );
}
