import type { FichaCoach } from './fichaCoach'
import { idDoNome } from '@/utils/id'

/**
 * Extrai o primeiro objeto JSON válido de um texto que pode conter markdown.
 * Normaliza os campos da ficha de acordo com as regras de negócio e devolve
 * `null` caso não haja exercícios ou o texto não contenha JSON válido.
 *
 * Regras de normalização:
 * - `nome` padrão: "Ficha sem nome" caso esteja ausente ou vazio.
 * - `limiteDias` máximo: 30 (se o valor fornecido for maior, será truncado).
 * - `limiteExercicios` máximo: 100 (se o valor fornecido for maior, será truncado).
 * - Cada exercício deve possuir `serie`, `repeticoes` e `descanso`.
 *   Caso falte, usa-se os defaults: `serie = 3`, `repeticoes = 10`, `descanso = 60`.
 * - O `id` de cada exercício é gerado via `idDoNome(nomeDoExercicio)`.
 * - Itens incompletos (sem nome) são descartados.
 * - Se após a filtragem não houver nenhum exercício, retorna `null`.
 */
export function fichaDoJson(texto: string): FichaCoach | null {
  // 1. Encontrar o primeiro bloco JSON (ignorando markdown delimitadores)
  const jsonMatch = texto.match(/\{[^]*?\}/)
  if (!jsonMatch) return null
  const raw = jsonMatch[0]

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    // JSON inválido
    return null
  }

  // 2. Normalizar campos principais da ficha
  const nome = typeof parsed.nome === 'string' && parsed.nome.trim() !== ''
    ? parsed.nome.trim()
    : 'Ficha sem nome'

  const limiteDias = typeof parsed.limiteDias === 'number'
    ? Math.min(parsed.limiteDias, 30)
    : 30

  const limiteExercicios = typeof parsed.limiteExercicios === 'number'
    ? Math.min(parsed.limiteExercicios, 100)
    : 100

  // 3. Processar lista de exercícios
  const rawExercicios = Array.isArray(parsed.exercicios) ? parsed.exercicios : []
  const exercicios = rawExercicios
    .filter((ex: any) => typeof ex.nome === 'string' && ex.nome.trim() !== '')
    .slice(0, limiteExercicios)
    .map((ex: any) => {
      const nomeEx = ex.nome.trim()
      return {
        id: idDoNome(nomeEx),
        nome: nomeEx,
        serie: typeof ex.serie === 'number' ? ex.serie : 3,
        repeticoes: typeof ex.repeticoes === 'number' ? ex.repeticoes : 10,
        descanso: typeof ex.descanso === 'number' ? ex.descanso : 60,
      }
    })

  if (exercicios.length === 0) return null

  const ficha: FichaCoach = {
    id: idDoNome(nome),
    nome,
    limiteDias,
    limiteExercicios,
    exercicios,
  }

  return ficha
}
