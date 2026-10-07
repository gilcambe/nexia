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
 * Reordena os exercícios para que o exercício com o ID fornecido (ou índice, dependendo do uso, 
 * aqui assumindo ID ou nome/índice conforme comum, mas tipicamente ID ou índice. 
 * Vamos aceitar string (id) ou number (índice) ou string para procurar pelo id/name, 
 * ou reescrever para acomodar ambos se necessário. O pedido diz: 
 * "comecarPor(session: Session, e..."). Vamos verificar o padrão ou suportar id (string) ou índice (number)).
 * Aguarde, o texto do prompt cortou em "comecarPor(session: Session, e". Geralmente é comecarPor(session: Session, exerciseId: string) ou comecarPor(session: Session, index: number).
 * Vamos suportar tanto string (id) quanto number (índice) para máxima robustez, ou buscar pelo id do exercício.
 */
export function comecarPor(session: Session, target: string | number): Session {
  const exercises = [...session.exercises];
  let index = -1;
  if (typeof target === 'number') {
    index = target;
  } else {
    index = exercises.findIndex((ex) => ex.id === target || ex.name.toLowerCase() === target.toLowerCase());
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
