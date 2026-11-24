// Resumo curto da ficha e dos últimos treinos para a IA do coach.
// O servidor corta o contexto em 3.000 letras: por isso cada parte tem limite próprio. Nunca lança erro.

type Obj = Record<string, unknown>;
const ehObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const txt = (x: unknown) => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '');

export function resumoFicha(f: unknown, limite = 900): string | null {
  if (!ehObj(f) || !Array.isArray(f.dias) || !f.dias.length) return null;
  const cabeca = [txt(f.nome), txt(f.coach) ? `(${txt(f.coach)})` : ''].filter(Boolean).join(' ');
  const dias = f.dias.filter(ehObj).map((d) => {
    const ex = (Array.isArray(d.exercicios) ? d.exercicios : []).filter(ehObj).slice(0, 8)
      .map((x) => `${txt(x.nome)} ${txt(x.series)}x${txt(x.reps)}${txt(x.carga) ? ` ${txt(x.carga)}` : ''}`.trim());
    return `${txt(d.titulo) || 'Treino'}: ${ex.join(', ')}`;
  });
  const s = [cabeca, ...dias].filter(Boolean).join(' | ');
  return s.length > limite ? `${s.slice(0, limite - 1)}…` : s;
}

export function resumoTreinos(lista: unknown, n = 5): string[] {
  if (!Array.isArray(lista)) return [];
  return lista.filter(ehObj)
    .filter((w) => txt(w.done_at))
    .sort((a, b) => txt(b.done_at).localeCompare(txt(a.done_at)))
    .slice(0, n)
    .map((w) => {
      const d = new Date(txt(w.done_at));
      const data = Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const partes = [
        txt(w.duration_min) && `${txt(w.duration_min)} min`,
        txt(w.sets) && `${txt(w.sets)} séries`,
        Number(w.volume_kg) > 0 && `${txt(w.volume_kg)} kg`,
        Number(w.esforco) > 0 && `esforço ${txt(w.esforco)}/5`,
        txt(w.comentario) && `disse: "${txt(w.comentario).slice(0, 80)}"`,
      ].filter(Boolean);
      return `${data} ${txt(w.title) || 'Treino'}${partes.length ? `: ${partes.join(', ')}` : ''}`.trim();
    });
}
