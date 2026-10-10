// Coach por voz durante o treino: fala o exercício, a carga sugerida, conta o descanso e incentiva.
// Usa a voz do próprio celular (grátis, funciona sem internet). O aluno liga e desliga.

const CHAVE = 'bc_voz_coach';

export function vozLigada(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}
export function definirVoz(ligada: boolean) {
  try { localStorage.setItem(CHAVE, ligada ? '1' : '0'); } catch { /* sem armazenamento */ }
}
export const vozDisponivel = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function falar(texto: string, forcar = false) {
  if ((!forcar && !vozLigada()) || !vozDisponivel()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 1.05;
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
    if (voz) u.voice = voz;
    window.speechSynthesis.speak(u);
  } catch { /* sem voz */ }
}

const kg = (n: number) => `${String(n).replace('.', ',')} quilos`;

export function fraseExercicio(nome: string, series: number, reps: string, sugestao?: { weight: number; reps: number } | null): string {
  const base = `Agora: ${nome}. ${series} séries de ${reps.replace(/\s*[-–]\s*/, ' a ')} repetições.`;
  return sugestao ? `${base} Sugestão de carga: ${kg(sugestao.weight)}.` : base;
}

const INCENTIVOS = ['Boa! Mandou bem.', 'Isso aí, série no bolso.', 'Excelente execução.', 'Forte! Respira e recupera.', 'Mais uma vencida.', 'Show! Foco na próxima.'];

export function fraseSerie(n: number, total: number, carga: number, reps: number, recorde: boolean, descansoSeg: number): string {
  const inc = recorde ? 'Recorde pessoal! Parabéns!' : INCENTIVOS[(n + reps) % INCENTIVOS.length];
  const resta = total - n;
  const proxima = resta > 0 ? `Falta${resta > 1 ? 'm' : ''} ${resta} ${resta > 1 ? 'séries' : 'série'}.` : 'Última série feita deste exercício.';
  return `${inc} ${kg(carga)} vezes ${reps}. ${proxima} Descanso de ${descansoSeg} segundos.`;
}

export function fraseDescanso(seg: number): string | null {
  if (seg === 10) return 'Dez segundos. Prepare-se.';
  if (seg === 3) return 'Três, dois, um.';
  return null;
}
export const FRASE_FIM_DESCANSO = 'Bora! Próxima série.';
export const fraseFim = (min: number, kcal: number) => `Treino concluído! ${min} minutos e cerca de ${kcal} calorias. Você é constância pura.`;
