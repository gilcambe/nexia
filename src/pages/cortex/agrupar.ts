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

// Modos de resposta: Rápido, Pensar, Pesquisar
export type ModoResposta = 'rapido' | 'pensar' | 'pesquisar';

export interface ConfiguracaoResposta {
  modo: ModoResposta;
  descricao: string;
  modelo: string;
  contexto: string;
}
