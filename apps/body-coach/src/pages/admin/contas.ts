import { dataCurta } from '@/lib/acesso';

// Contas do admin: tipos, filtros e o texto da situação de cada conta.
export interface Conta { uid: string; email: string; tipo: 'coach' | 'aluno' | 'independente'; inicio: number; gratisAte: number; pagoAte: number; cobertoAte: number; faixa: number; plano: string; isento: boolean }
export type Filtro = 'todos' | 'coach' | 'aluno' | 'independente' | 'vence' | 'sem' | 'pagantes';
export const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['coach', 'Coaches'], ['aluno', 'Alunos'], ['independente', 'Sem coach'], ['vence', 'Vence em 7 dias'], ['sem', 'Sem acesso'], ['pagantes', 'Pagantes']];
export const tipoNome = { coach: 'Coach', aluno: 'Aluno', independente: 'Sem coach' } as const;
const DIA = 86400000;
// Até quando a conta usa o Premium (teste, pago ou 7 dias depois que o coach parou de cobrir).
export const fimDoAcesso = (c: Conta) => Math.max(c.gratisAte, c.pagoAte, c.cobertoAte ? c.cobertoAte + 7 * DIA : 0);
export function passaNoFiltro(c: Conta, filtro: Filtro, agora: number) {
  const fim = fimDoAcesso(c);
  return filtro === 'todos' || c.tipo === filtro
    || (filtro === 'vence' && fim > agora && fim - agora < 7 * DIA)
    || (filtro === 'sem' && c.tipo !== 'coach' && !c.isento && fim <= agora)
    || (filtro === 'pagantes' && c.pagoAte > agora);
}
export function situacaoDa(c: Conta, agora: number) {
  const fim = (x: Conta) => fimDoAcesso(x);
  return c.isento ? 'Isento' : c.pagoAte > agora ? `Pago até ${dataCurta(c.pagoAte)}${c.tipo === 'coach' && c.faixa ? ` · até ${c.faixa >= 9999 ? 'ilimitados' : c.faixa} alunos` : ''}` : c.gratisAte > agora ? `Teste até ${dataCurta(c.gratisAte)}` : c.tipo === 'coach' ? 'Grátis (até 3 alunos)' : c.cobertoAte && fim(c) > agora ? 'Coberto pelo coach' : 'Sem acesso Premium';
}
