import type { FichaCoach, DiaCoach, ExercicioCoach } from './fichaCoach'
import { idDoNome } from './fichaCoach'

/**
 * Extrai o primeiro objeto JSON válido de um texto que pode conter markdown.
 * Normaliza os campos da ficha de acordo com as regras de negócio e devolve
 * `null` caso não haja exercícios ou o texto não contenha JSON válido.
 */
export function fichaDoJson(texto: string): FichaCoach | null {
  if (typeof texto !== 'string') return null

  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) return null

  let parsed: any
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.dias)) return null

  const dias: DiaCoach[] = parsed.dias
    .map((d: any, i: number) => {
      if (!d || !Array.isArray(d.exercicios)) return null
      const exercicios: ExercicioCoach[] = d.exercicios
        .filter((ex: any) => typeof ex.nome === 'string' && ex.nome.trim() !== '')
        .slice(0, 15)
        .map((ex: any) => ({
          id: idDoNome(ex.nome.trim()),
          nome: ex.nome.trim(),
          grupo: typeof ex.grupo === 'string' ? ex.grupo : '',
          series: Math.max(1, Math.min(10, typeof ex.series === 'number' ? ex.series : 3)),
          reps: typeof ex.reps === 'string' || typeof ex.reps === 'number' ? String(ex.reps) : '10',
          descanso: Math.max(15, Math.min(600, typeof ex.descanso === 'number' ? ex.descanso : 60)),
          carga: typeof ex.carga === 'string' ? ex.carga : '',
          obs: typeof ex.obs === 'string' ? ex.obs : '',
        }))
      return exercicios.length > 0
        ? { titulo: typeof d.titulo === 'string' && d.titulo.trim() ? d.titulo.trim() : `Treino ${String.fromCharCode(65 + i)}`, exercicios }
        : null
    })
    .filter((d): d is DiaCoach => !!d)
    .slice(0, 7)

  if (dias.length === 0) return null

  return {
    nome: typeof parsed.nome === 'string' && parsed.nome.trim() ? parsed.nome.trim() : 'Ficha importada',
    obs: typeof parsed.obs === 'string' ? parsed.obs : '',
    dias,
  }
}
