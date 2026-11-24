// Cadência (tempo sob tensão): o app apita e mostra cada fase da repetição, ex.: 3-1-1
// (3 s descendo, 1 s parado embaixo, 1 s subindo). Mais controle = mais músculo e menos lesão.

export interface Fase { nome: string; seg: number; tom: number }
export const CADENCIAS: { id: string; nome: string; fases: Fase[] }[] = [
  { id: '3-1-1', nome: '3-1-1 (hipertrofia)', fases: [{ nome: 'Desce', seg: 3, tom: 660 }, { nome: 'Segura', seg: 1, tom: 520 }, { nome: 'Sobe', seg: 1, tom: 880 }] },
  { id: '2-0-1', nome: '2-0-1 (normal)', fases: [{ nome: 'Desce', seg: 2, tom: 660 }, { nome: 'Sobe', seg: 1, tom: 880 }] },
  { id: '4-1-1', nome: '4-1-1 (controle total)', fases: [{ nome: 'Desce', seg: 4, tom: 660 }, { nome: 'Segura', seg: 1, tom: 520 }, { nome: 'Sobe', seg: 1, tom: 880 }] },
];

// Em que fase e repetição está, passados `ms` desde o início.
export function faseAgora(fases: Fase[], ms: number): { rep: number; fase: number; resta: number } {
  const ciclo = fases.reduce((s, f) => s + f.seg, 0) * 1000;
  const rep = Math.floor(ms / ciclo) + 1;
  let t = ms % ciclo;
  for (let i = 0; i < fases.length; i++) {
    const d = fases[i].seg * 1000;
    if (t < d) return { rep, fase: i, resta: Math.ceil((d - t) / 1000) };
    t -= d;
  }
  return { rep, fase: 0, resta: fases[0].seg };
}
