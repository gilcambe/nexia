/**
 * Converte a resposta da IA (JSON da ficha lida de PDF/foto/texto) numa FichaCoach válida.
 * Atende ao pedido #4205.
 */
// Nunca lança erro: texto sem JSON ou sem exercício devolve null.
import { idDoNome, type DiaCoach, type ExercicioCoach, type FichaCoach } from './fichaCoach';

const texto = (v: unknown, padrao = ''): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : padrao);
const inteiro = (v: unknown, min: number, max: number, padrao: number): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
};

// Primeiro objeto {...} que é JSON válido (aceita cerca ```json e texto antes/depois).
function primeiroObjeto(t: string): Record<string, unknown> | null {
  const limpo = t.replace(/```(?:json)?/gi, '');
  for (let i = limpo.indexOf('{'); i !== -1; i = limpo.indexOf('{', i + 1)) {
    let nivel = 0;
    let emTexto = false;
    for (let j = i; j < limpo.length; j += 1) {
      const c = limpo[j];
      if (emTexto) {
        if (c === '\\') j += 1;
        else if (c === '"') emTexto = false;
      } else if (c === '"') emTexto = true;
      else if (c === '{') nivel += 1;
      else if (c === '}' && --nivel === 0) {
        try {
          const o = JSON.parse(limpo.slice(i, j + 1));
          if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>;
        } catch { /* tenta o próximo { */ }
        break;
      }
    }
  }
  return null;
}

export function fichaDoJson(resposta: string): FichaCoach | null {
  try {
    const o = primeiroObjeto(String(resposta ?? ''));
    if (!o) return null;
    const diasBrutos = Array.isArray(o.dias) ? o.dias : [];
    const dias: DiaCoach[] = [];
    for (const d of diasBrutos) {
      if (dias.length >= 7) break;
      if (!d || typeof d !== 'object') continue;
      const dd = d as Record<string, unknown>;
      const exercicios: ExercicioCoach[] = [];
      for (const e of Array.isArray(dd.exercicios) ? dd.exercicios : []) {
        if (exercicios.length >= 15) break;
        if (!e || typeof e !== 'object') continue;
        const ee = e as Record<string, unknown>;
        const nome = texto(ee.nome);
        if (!nome) continue;
        exercicios.push({
          id: idDoNome(nome),
          nome,
          grupo: texto(ee.grupo),
          series: inteiro(ee.series, 1, 10, 3),
          reps: texto(ee.reps, '10-12') || '10-12',
          descanso: inteiro(ee.descanso, 15, 600, 60),
          carga: texto(ee.carga),
          obs: texto(ee.obs),
        });
      }
      if (!exercicios.length) continue;
      dias.push({ titulo: texto(dd.titulo) || `Treino ${String.fromCharCode(65 + dias.length)}`, exercicios });
    }
    if (!dias.length) return null;
    return { nome: texto(o.nome) || 'Ficha importada', obs: texto(o.obs), dias };
  } catch {
    return null;
  }
}
