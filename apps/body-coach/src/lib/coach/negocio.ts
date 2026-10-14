// O negócio do coach: financeiro, cobrança, programas à venda e a loja (tudo por Pix direto, sem taxa).
import { chatApi } from '../chat';
import type { TipoChave } from '../ferramentas/pix';

export interface PixCoach { tipo: TipoChave; chave: string; nome: string; cidade: string; valor: number; vencimento: number; lembrete?: boolean }
export interface MesFin { mes: string; mensalidades: number; vendas: number }
export interface AlunoFin { uid: string; nome: string; valor: number; pago: boolean; avisou: boolean; dias: number; lembradoHoje: boolean }
export interface Venda { id: string; programa: string; comprador: string; preco: number; status: 'pendente' | 'avisou' | 'pago'; em: number }
export interface Financeiro { hoje: string; pix: PixCoach | null; historico: MesFin[]; alunos: AlunoFin[]; vendas: Venda[]; previsto: number }
export interface Programa { id: string; titulo: string; descricao: string; preco: number; semanas: number; ficha: string; dieta: string | null; ativo: boolean; vendas?: number; apagado?: boolean }
export interface ProgramaPublico { id: string; titulo: string; descricao: string; preco: number; semanas: number; resumo: string; temDieta: boolean; vendas: number }
export interface Compra { id: string; programa: string; titulo: string; preco: number; status: 'pendente' | 'avisou' | 'pago' | 'recusado' }

export const verFinanceiro = () => chatApi<Financeiro>({ acao: 'financeiro_ver' });
export const lembrarPagamento = (aluno?: string) => chatApi<{ lembrados: number }>(aluno ? { acao: 'pagamento_lembrar', aluno } : { acao: 'pagamento_lembrar', todos: true });
export const marcarPago = (aluno: string, mes: string, pago: boolean) => chatApi({ acao: 'pagamento_marcar', aluno, mes, pago });
export const confirmarVenda = (id: string, ok: boolean) => chatApi<{ status: string }>({ acao: 'compra_confirmar', id, ok });
export const listarProgramas = () => chatApi<{ programas: Programa[]; codigo: string; recebePix: boolean }>({ acao: 'programa_listar' });
export const salvarPrograma = (p: Partial<Programa>) => chatApi<{ id: string }>({ acao: 'programa_salvar', ...p });
export const apagarPrograma = (id: string) => chatApi({ acao: 'programa_apagar', id });
export const comprar = (programa: string) => chatApi<{ compra: Compra; pix: Omit<PixCoach, 'valor' | 'vencimento'>; coach: string }>({ acao: 'compra_criar', programa });
export const avisarCompra = (id: string) => chatApi<{ status: string }>({ acao: 'compra_avisar', id });
export const minhasCompras = () => chatApi<{ compras: Compra[] }>({ acao: 'compras_minhas' }).then((r) => r.compras);
export const pendencias = () => chatApi<{ coach: string | null; anamnese: 'pendente' | 'respondida' | null; mensalidade: { valor: number; vencimento: number; dias: number; avisou: boolean } | null }>({ acao: 'aluno_pendencias' });

// Página pública do coach (o que ele escolheu mostrar).
export interface CoachPublico { nome: string; foto: string; recebePix: boolean; marca?: { nome: string; cor: string; logo: string } | null; bio?: string; whats?: string; alunos?: number; codigo?: string }
// Loja pública: sem login.
export async function verLoja(codigo: string): Promise<{ coach: CoachPublico; programas: ProgramaPublico[] }> {
  const base = (import.meta.env.VITE_NEXIA_API_URL as string | undefined) || '';
  const r = await fetch(`${base}/api/body-coach-chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'loja_ver', codigo }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Loja indisponível agora.');
  return d;
}
export const linkDaLoja = (codigo: string) => `${location.origin}${import.meta.env.BASE_URL}loja/${codigo}`;
