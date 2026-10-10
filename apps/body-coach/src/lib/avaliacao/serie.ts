// Série de avaliações do aluno, já completas e calculadas, da mais antiga para a mais recente.
import type { ProgressEntry } from '@/hooks/useProgressData';
import { achatar, calcular, type Avaliacao, type Resultado } from './calculos.ts';
import { avaliacaoDoRegistro, completar, fotosDoRegistro, type Fotos, type PerfilAvaliacao } from './dados.ts';

export interface ItemSerie {
  id: number;
  data: string;
  av: Avaliacao;
  res: Resultado;
  m: Record<string, number>;
  fotos: Fotos;
  registro: ProgressEntry;
}

export function montarSerie(entries: ProgressEntry[], perfil: PerfilAvaliacao): ItemSerie[] {
  return entries
    .map((e) => {
      const av = completar(avaliacaoDoRegistro(e), perfil);
      const res = calcular(av);
      return { id: e.id, data: av.data, av, res, m: achatar(av, res), fotos: fotosDoRegistro(e), registro: e };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
}
