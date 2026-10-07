import { Session } from '@/mocks/workout';

/**
 * Move um exercício de um índice para outro na sessão, de forma imutável.
 * Se os índices estiverem fora dos limites, retorna a sessão original (ou cópia rasa/profunda sem alteração).
 */
export function moverExercicio(session: Session, de: number, para: number): Session {
  const exercises = [...session.exercises];
  if (
    de < 0 ||
    de >= exercises.length ||
    para < 0 ||
    para >= exercises.length
  ) {
    return session;
  }
  const [removed] = exercises.splice(de, 1);
  exercises.splice(para, 0, removed);
  return {
    ...session,
    exercises,
  };
}

/**
 * Reordena os exercícios para que o exercício especificado por ID ou índice vá para o início da sessão.
 */
export function comecarPor(session: Session, exercicioIdOrIndex: string | number): Session {
  const exercises = [...session.exercises];
  let index = -1;
  if (typeof exercicioIdOrIndex === 'number') {
    index = exercicioIdOrIndex;
  } else {
    index = exercises.findIndex(
      (ex) =>
        ex.id === exercicioIdOrIndex ||
        ex.name.toLowerCase() === exercicioIdOrIndex.toLowerCase()
    );
  }

  if (index < 0 || index >= exercises.length) {
    return session;
  }

  const [removed] = exercises.splice(index, 1);
  exercises.unshift(removed);
  return {
    ...session,
    exercises,
  };
}
