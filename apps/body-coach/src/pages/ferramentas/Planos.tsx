import Card from '@/components/base/Card';

// Planos do Body Coach. Durante o teste tudo está liberado; a cobrança (Pix/cartão) entra depois.
const PLANOS = [
  {
    nome: 'Grátis', preco: 'R$ 0', periodo: 'para sempre', destaque: false,
    itens: ['Treino do dia pela ficha', 'Check-in e prontidão', 'Registro de refeições e água', 'Conquistas e corrida com GPS', 'Calculadoras'],
  },
  {
    nome: 'Premium', preco: 'R$ 19,90', periodo: 'por mês · ou R$ 149/ano · 14 dias grátis', destaque: true,
    itens: ['Tudo do Grátis', 'Coach IA ilimitado', 'Dieta que se ajusta sozinha toda semana', 'Avaliações, Body Twin 3D e relatórios', 'Receitas, lista de compras e trocas', 'Exames de sangue e antidoping', 'Conversa com o seu personal'],
  },
  {
    nome: 'Coach Completo', preco: 'Grátis até 3 alunos', periodo: 'R$ 49 até 15 · R$ 89 até 40 · R$ 149 ilimitado · 30 dias grátis', destaque: false,
    itens: ['Seus alunos usam o Premium de graça', 'Painel com todos os alunos', 'Ficha e dieta com rascunho da IA', 'Chat e correção de vídeos de execução', 'Evolução e avaliações dos alunos', 'Sua marca no app'],
  },
  {
    nome: 'Coach Parceiro', preco: 'R$ 29', periodo: 'por mês · alunos ilimitados', destaque: false,
    itens: ['Tudo do Coach Completo', 'Cada aluno assina o próprio Premium'],
  },
];

export default function Planos() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
        <i className="ri-gift-line mr-1"></i><b>Como funciona:</b> quem treina sozinho ganha 14 dias de Premium grátis; o coach ganha 30 dias. Avisamos antes de acabar. Aluno de coach no plano Completo não paga nada.
      </div>
      {PLANOS.map((p) => (
        <Card key={p.nome} className={p.destaque ? 'border-2 border-primary-500' : ''}>
          {p.destaque && <span className="mb-2 inline-block rounded-full bg-primary-500 px-2.5 py-0.5 text-xs font-bold uppercase text-background-50 dark:text-foreground-950">Mais escolhido</span>}
          <p className="font-heading text-lg font-bold text-foreground-950">{p.nome}</p>
          <p className="mt-0.5"><span className="font-heading text-2xl font-bold text-foreground-950">{p.preco}</span> <span className="text-xs text-foreground-500">{p.periodo}</span></p>
          <ul className="mt-3 space-y-1.5">
            {p.itens.map((i) => <li key={i} className="flex gap-2 text-sm text-foreground-700"><i className="ri-check-line text-primary-600"></i>{i}</li>)}
          </ul>
        </Card>
      ))}
      <p className="text-center text-xs text-foreground-400">Pagamento por Pix. Veja até quando o seu acesso vale em Menu › Minha assinatura.</p>
    </div>
  );
}
