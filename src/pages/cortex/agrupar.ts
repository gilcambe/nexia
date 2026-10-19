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

// Tipos para os modos do composer
export type ModoComposer = 'rapido' | 'pensar' | 'pesquisar';

export interface ModoConfig {
  label: string;
  description: string;
  model: string;
}

export const MODO_CONFIG: Record<ModoComposer, ModoConfig> = {
  rapido: {
    label: "Rápido",
    description: "Resposta rápida com modelo pequeno",
    model: "groq_llama3_fast"
  },
  pensar: {
    label: "Pensar", 
    description: "Análise profunda com raciocínio",
    model: "or_deepseek_r1"
  },
  pesquisar: {
    label: "Pesquisar",
    description: "Busca na internet para respostas atualizadas",
    model: "perplexity_fast"
  }
};

// Função para obter o modelo padrão (mantém compatibilidade)
export function getModeloPadrao(): ModoComposer {
  return 'rapido'; // Padrão para não quebrar fluxo existente
}
