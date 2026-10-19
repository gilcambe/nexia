import type { Resumo } from "../meu-cortex/api";

export interface Grupo { rotulo: string; itens: Resumo[] }

const DIA = 86400000;

// Histórico estilo ChatGPT/Claude: Hoje, Ontem, Últimos 7 dias e Mais antigos (pela última atividade).
export function agruparPorData(itens: Resumo[], agora = new Date()): Grupo[] {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const grupos: Grupo[] = [
    { rotulo: "Hoje", itens: [] }, { rotulo: "Ontem", itens: [] }, { rotulo: "Últimos 7 dias", itens: [] }, { rotulo: "Mais antigos", itens: [] },
  ];
  for (const i of itens) {
    const t = new Date(i.quando).getTime();
    const k = t >= inicio ? 0 : t >= inicio - DIA ? 1 : t >= inicio - 7 * DIA ? 2 : 3;
    grupos[k].itens.push(i);
  }
  return grupos.filter((g) => g.itens.length);
}

// Modos de resposta: Rápido, Pensar, Pesquisar.
// O dono escolhe velocidade (Rápido), profundidade (Pensar) ou informação atualizada (Pesquisar).
// Todos os modelos do catálogo são da faixa gratuita: custo 0.
export type ModoResposta = 'rapido' | 'pensar' | 'pesquisar';

export const MODO_PADRAO: ModoResposta = 'rapido';

export interface ConfiguracaoResposta {
  modo: ModoResposta;
  descricao: string;
  modelo: string;
  contexto: string;
}

// Catálogo dos modos: modelo grátis de cada um + o recado que o modelo recebe.
export const MODOS: Record<ModoResposta, ConfiguracaoResposta> = {
  rapido: {
    modo: 'rapido',
    descricao: 'Resposta rápida e direta',
    modelo: 'groq_llama3_fast',
    contexto: 'Responda de forma curta, direta e prática. Sem enrolação.',
  },

