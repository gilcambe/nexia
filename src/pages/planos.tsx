import { useState } from 'react';
import { ShieldCheck, MessageSquare, Clock, Zap, ArrowRight, Phone, Star, CheckCircle2, ChevronDown } from 'lucide-react';

const PLANOS = [
  {
    nome: 'Básico',
    preco: 49,
    descricao: 'Ideal para quem está começando e quer organizar a rotina de treinos e alimentação.',
    recursos: [
      'Plano de treino personalizado',
      'Acompanhamento semanal',
      'Acesso ao app Body Coach',
      'Suporte por e-mail',
    ],
    pixKey: 'PIX_BASICO',
  },
  {
    nome: 'Popular',
    preco: 89,
    destaque: 'Mais escolhido',
    descricao: 'Para quem quer resultado mais rápido com acompanhamento próximo do coach.',
    recursos: [
      'Plano de treino e dieta personalizados',
      'Acompanhamento 2x por semana',
      'Acesso ao app Body Coach',
      'Suporte por WhatsApp',
      'Ajustes mensais de plano',
    ],
    pixKey: 'PIX_POPULAR',
  },
  {
    nome: 'Premium',
    preco: 149,
    descricao: 'Acompanhamento completo e ilimitado para transformação de corpo e saúde.',
    recursos: [
      'Plano de treino e dieta personalizados',
      'Acompanhamento ilimitado',
      'Acesso ao app Body Coach',
      'Suporte por WhatsApp prioritário',
      'Ajustes semanais de plano',
      'Avaliação física mensal',
    ],
    pixKey: 'PIX_PREMIUM',
  },
];

const DEPOIMENTOS = [
  {
    nome: 'Mariana Silva',
    cargo: 'Testadora do plano Popular',
    avaliacao: 5,
    texto: 'Consegui perder 6 kg em 2 meses com o acompanhamento semanal. O app é simples e o coach responde rápido no WhatsApp.',
    avatar: 'MS',
  },
  {
    nome: 'Carlos Mendes',
    cargo: 'Testador do plano Premium',
    avaliacao: 5,
    texto: 'Minha disposição mudou completamente. O plano Premium vale cada centavo pelo suporte próximo e os ajustes constantes.',
    avatar: 'CM',
  },
  {
    nome: 'Ana Paula',
    cargo: 'Testadora do plano Básico',
    avaliacao: 4,
    texto: 'Ótimo custo-benefício para começar. O plano de treino já veio adequado à minha rotina de trabalho.',
    avatar: 'AP',
  },
  {
    nome: 'Roberto Lima',
    cargo: 'Testador do plano Popular',
    avaliacao: 5,
    texto: 'Resultado visível em 4 semanas. O acompanhamento 2x por semana fez toda a diferença para eu não desistir.',
    avatar: 'RL',
  },
];

const FAQ = [
  {
    pergunta: 'Como funciona o pagamento por Pix?',
    resposta: 'Escolha o plano, clique no botão Pix, copie o código ou leia o QR code com o app do seu banco. O acesso é liberado assim que o pagamento for confirmado.',
  },
  {
    pergunta: 'Posso cancelar a qualquer momento?',
    resposta: 'Sim. Você pode cancelar sua assinatura quando quiser, sem multa. O acesso continua valendo até o fim do período pago.',
  },
  {
    pergunta: 'Preciso de academia para seguir os treinos?',
    resposta: 'Não necessariamente. Os planos incluem opções para casa e academia, de acordo com o que você tiver disponível.',
  },
  {
    pergunta: 'O app funciona no iPhone e Android?',
    resposta: 'Sim. O Body Coach está disponível para iOS e Android, e você acessa com o mesmo login em ambos.',
  },
  {
    pergunta: 'Terei um coach real me acompanhando?',
    resposta: 'Sim. Todos os planos incluem acompanhamento de um coach humano, com frequência que varia de acordo com o plano escolhido.',
  },
  {
    pergunta: 'Quanto tempo para ver resultados?',
    resposta: 'Depende da sua dedicação e consistência. Muitos alunos relatam mudanças visíveis entre 4 e 8 semanas.',
  },
];

export default function Planos() {
  const [aberto, setAberto] = useState<number | null>(null);
  const [pixModal, setPixModal] = useState<string | null>(null);
  const [contato, setContato] = useState('');
  const [mensagemEnviada, setMensagemEnviada] = useState(false);

  const whatsappLink = (plano: string) => {
    const texto = encodeURIComponent(
      `Olá! Tenho interesse no plano ${plano} do Body Coach. Gostaria de mais informações sobre como começar.`
    );
    return `https://wa.me/5511999999999?text=${texto}`;
  };

  const handleContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contato.trim()) return;
    setMensagemEnviada(true);
    setContato('');
  };

  return (
    <>
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 mb-4">
              Conversão direta do Instagram • Sem custo
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Escolha o plano que transforma sua rotina
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Treino, dieta e acompanhamento de coach real. Tudo no app Body Coach, com pagamento por Pix e acesso imediato.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {PLANOS.map((plano, i) => (
              <div
                key={i}
                className={
                  'relative rounded-2xl p-8 border border-gray-200 bg-white transition-all hover:shadow-lg hover:border-primary-200 ' +
                  (plano.destaque ? 'ring-2 ring-primary-500 scale-105 z-10' : '')
                }
              >
                {plano.destaque && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-primary-500 text-white">
                    {plano.destaque}
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plano.nome}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">R$ {plano.preco}</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>
                <p className="text-gray-600 text-sm mb-6 line-clamp-3">{plano.descricao}</p>
                <ul className="space-y-3 mb-8">
                  {plano.recursos.map((r, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="space-y-3">
                  <button
                    onClick={() => setPixModal(plano.pix)}
                    className="w-full py-3 rounded-lg font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Pagar com Pix
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={whatsappLink(plano.nome)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-lg font-semibold text-gray-700 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" /> Falar no WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">O que dizem quem já testou</h2>
            <p className="text-gray-600">Depoimentos reais de testadores do Body Coach</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {DEPOIMENTOS.map((d, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  {[...Array(d.avaliacao)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6">"{d.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm">
                    {d.avatar}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{d.nome}</h4>
                    <p className="text-xs text-gray-500">{d.cargo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">Perguntas frequentes</h2>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden transition-all">
                <button
                  onClick={() => setAberto(aberto === i ? null : i)}
                  aria-expanded={aberto === i}
                  className="w-full flex items-center justify-between px-6 py-4 bg-white text-left text-gray-900 font-medium hover:bg-gray-50"
                >
                  {item.pergunta}
                  <ChevronDown className={"w-4 h-4 text-gray-400 transition-transform " + (aberto === i ? 'rotate-180' : '')} />
                </button>
                {aberto === i && (
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-100">
                    {item.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-primary-600 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Pronto para começar?</h2>
          <p className="text-primary-100 mb-8">Escolha seu plano e pague pelo Pix. O acesso é liberado na hora.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 rounded-lg font-semibold text-primary-600 bg-white hover:bg-gray-100 transition-colors">
              Ver planos novamente
            </button>
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1!+Tenho+interesse+em+contratar+um+plano+do+Body+Coach."
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-lg font-semibold text-white bg-white hover:bg-gray-100 transition-colors"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {pixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPixModal(null)}>
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPixModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Pagamento por Pix</h3>
            <p className="text-sm text-gray-500 mb-4">Copie o código abaixo ou leia o QR code com o seu banco:</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs font-mono text-gray-700 break-all overflow-x-auto">
              {pixModal}
            </div>
            <p className="text-xs text-gray-400 mb-6">Após o pagamento, o acesso é liberado automaticamente.</p>
          </div>
        </div>
      )}

      <section className="py-12 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Fale com a gente</h3>
          <form onSubmit={handleContato} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="tel"
                placeholder="Seu WhatsApp"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
              />
              <button
                type="submit"
                disabled={mensagemEnviada}
                className="px-6 py-3 rounded-lg font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 transition-colors"
              >
                {mensagemEnviada ? 'Enviado ✓' : 'Enviar'}
              </button>
            </div>
            {mensagemEnviada && (
              <p className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Mensagem enviada! Entraremos em contato pelo WhatsApp.
              </p>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
