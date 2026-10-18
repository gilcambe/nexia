// Desafio 30 dias: 1 tarefa curta por dia. O progresso fica só no aparelho (localStorage bc_desafio30_<uid>).

export interface Desafio { id: string; nome: string; desc: string; icone: string; tarefas: string[] }
export interface ProgressoDesafio { id: string; inicio: string; feitos: number[] }
export type SituacaoDia = 'feito' | 'perdido' | 'hoje' | 'futuro';

export const DESAFIOS: Desafio[] = [
  {
    id: 'secar', nome: 'Secar', desc: 'Menos gordura com treino, passos e comida de verdade', icone: 'ri-fire-line',
    tarefas: [
      'Treino A + 2 L de água', 'Caminhada 30 min', 'Sem açúcar hoje', 'Treino B + 8 mil passos', 'Jantar sem fritura',
      'HIIT 15 min', 'Descanso ativo: alongar 15 min', 'Treino A + salada no almoço', 'Sem refrigerante hoje', 'Caminhada 40 min',
      'Treino B + 2,5 L de água', 'Prato com metade de vegetais', 'HIIT 20 min', 'Dormir 7 h ou mais', 'Treino A + 10 mil passos',
      'Sem doce depois do jantar', 'Escada: 10 min subindo', 'Treino B + proteína em todas as refeições', 'Caminhada 45 min', 'Alongar 15 min + 2 L de água',
      'HIIT 20 min + sem açúcar', 'Treino A completo', 'Café da manhã com proteína', 'Caminhada rápida 30 min', 'Treino B + 10 mil passos',
      'Nada de beliscar hoje', 'HIIT 25 min', 'Treino A + 3 L de água', 'Caminhada 50 min', 'Treino completo: você chegou!',
    ],
  },
  {
    id: 'forca', nome: 'Ganhar força', desc: 'Mais carga e mais músculo, com proteína e sono', icone: 'ri-boxing-line',
    tarefas: [
      'Treino A + 2 L de água', 'Treino B + proteína no café', '20 flexões ao longo do dia', 'Treino C', 'Descanso: dormir 8 h',
      'Treino A: suba 1 kg em um exercício', '30 agachamentos livres', 'Treino B + 3 refeições com proteína', 'Prancha 3 x 40 s', 'Treino C + 2,5 L de água',
      'Descanso ativo: caminhar 20 min', 'Treino A: anote todas as cargas', '30 flexões ao longo do dia', 'Treino B + creatina ou proteína', 'Treino C: 1 série a mais',
      'Alongar 15 min', 'Treino A + sono de 8 h', '40 agachamentos livres', 'Treino B: suba 1 kg', 'Prancha 3 x 50 s',
      'Treino C + 3 L de água', 'Descanso: mobilidade 15 min', 'Treino A: recorde em um exercício', '40 flexões ao longo do dia', 'Treino B completo',
      'Treino C + proteína em todas as refeições', 'Prancha 3 x 60 s', 'Treino A: teste sua carga máxima com cuidado', 'Treino B + 8 h de sono', 'Treino completo: você chegou!',
    ],
  },
  {
    id: 'mexer', nome: 'Mexer o corpo', desc: 'Para começar do zero: um pouco todo dia', icone: 'ri-walk-line',
    tarefas: [
      'Caminhada 15 min', 'Alongar 10 min', '10 agachamentos + 2 L de água', 'Caminhada 20 min', 'Subir escada 5 min',
      'Dançar 2 músicas', 'Caminhada 20 min + sem refrigerante', '15 agachamentos + 10 flexões na parede', 'Alongar 15 min', 'Caminhada 25 min',
      'Treino pronto em casa 15 min', '5 mil passos', 'Prancha 3 x 20 s', 'Caminhada 30 min', 'Dançar 4 músicas',
      'Treino pronto em casa 20 min', 'Alongar 15 min + 2 L de água', '6 mil passos', '20 agachamentos + 15 flexões na parede', 'Caminhada 30 min',
      'Bicicleta ou pular corda 10 min', 'Treino pronto em casa 20 min', '7 mil passos', 'Prancha 3 x 30 s', 'Caminhada 35 min',
      'Dançar 15 min', 'Treino pronto em casa 25 min', '8 mil passos', 'Caminhada 40 min', 'Treino completo: você chegou!',
    ],
  },
];

const chave = (uid: string) => `bc_desafio30_${uid}`;

export function hojeISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function lerProgresso(uid: string): ProgressoDesafio | null {
  try {
    const p = JSON.parse(localStorage.getItem(chave(uid)) || 'null') as ProgressoDesafio | null;
    if (!p || !DESAFIOS.some((d) => d.id === p.id) || !/^\d{4}-\d{2}-\d{2}$/.test(p.inicio)) return null;
    return { id: p.id, inicio: p.inicio, feitos: Array.isArray(p.feitos) ? p.feitos.filter((n) => Number.isInteger(n) && n >= 1 && n <= 30) : [] };
  } catch { return null; }
}

export function salvarProgresso(uid: string, p: ProgressoDesafio | null): void {
  try {
    if (p) localStorage.setItem(chave(uid), JSON.stringify(p));
    else localStorage.removeItem(chave(uid));
  } catch { /* sem armazenamento */ }
}

// Dia do desafio (1 a 30; passa de 30 quando acabou).
export function diaAtual(inicio: string, hoje = hojeISO()): number {
  return Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400000) + 1;
}

export function situacaoDia(dia: number, p: ProgressoDesafio, hoje = hojeISO()): SituacaoDia {
  if (p.feitos.includes(dia)) return 'feito';
  const atual = diaAtual(p.inicio, hoje);
  if (dia < atual) return 'perdido';
  return dia === atual ? 'hoje' : 'futuro';
}

// Dias seguidos feitos até hoje (se hoje ainda não foi feito, conta até ontem).
export function sequencia(p: ProgressoDesafio, hoje = hojeISO()): number {
  let d = Math.min(30, diaAtual(p.inicio, hoje));
  if (!p.feitos.includes(d)) d--;
  let n = 0;
  while (d >= 1 && p.feitos.includes(d)) { n++; d--; }
  return n;
}

export function marcarHoje(p: ProgressoDesafio, hoje = hojeISO()): ProgressoDesafio {
  const d = diaAtual(p.inicio, hoje);
  if (d < 1 || d > 30 || p.feitos.includes(d)) return p;
  return { ...p, feitos: [...p.feitos, d].sort((a, b) => a - b) };
}

export function temCertificado(p: ProgressoDesafio, hoje = hojeISO()): boolean {
  return diaAtual(p.inicio, hoje) >= 30 || p.feitos.length >= 25;
}

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

// Certificado 1080×1350 (feed do Instagram).
export async function desenharCertificado(c: HTMLCanvasElement, d: { nome: string; desafio: string; feitos: number; data: Date; link: string; logo?: string }): Promise<void> {
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 1080, 1350);
  g.addColorStop(0, '#0b0b0f');
  g.addColorStop(0.6, '#1a1208');
  g.addColorStop(1, '#f97316');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = 'rgba(249,115,22,0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(40, 40, 1000, 1270, 40);
  ctx.stroke();
  ctx.textAlign = 'center';
  const logo = d.logo ? await carregarImagem(d.logo) : null;
  if (logo) ctx.drawImage(logo, 450, 110, 180, 180);
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('BODY COACH', 540, 350);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 92px system-ui, sans-serif';
  ctx.fillText('Certificado', 540, 500);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText('Desafio 30 dias concluído por', 540, 590);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.fillText((d.nome || 'Atleta Body Coach').slice(0, 26), 540, 700);
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(`Desafio "${d.desafio}"`, 540, 810);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 120px system-ui, sans-serif';
  ctx.fillText(`${d.feitos}/30 dias`, 540, 970);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '36px system-ui, sans-serif';
  ctx.fillText(d.data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }), 540, 1050);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 38px system-ui, sans-serif';
  ctx.fillText('Faça o seu também:', 540, 1180);
  ctx.font = '34px system-ui, sans-serif';
  ctx.fillText(d.link.replace(/^https?:\/\//, '').split('/')[0], 540, 1235);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('@nexiabodycoach  #DesafioBodyCoach', 540, 1300);
  ctx.textAlign = 'left';
}
