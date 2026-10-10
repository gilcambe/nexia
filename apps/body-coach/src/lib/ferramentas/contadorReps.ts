// Contador de repetições pela câmera: ângulo de uma articulação (MediaPipe Pose) + máquina de estados com folga.
export interface P { x: number; y: number; visibility?: number }

export interface ExercicioCamera {
  id: string; nome: string; dica: string;
  juntas: [number, number, number][]; // [a, vértice, c] para lado esquerdo e direito
  estendido: number; // ângulo acima do qual a posição é "em cima / esticado"
  flexionado: number; // ângulo abaixo do qual a repetição foi completa
  parcial: number; // passou daqui mas não chegou ao flexionado = amplitude curta
}

export const EXERCICIOS_CAMERA: ExercicioCamera[] = [
  { id: 'agachamento', nome: 'Agachamento', dica: 'Celular no chão, de lado para você, corpo inteiro na tela.', juntas: [[23, 25, 27], [24, 26, 28]], estendido: 160, flexionado: 100, parcial: 135 },
  { id: 'flexao', nome: 'Flexão de braço', dica: 'Celular no chão, de lado, a 2 metros.', juntas: [[11, 13, 15], [12, 14, 16]], estendido: 150, flexionado: 95, parcial: 125 },
  { id: 'rosca', nome: 'Rosca bíceps', dica: 'De lado para a câmera, braço inteiro visível.', juntas: [[11, 13, 15], [12, 14, 16]], estendido: 145, flexionado: 60, parcial: 100 },
  { id: 'desenvolvimento', nome: 'Desenvolvimento de ombro', dica: 'De frente para a câmera, braços visíveis.', juntas: [[11, 13, 15], [12, 14, 16]], estendido: 150, flexionado: 95, parcial: 125 },
  { id: 'afundo', nome: 'Afundo', dica: 'De lado para a câmera, corpo inteiro na tela.', juntas: [[23, 25, 27], [24, 26, 28]], estendido: 160, flexionado: 105, parcial: 135 },
];

export function angulo(a: P, b: P, c: P): number {
  const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let g = Math.abs((r * 180) / Math.PI);
  if (g > 180) g = 360 - g;
  return g;
}

// Escolhe o lado mais visível e devolve o ângulo (ou null se o corpo não aparece).
export function anguloDoExercicio(ex: ExercicioCamera, pts: P[]): number | null {
  let melhor: { vis: number; ang: number } | null = null;
  for (const [a, b, c] of ex.juntas) {
    const pa = pts[a], pb = pts[b], pc = pts[c];
    if (!pa || !pb || !pc) continue;
    const vis = Math.min(pa.visibility ?? 1, pb.visibility ?? 1, pc.visibility ?? 1);
    if (vis < 0.5) continue;
    if (!melhor || vis > melhor.vis) melhor = { vis, ang: angulo(pa, pb, pc) };
  }
  return melhor?.ang ?? null;
}

export interface EstadoReps { reps: number; parciais: number; fase: 'cima' | 'descendo' | 'baixo'; menor: number; aviso: string }
export const estadoInicial = (): EstadoReps => ({ reps: 0, parciais: 0, fase: 'cima', menor: 180, aviso: '' });

// Uma repetição = sair de "esticado", passar do ângulo de "flexionado" e voltar a "esticado".
export function passo(e: EstadoReps, ang: number, ex: ExercicioCamera): EstadoReps {
  const n = { ...e, menor: Math.min(e.menor, ang) };
  if (e.fase === 'cima') {
    if (ang < ex.estendido - 10) return { ...n, fase: 'descendo', menor: ang, aviso: '' };
    return n;
  }
  if (ang <= ex.flexionado) n.fase = 'baixo';
  if (ang >= ex.estendido) {
    if (n.fase === 'baixo') return { ...n, reps: e.reps + 1, fase: 'cima', menor: 180, aviso: '' };
    if (n.menor <= ex.parcial) return { ...n, parciais: e.parciais + 1, fase: 'cima', menor: 180, aviso: 'Amplitude curta: desça mais!' };
    return { ...n, fase: 'cima', menor: 180 };
  }
  return n;
}
