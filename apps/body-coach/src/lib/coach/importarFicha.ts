import { FichaCoach } from './fichaCoach';

export function fichaDoJson(texto: string): FichaCoach | null {
  if (!texto || typeof texto !== 'string') return null;
  try {
    let limpo = texto.trim();
    const matchMd = limpo.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (matchMd) {
      limpo = matchMd[1].trim();
    } else {
      const start = limpo.indexOf('{');
      const end = limpo.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        limpo = limpo.substring(start, end + 1);
      }
    }

    const data = JSON.parse(limpo);
    if (!data || typeof data !== 'object') return null;

    const nome = typeof data.nome === 'string' && data.nome.trim() ? data.nome.trim() : 'Ficha Importada';
    const obs = typeof data.obs === 'string' ? data.obs : '';
    
    let diasRaw = Array.isArray(data.dias) ? data.dias : [];
    if (diasRaw.length === 0 && Array.isArray(data.exercicios)) {
      diasRaw = [{ nome: 'Treino A', exercicios: data.exercicios }];
    }

    const dias = diasRaw.slice(0, 7).map((dia: any, dIdx: number) => {
      const diaNome = typeof dia.nome === 'string' && dia.nome.trim() ? dia.nome.trim() : `Dia ${dIdx + 1}`;
      const exerciciosRaw = Array.isArray(dia.exercicios) ? dia.exercicios : [];
      
      const exercicios = exerciciosRaw.slice(0, 20).map((ex: any) => {
        if (!ex || typeof ex !== 'object') return null;
        const exNome = typeof ex.nome === 'string' && ex.nome.trim() ? ex.nome.trim() : (typeof ex.name === 'string' ? ex.name.trim() : '');
        if (!exNome) return null;

        const id = ex.id || exNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const series = typeof ex.series === 'number' && ex.series > 0 ? ex.series : 3;
        const repeticoes = typeof ex.repeticoes === 'string' || typeof ex.repeticoes === 'number' ? String(ex.repeticoes) : '10';
        const descanso = typeof ex.descanso === 'number' ? ex.descanso : 60;

        return {
          id,
          nome: exNome,
          series,
          repeticoes,
          descanso,
          carga: typeof ex.carga === 'number' ? ex.carga : 0,
          obs: typeof ex.obs === 'string' ? ex.obs : ''
        };
      }).filter(Boolean);

      return {
        nome: diaNome,
        exercicios
      };
    }).filter((d: any) => d.exercicios.length > 0);

    if (dias.length === 0) return null;

    return {
      nome,
      obs,
      dias,
      em: Date.now()
    };
  } catch (e) {
    return null;
  }
}
