// Acesso ao app: teste grátis, aviso antes de acabar e bloqueio quando acaba (o servidor decide; a tela só mostra).
import { chatApi } from './chat';

export interface Acesso {
  tipo: 'coach' | 'aluno' | 'independente';
  situacao: 'isento' | 'equipe' | 'pago' | 'gratis' | 'aviso' | 'bloqueado' | 'basico';
  motivo?: '' | 'coach';
  plano?: 'completo' | 'parceiro';
  limite?: number;
  cobertos?: number;
  dias: number | null;
  gratisAte: number;
  pagoAte: number;
  pix: string;
  pixNome?: string;
  sair: boolean;
  master: boolean;
  papel: 'coach' | 'aluno' | 'nenhum';
  promo?: { pct: number; ate: number; texto: string }; // promoção do dono no ar
  testador?: boolean; // já ganhou o Premium de testador do app Android
}

// Número deste aparelho (uma conta pode ficar aberta em no máximo 2 aparelhos).
function aparelhoId(): string {
  try {
    let id = localStorage.getItem('bc_aparelho');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bc_aparelho', id); }
    return id;
  } catch { return ''; }
}

export const verAcesso = () => chatApi<Acesso>({ acao: 'acesso_ver', aparelho: aparelhoId() });
export const avisarQuePaguei = (cupom = '', plano?: PlanoPremium, valor?: number) => chatApi<{ ok: boolean }>({ acao: 'acesso_paguei', ...(cupom ? { cupom } : {}), ...(plano ? { plano, valor } : {}) });
// Premium (aluno ou treina sozinho): mensal ou anual. O admin libera 30 ou 365 dias conforme o plano do pedido.
export type PlanoPremium = 'mensal' | 'anual';
export const PLANOS_PREMIUM: Record<PlanoPremium, { nome: string; valor: number; dias: number }> = {
  mensal: { nome: 'Mensal', valor: 19.9, dias: 30 },
  anual: { nome: 'Anual', valor: 179, dias: 365 },
};
export const ECONOMIA_ANUAL = Math.round((1 - PLANOS_PREMIUM.anual.valor / (PLANOS_PREMIUM.mensal.valor * 12)) * 100);
export const valorComDesconto = (valor: number, pct: number) => Math.round(valor * (1 - pct / 100) * 100) / 100;
// Tipo da chave Pix do NEXIA (para montar o copia e cola com o valor).
export function tipoDaChave(chave: string): 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria' {
  const c = chave.trim();
  if (c.includes('@')) return 'email';
  if (c.startsWith('+')) return 'telefone';
  const d = c.replace(/\D/g, '');
  if (/^[0-9a-f-]{32,36}$/i.test(c) && c.includes('-') && d.length !== 11 && d.length !== 14) return 'aleatoria';
  if (d.length === 14) return 'cnpj';
  if (d.length === 11 && /^[\d.\-]+$/.test(c)) return 'cpf';
  return d.length >= 10 && d.length <= 13 ? 'telefone' : 'aleatoria';
}
export const verCupom = (codigo: string) => chatApi<{ pct: number; codigo: string }>({ acao: 'cupom_ver', codigo });
// Preço do Premium com desconto (promoção ou cupom; vale o maior, não somam).
export const comDesconto = (valor: number, pct: number) => `R$ ${(valor * (1 - pct / 100)).toFixed(2).replace('.', ',')}`;
export const dataCurta = (t: number) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// Telas do Premium: sem Premium (bloqueado) elas mostram como assinar; o resto do app continua grátis.
const PREMIUM = ['/evolution', '/exams', '/antidoping', '/feed', '/equipe', '/anamnese', '/ferramentas/post', '/ferramentas/retrospectiva', '/ferramentas/periodizacao', '/ferramentas/lista-compras', '/ferramentas/ranking'];
export function telaPremium(caminho: string, tipo: Acesso['tipo']): boolean {
  if (tipo === 'aluno' && caminho.startsWith('/chat')) return true; // conversa com o coach
  return PREMIUM.some((p) => caminho === p || caminho.startsWith(p + '/'));
}

export const PRECOS = {
  premium: 'R$ 19,90 por mês ou R$ 179 por ano',
  faixas: [
    { faixa: 3, nome: 'Grátis', alunos: 'até 3 alunos', preco: 'R$ 0' },
    { faixa: 15, nome: 'Coach 15', alunos: 'até 15 alunos', preco: 'R$ 49 por mês' },
    { faixa: 40, nome: 'Coach 40', alunos: 'até 40 alunos', preco: 'R$ 89 por mês' },
    { faixa: 9999, nome: 'Coach Ilimitado', alunos: 'alunos ilimitados', preco: 'R$ 149 por mês' },
  ],
  parceiro: 'R$ 29 por mês, alunos ilimitados (cada aluno assina o Premium)',
};

export interface PlanoCoach extends Acesso { alunos: number }
export const verPlanoCoach = (plano?: 'completo' | 'parceiro') => chatApi<PlanoCoach>({ acao: 'acesso_plano', ...(plano ? { plano } : {}) });
