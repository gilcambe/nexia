import type { FichaCoach, DiaCoach, ExercicioCoach } from './fichaCoach';

function idDoNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'exercicio';
}

export function fichaDoJson(texto: string): FichaCoach | null {
  if (!texto || typeof texto !== 'string') return null;

  try {
    let limpo = texto.trim();

    // Tentar extrair de blocos de markdown ```json ... ``` ou ``` ... ```
    const matchMarkdown = limpo.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (matchMarkdown && matchMarkdown[1]) {
      limpo = matchMarkdown[1].trim();
    } else {
      // Se não achou bloco de código, tentar achar o primeiro '{' e o último '}'
      const inicio = limpo.indexOf('{');
      const fim = limpo.lastIndexOf('}');
      if (inicio !== -1 && fim !== -1 && fim > inicio) {
        limpo = limpo.substring(inicio, fim + 1);
      }
    }

    const obj = JSON.parse(limpo);
    if (!obj || typeof obj !== 'object') return null;

    const nome = typeof obj.nome === 'string' && obj.nome.trim() ? obj.nome.trim() : 'Ficha Importada';
    const obs = typeof obj.obs === 'string' ? obj.obs : '';
    const coach = typeof obj.coach === 'string' ? obj.coach : undefined;
    const em = typeof obj.em === 'number' ? obj.em : Date.now();

    let diasBrutos: any[] = [];
    if (Array.isArray(obj.dias)) {
      diasBrutos = obj.dias;
    } else if (Array.isArray(obj.exercicios)) {
      // Caso venha uma lista direta de exercícios sem dias definidos
      diasBrutos = [{ dia: 'Treino A', exercicios: obj.exercicios }];
    } else {
      return null;
    }

    const diasProcessados: DiaCoach[] = [];

    for (const d of diasBrutos.slice(0, 7)) {
      if (!d || typeof d !== 'object') continue;
      const diaNome = typeof d.dia === 'string' && d.dia.trim() ? d.dia.trim() : `Dia ${diasProcessados.length + 1}`;
      
      let exBrutos: any[] = [];
      if (Array.isArray(d.exercicios)) {
        exBrutos = d.exercicios;
      } else if (Array.isArray(d.itens)) {
        exBrutos = d.itens;
      }

      const exerciciosProcessados: ExercicioCoach[] = [];

      for (const ex of exBrutos.slice(0, 30)) {
        if (!ex || typeof ex !== 'object') continue;
        const exNome = typeof ex.nome === 'string' && ex.nome.trim() ? ex.nome.trim() : (typeof ex.exercicio === 'string' ? ex.exercicio.trim() : '');
        if (!exNome) continue;

        const id = typeof ex.id === 'string' && ex.id.trim() ? ex.id.trim() : idDoNome(exNome);
        const series = typeof ex.series === 'number' && ex.series > 0 ? Math.floor(ex.series) : 3;
        const reps = typeof ex.reps === 'string' && ex.reps.trim() ? ex.reps.trim() : (typeof ex.repeticoes === 'string' ? ex.repeticoes.trim() : '10');
        const carga = typeof ex.carga === 'string' ? ex.carga : (typeof ex.peso === 'string' ? ex.peso : '');
        const descanso = typeof ex.descanso === 'number' ? ex.descanso : 60;
        const obsEx = typeof ex.obs === 'string' ? ex.obs : (typeof ex.observacao === 'string' ? ex.observacao : '');

        exerciciosProcessados.push({
          id,
          nome: exNome,
          series,
          reps,
          carga,
          descanso,
          obs: obsEx,
        });
      }

      if (exerciciosProcessados.length > 0) {
        diasProcessados.push({
          dia: diaNome,
          exercicios: exerciciosProcessados,
        });
      }
    }

    if (diasProcessados.length === 0) return null;

    const ficha: FichaCoach = {
      nome,
      obs,
      dias: diasProcessados,
      coach,
      em,
    };

    return ficha;
  } catch (e) {
    return null;
  }
}
