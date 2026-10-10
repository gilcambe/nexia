// Corpo realista que o aluno escolhe: sexo, tom de pele e biotipo. As fotos (geradas com IA de imagem
// grátis) ficam em public/imagens/corpos/{sexo}-{pele}-{biotipo}-{vista}.jpg. Puro.
export type SexoAvatar = 'm' | 'f';
export type Pele = 'clara' | 'media' | 'morena' | 'negra';
export type Biotipo = 'magro' | 'medio' | 'alto';
export type VistaCorpo = 'frente' | 'lado' | 'costas';

export interface Avatar { sexo: SexoAvatar; pele: Pele; biotipo: Biotipo | 'auto' }

export const PELES: { id: Pele; nome: string; cor: string }[] = [
  { id: 'clara', nome: 'Clara', cor: '#f1c9a5' },
  { id: 'media', nome: 'Média', cor: '#d9a066' },
  { id: 'morena', nome: 'Morena', cor: '#a8693d' },
  { id: 'negra', nome: 'Negra', cor: '#5b3a24' },
];
export const BIOTIPOS: { id: Biotipo | 'auto'; nome: string }[] = [
  { id: 'auto', nome: 'Pela gordura' },
  { id: 'magro', nome: 'Definido' },
  { id: 'medio', nome: 'Médio' },
  { id: 'alto', nome: 'Acima do peso' },
];

// Biotipo pelo % de gordura (faixas diferentes para homem e mulher).
export function biotipoPelaGordura(sexo: SexoAvatar, gordura: number | null | undefined): Biotipo {
  const g = gordura ?? (sexo === 'm' ? 18 : 26);
  const [a, b] = sexo === 'm' ? [14, 23] : [22, 31];
  return g < a ? 'magro' : g < b ? 'medio' : 'alto';
}

export function avatarPadrao(sexo: 'M' | 'F' | null | undefined): Avatar {
  return { sexo: sexo === 'F' ? 'f' : 'm', pele: 'media', biotipo: 'auto' };
}

export function lerAvatar(v: unknown, sexo: 'M' | 'F' | null | undefined): Avatar {
  const base = avatarPadrao(sexo);
  if (!v || typeof v !== 'object') return base;
  const o = v as Partial<Avatar>;
  return {
    sexo: o.sexo === 'f' || o.sexo === 'm' ? o.sexo : base.sexo,
    pele: PELES.some((p) => p.id === o.pele) ? (o.pele as Pele) : base.pele,
    biotipo: BIOTIPOS.some((b) => b.id === o.biotipo) ? (o.biotipo as Avatar['biotipo']) : 'auto',
  };
}

export function chaveImagem(a: Avatar, gordura: number | null | undefined, vista: VistaCorpo): string {
  const b = a.biotipo === 'auto' ? biotipoPelaGordura(a.sexo, gordura) : a.biotipo;
  return `${a.sexo}-${a.pele}-${b}-${vista}`;
}
