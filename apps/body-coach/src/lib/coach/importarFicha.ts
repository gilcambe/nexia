import { type FichaCoach } from './fichaCoach.ts';

// ID consistente para exercícios: o nome limpo e minúsculo.
export function idDoNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function fichaDoJson(texto: string): FichaCoach | null {
  try {
    // Tenta achar o primeiro { ... } na string
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const json = JSON.parse(match[0]);

    if (!json || typeof json !== 'object' || !Array.isArray(json.dias)) return null;

    const novaFicha: FichaCoach = {
      nome: typeof json.nome === 'string' && json.nome.trim() ? json.nome.trim() : 'Ficha importada',
      obs: typeof json.obs === 'string' ? json.obs.trim() : '',
      dias: []
    };

    const dias = json.dias.slice(0, 7);
    for (let i = 0; i < dias.length; i++) {
      const d = dias[i];
      if (!d || !Array.isArray(d.exercicios)) continue;

      const exerciciosValidos = d.exercicios
        .filter((ex: any) => typeof ex.nome === 'string' && ex.nome.trim())
        .slice(0, 15)
        .map((ex: any) => ({
          id: idDoNome(ex.nome.trim()),
          nome: ex.nome.trim(),
          grupo: typeof ex.grupo === 'string' ? ex.grupo.trim() : '',
          series: Math.max(1, Math.min(10, parseInt(ex.series) || 3)),
          reps: String(ex.reps || '10-12'),
          descanso: Math.max(15, Math.min(600, parseInt(ex.descanso) || 60)),
          carga: typeof ex.carga === 'string' ? ex.carga.trim() : '',
          obs: typeof ex.obs === 'string' ? ex.obs.trim() : ''
        }));

      if (exerciciosValidos.length > 0) {
        novaFicha.dias.push({
          titulo: (typeof d.titulo === 'string' && d.titulo.trim()) ? d.titulo.trim() : `Treino ${String.fromCharCode(65 + i)}`,
          exercicios: exerciciosValidos
        });
      }
    }

    return novaFicha.dias.length > 0 ? novaFicha : null;
  } catch {
    return null;
  }
}
