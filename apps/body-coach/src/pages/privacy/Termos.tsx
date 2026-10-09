import { Link } from 'react-router-dom';

// Termos de uso (versão inicial da fase de testes). Deve ser revisada por um advogado antes de cobrar.
const itens: [string, string][] = [
  ['O que é', 'O NEXIA Body Coach AI é um app de acompanhamento de treino, alimentação e evolução. Nesta fase ele é oferecido gratuitamente para testes.'],
  ['Não substitui profissionais', 'As orientações do app e da inteligência artificial não substituem médico, nutricionista, fisioterapeuta ou educador físico. Em dor forte, lesão, doença ou dúvida de saúde, procure um profissional. Você é responsável por treinar dentro dos seus limites.'],
  ['Sua conta', 'Use dados verdadeiros e guarde a sua senha. Você pode apagar a conta e todos os seus dados a qualquer momento, no Perfil.'],
  ['Coach e alunos', 'O coach só vê as mensagens, vídeos e o resumo da semana dos alunos que entraram na equipe dele pelo convite. Um aluno nunca vê os dados de outro aluno.'],
  ['Conteúdo que você envia', 'Fotos, vídeos e mensagens continuam sendo seus. Não envie conteúdo ilegal, ofensivo ou de terceiros sem permissão.'],
  ['Fase de testes', 'O app pode mudar, ter falhas ou ficar fora do ar. Os seus comentários são bem-vindos pela opção "Enviar feedback".'],
  ['Contato', 'Dúvidas sobre estes termos ou sobre os seus dados: use "Enviar feedback" dentro do app.'],
];

export default function Termos() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <Link to="/auth" className="text-sm text-primary-600 hover:underline">← Voltar</Link>
      <h1 className="mt-3 font-heading text-2xl font-bold text-foreground-950">Termos de uso</h1>
      <div className="mt-4 space-y-4">
        {itens.map(([t, x]) => <section key={t}><h2 className="font-heading text-base font-semibold text-foreground-900">{t}</h2><p className="mt-1 text-sm text-foreground-700">{x}</p></section>)}
      </div>
      <p className="mt-6 text-sm text-foreground-600">Veja também a <Link to="/privacidade" className="text-primary-600 hover:underline">Política de privacidade</Link>.</p>
    </div>
  );
}
