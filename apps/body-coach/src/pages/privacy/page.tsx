import { Link } from 'react-router-dom';

const sections: { icon: string; title: string; text: string }[] = [
  {
    icon: 'ri-information-line',
    title: 'Quem somos',
    text: 'O NEXIA Body Coach AI é um app de acompanhamento de treino, dieta e evolução.',
  },
  {
    icon: 'ri-database-2-line',
    title: 'Dados que coletamos',
    text: 'Nome, e-mail, respostas do questionário, refeições, check-ins, peso, fotos e exames que você mesmo envia.',
  },
  {
    icon: 'ri-focus-3-line',
    title: 'Para que usamos',
    text: 'Só para mostrar sua evolução e as recomendações do coach. Não vendemos nem compartilhamos seus dados com terceiros.',
  },
  {
    icon: 'ri-lock-line',
    title: 'Onde ficam',
    text: 'No Firebase do Google, protegidos por login. Cada pessoa só acessa os próprios dados.',
  },
  {
    icon: 'ri-shield-user-line',
    title: 'Seus direitos pela LGPD',
    text: 'Você pode ver, corrigir e apagar seus dados a qualquer momento. O botão "Excluir minha conta" fica na página Perfil.',
  },
  {
    icon: 'ri-heart-pulse-line',
    title: 'Aviso de saúde',
    text: 'O app não substitui médico, nutricionista ou educador físico.',
  },
  {
    icon: 'ri-chat-3-line',
    title: 'Contato',
    text: 'Dúvidas e pedidos sobre seus dados: pelo próprio app. Um e-mail de suporte será informado aqui em breve.',
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background-100 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
          <i className="ri-arrow-left-line"></i> Voltar
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Termos de uso e privacidade</h1>
        {sections.map((s) => (
          <section key={s.title} className="rounded-2xl border border-background-200 bg-background-50 p-5">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground-950">
              <i className={`${s.icon} text-primary-500`}></i>
              {s.title}
            </h2>
            <p className="mt-2 text-sm text-foreground-600">{s.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
