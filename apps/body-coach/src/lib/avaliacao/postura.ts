// Checagem de postura pelas fotos: a partir dos pontos do corpo (MediaPipe Pose, roda no próprio celular,
// grátis) mede inclinação dos ombros, do quadril e da cabeça na foto de frente/costas, e cabeça e ombros
// à frente nas fotos de lado. Não é diagnóstico: é um alerta simples para levar ao coach ou fisioterapeuta.
import type { Pose } from './dados.ts';

export interface Ponto { x: number; y: number; visibility?: number }

// Índices do MediaPipe Pose (33 pontos)
export const P = {
  nariz: 0, orelhaE: 7, orelhaD: 8, ombroE: 11, ombroD: 12, quadrilE: 23, quadrilD: 24, joelhoE: 25, joelhoD: 26, tornozeloE: 27, tornozeloD: 28,
} as const;

export interface Achado {
  id: 'ombros' | 'quadril' | 'cabeca_inclinada' | 'cabeca_frente' | 'ombros_frente';
  pose: Pose;
  ok: boolean;
  titulo: string;
  detalhe: string;
  dica?: string;
  valor: number; // graus ou % do tronco
}

const graus = (a: Ponto, b: Ponto, w: number, h: number) => (Math.atan2((b.y - a.y) * h, (b.x - a.x) * w) * 180) / Math.PI;
const visivel = (...ps: (Ponto | undefined)[]) => ps.every((p) => p && (p.visibility ?? 1) > 0.5);
const r1 = (n: number) => Math.round(n * 10) / 10;

// Inclinação de uma linha horizontal (ombros, quadril) em graus; positivo = lado esquerdo da pessoa mais baixo.
// Na foto de frente o lado esquerdo da pessoa fica à direita da imagem; nas costas, à esquerda.
function inclinacao(esq: Ponto, dir: Ponto, w: number, h: number): number {
  const [a, b] = esq.x < dir.x ? [esq, dir] : [dir, esq];
  let ang = graus(a, b, w, h);
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  // ang > 0: o ponto da direita da imagem está mais baixo
  const esqNaDireita = esq.x > dir.x;
  return esqNaDireita ? ang : -ang;
}

export function analisarPostura(pose: Pose, pts: Ponto[], largura: number, altura: number): Achado[] {
  const out: Achado[] = [];
  const g = (i: number) => pts[i];
  if (pose === 'frente' || pose === 'costas') {
    const [oe, od, qe, qd, ae, ad] = [g(P.ombroE), g(P.ombroD), g(P.quadrilE), g(P.quadrilD), g(P.orelhaE), g(P.orelhaD)];
    if (visivel(oe, od)) {
      const v = r1(inclinacao(oe, od, largura, altura));
      const lado = v > 0 ? 'esquerdo' : 'direito';
      const ok = Math.abs(v) <= 2.5;
      out.push({
        id: 'ombros', pose, ok, valor: v,
        titulo: ok ? 'Ombros alinhados' : `Ombro ${lado} mais baixo`,
        detalhe: `Inclinação de ${Math.abs(v).toLocaleString('pt-BR')}° (até 2,5° é normal).`,
        dica: ok ? undefined : `Remada unilateral e elevação de ombros com o lado ${lado}; alongar o trapézio do outro lado.`,
      });
    }
    if (visivel(qe, qd)) {
      const v = r1(inclinacao(qe, qd, largura, altura));
      const lado = v > 0 ? 'esquerdo' : 'direito';
      const ok = Math.abs(v) <= 2.5;
      out.push({
        id: 'quadril', pose, ok, valor: v,
        titulo: ok ? 'Quadril alinhado' : `Quadril mais baixo do lado ${lado}`,
        detalhe: `Inclinação de ${Math.abs(v).toLocaleString('pt-BR')}° (até 2,5° é normal).`,
        dica: ok ? undefined : 'Prancha lateral, elevação pélvica com uma perna e alongar o quadrado lombar do lado mais alto. Se persistir, vale um fisioterapeuta.',
      });
    }
    if (pose === 'frente' && visivel(ae, ad)) {
      const v = r1(inclinacao(ae, ad, largura, altura));
      const ok = Math.abs(v) <= 4;
      out.push({
        id: 'cabeca_inclinada', pose, ok, valor: v,
        titulo: ok ? 'Cabeça reta' : `Cabeça inclinada para o lado ${v > 0 ? 'esquerdo' : 'direito'}`,
        detalhe: `Inclinação de ${Math.abs(v).toLocaleString('pt-BR')}° (até 4° é normal).`,
        dica: ok ? undefined : 'Alongar o pescoço do lado oposto e conferir a altura da tela do celular/computador.',
      });
    }
  } else {
    // De lado: usa o lado que está virado para a câmera (mais visível).
    const lado = (g(P.ombroE)?.visibility ?? 0) >= (g(P.ombroD)?.visibility ?? 0) ? 'E' : 'D';
    const orelha = g(lado === 'E' ? P.orelhaE : P.orelhaD);
    const ombro = g(lado === 'E' ? P.ombroE : P.ombroD);
    const quadril = g(lado === 'E' ? P.quadrilE : P.quadrilD);
    const nariz = g(P.nariz);
    if (visivel(orelha, ombro, quadril, nariz)) {
      const frente = Math.sign((nariz.x - orelha.x) * largura) || 1; // para onde a pessoa olha
      const tronco = Math.hypot((ombro.x - quadril.x) * largura, (ombro.y - quadril.y) * altura) || 1;
      const cab = r1((((orelha.x - ombro.x) * largura * frente) / tronco) * 100);
      const okC = cab <= 12;
      out.push({
        id: 'cabeca_frente', pose, ok: okC, valor: cab,
        titulo: okC ? 'Cabeça alinhada com os ombros' : 'Cabeça projetada à frente',
        detalhe: `Orelha ${Math.abs(cab).toLocaleString('pt-BR')}% do tronco ${cab >= 0 ? 'à frente' : 'atrás'} do ombro (até 12% é normal).`,
        dica: okC ? undefined : 'Retração de queixo (chin tuck) 3x10 por dia, face pull e alongar o peitoral.',
      });
      const omb = r1((((ombro.x - quadril.x) * largura * frente) / tronco) * 100);
      const okO = omb <= 10;
      out.push({
        id: 'ombros_frente', pose, ok: okO, valor: omb,
        titulo: okO ? 'Tronco alinhado' : 'Ombros e tronco à frente do quadril',
        detalhe: `Ombro ${Math.abs(omb).toLocaleString('pt-BR')}% do tronco ${omb >= 0 ? 'à frente' : 'atrás'} do quadril (até 10% é normal).`,
        dica: okO ? undefined : 'Face pull, rotação externa com elástico e alongar o peitoral; fortalecer o meio das costas.',
      });
    }
  }
  return out;
}

// Junta os achados das 4 fotos: um item por tipo, o pior caso primeiro.
export function resumoPostura(achados: Achado[]): Achado[] {
  const melhor = new Map<string, Achado>();
  for (const a of achados) {
    const atual = melhor.get(a.id);
    if (!atual || (!a.ok && (atual.ok || Math.abs(a.valor) > Math.abs(atual.valor)))) melhor.set(a.id, a);
  }
  return [...melhor.values()].sort((a, b) => Number(a.ok) - Number(b.ok));
}
