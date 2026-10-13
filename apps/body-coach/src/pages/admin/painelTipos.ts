// Dados do Painel do dono (ação dono_resumo e cupom_lista no servidor).
export interface Resumo {
  total: number;
  porTipo: { coach: number; aluno: number; independente: number };
  pagantes: number;
  emTeste: number;
  vencendo7: number;
  novosPorDia: { dia: string; n: number }[];
  ativosPorDia: { dia: string; n: number }[];
  receitaPorMes: { mes: string; valor: number }[];
  receitaMes: number;
}
export interface Cupom { codigo: string; pct: number; validoAte: number; maxUsos: number; usos: number }
export const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
