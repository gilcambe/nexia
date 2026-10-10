// Campos de uma avaliação física (antropometria + bioimpedância), com os nomes que cada
// sistema usa. Os sinônimos servem para o importador achar o campo certo em PDFs de balança
// (Tanita, InBody, Omron...), relatórios de nutricionista (paciente.me, Dietbox...) e planilhas.
// Sem dependências: o mesmo arquivo roda no navegador e nos testes do Node.

// 'laudo': valores que o laudo já trouxe calculados pelas dobras (o app recalcula; ficam de reserva).
export type Grupo = 'basico' | 'dobras' | 'circ' | 'diametros' | 'bio' | 'laudo';

export interface Campo {
  key: string;
  grupo: Grupo;
  label: string;
  unidade: string;
  // Textos (sem acento, minúsculos) que identificam o campo. O mais longo vence.
  sinonimos: string[];
  // Faixa plausível: valores fora dela são descartados na importação.
  min: number;
  max: number;
}

const c = (key: string, grupo: Grupo, label: string, unidade: string, min: number, max: number, sinonimos: string[]): Campo => ({
  key, grupo, label, unidade, min, max, sinonimos,
});

export const CAMPOS: Campo[] = [
  // Básico
  c('peso', 'basico', 'Peso', 'kg', 20, 350, ['peso atual', 'peso corporal', 'peso', 'weight', 'body weight', 'massa corporal total']),
  c('altura', 'basico', 'Altura', 'cm', 90, 240, ['altura atual', 'altura', 'estatura', 'height']),
  c('idade', 'basico', 'Idade', 'anos', 5, 110, ['idade', 'age']),

  // Dobras cutâneas (mm)
  c('tricipital', 'dobras', 'Tricipital', 'mm', 1, 80, ['dobra tricipital', 'tricipital', 'triceps skinfold', 'triceps']),
  c('bicipital', 'dobras', 'Bicipital', 'mm', 1, 80, ['dobra bicipital', 'bicipital', 'biceps skinfold']),
  c('subescapular', 'dobras', 'Subescapular', 'mm', 1, 80, ['dobra subescapular', 'subescapular', 'subscapular']),
  c('peitoral', 'dobras', 'Peitoral / torácica', 'mm', 1, 80, ['dobra toracica', 'dobra peitoral', 'toracica', 'peitoral', 'chest skinfold', 'pectoral']),
  c('axilar_media', 'dobras', 'Axilar média', 'mm', 1, 80, ['dobra axilar media', 'axilar media', 'midaxillary', 'axilar']),
  c('suprailiaca', 'dobras', 'Suprailíaca', 'mm', 1, 80, ['dobra suprailiaca', 'dobra supra iliaca', 'suprailiaca', 'supra iliaca', 'suprailiac']),
  c('supraespinhal', 'dobras', 'Supraespinhal', 'mm', 1, 80, ['dobra supraespinhal', 'supraespinhal', 'supraspinale']),
  c('abdominal', 'dobras', 'Abdominal', 'mm', 1, 90, ['dobra abdominal', 'abdominal skinfold']),
  c('coxa', 'dobras', 'Coxa', 'mm', 1, 90, ['dobra da coxa', 'dobra coxa', 'thigh skinfold']),
  c('panturrilha_dobra', 'dobras', 'Panturrilha', 'mm', 1, 80, ['dobra da panturrilha', 'dobra panturrilha', 'calf skinfold']),

  // Circunferências (cm)
  c('pescoco', 'circ', 'Pescoço', 'cm', 20, 70, ['circunferencia do pescoco', 'circ. do pescoco', 'pescoco', 'neck']),
  c('ombro', 'circ', 'Ombros', 'cm', 70, 180, ['circunferencia do ombro', 'circ. do ombro', 'ombros', 'ombro', 'shoulder']),
  c('torax', 'circ', 'Tórax', 'cm', 60, 170, ['circunferencia do torax', 'circ. do torax', 'torax', 'peitoral (circ', 'chest']),
  c('cintura', 'circ', 'Cintura', 'cm', 40, 180, ['circunferencia da cintura', 'circ. da cintura', 'cintura', 'waist']),
  c('abdomen', 'circ', 'Abdômen', 'cm', 40, 190, ['circunferencia do abdomen', 'circunferencia abdominal', 'circ. do abdomen', 'abdomen', 'abdome', 'abdominal circumference']),
  c('quadril', 'circ', 'Quadril', 'cm', 50, 190, ['circunferencia do quadril', 'circ. do quadril', 'quadril', 'hip']),
  c('braco_relaxado', 'circ', 'Braço relaxado (esq.)', 'cm', 15, 70, ['circ. do braco relaxado', 'braco relaxado esq', 'braco esquerdo relaxado', 'braco relaxado', 'arm relaxed', 'braco']),
  c('braco_relaxado_d', 'circ', 'Braço relaxado (dir.)', 'cm', 15, 70, ['circ. do braco dir. relaxado', 'braco dir. relaxado', 'braco direito relaxado', 'braco relaxado dir']),
  c('braco_contraido', 'circ', 'Braço contraído (esq.)', 'cm', 15, 75, ['circ. do braco contraido', 'braco contraido esq', 'braco esquerdo contraido', 'braco contraido', 'arm flexed']),
  c('braco_contraido_d', 'circ', 'Braço contraído (dir.)', 'cm', 15, 75, ['circ. do braco dir. contraido', 'braco dir. contraido', 'braco direito contraido', 'braco contraido dir']),
  c('antebraco', 'circ', 'Antebraço (esq.)', 'cm', 15, 55, ['circ. do antebraco esq', 'antebraco esq', 'antebraco esquerdo', 'antebraco', 'forearm']),
  c('antebraco_d', 'circ', 'Antebraço (dir.)', 'cm', 15, 55, ['circ. do antebraco dir', 'antebraco dir', 'antebraco direito']),
  c('coxa_proximal', 'circ', 'Coxa proximal (esq.)', 'cm', 30, 110, ['circ. proximal da coxa esq', 'coxa proximal esq', 'proximal da coxa esq', 'coxa proximal']),
  c('coxa_proximal_d', 'circ', 'Coxa proximal (dir.)', 'cm', 30, 110, ['circ. proximal da coxa dir', 'coxa proximal dir', 'proximal da coxa dir']),
  c('coxa_medial', 'circ', 'Coxa medial (esq.)', 'cm', 30, 100, ['circ. medial da coxa', 'coxa medial esq', 'medial da coxa', 'coxa medial', 'coxa media', 'thigh']),
  c('coxa_medial_d', 'circ', 'Coxa medial (dir.)', 'cm', 30, 100, ['circ. medial da coxa dir', 'coxa medial dir', 'medial da coxa dir']),
  c('coxa_distal', 'circ', 'Coxa distal (esq.)', 'cm', 25, 90, ['circ. distal da coxa esq', 'coxa distal esq', 'distal da coxa esq', 'coxa distal']),
  c('coxa_distal_d', 'circ', 'Coxa distal (dir.)', 'cm', 25, 90, ['circ. distal da coxa dir', 'coxa distal dir', 'distal da coxa dir']),
  c('panturrilha', 'circ', 'Panturrilha (esq.)', 'cm', 20, 65, ['circ. da panturrilha', 'panturrilha esq', 'panturrilha esquerda', 'panturrilha', 'calf']),
  c('panturrilha_d', 'circ', 'Panturrilha (dir.)', 'cm', 20, 65, ['circ. da panturrilha dir', 'panturrilha dir', 'panturrilha direita']),

  // Diâmetros ósseos (cm)
  c('diam_umero', 'diametros', 'Diâmetro do úmero', 'cm', 4, 12, ['diametro do umero', 'diametro umero', 'umero']),
  c('diam_punho', 'diametros', 'Diâmetro do punho', 'cm', 3, 10, ['diametro do punho', 'diametro punho', 'punho']),
  c('diam_femur', 'diametros', 'Diâmetro do fêmur', 'cm', 6, 14, ['diametro do femur', 'diametro femur', 'femur']),

  // Bioimpedância (balança / InBody / Tanita)
  c('gordura_pct', 'bio', 'Gordura corporal', '%', 2, 70, ['percentual de gordura corporal', 'percentual de gordura', '% de gordura', '% gordura', 'pgc', 'pbf', 'percent body fat', 'body fat %', 'body fat', 'gordura corporal', 'gordura']),
  c('massa_gorda', 'bio', 'Massa de gordura', 'kg', 1, 200, ['massa de gordura corporal', 'massa de gordura', 'massa gorda', 'massa adiposa', 'body fat mass', 'fat mass']),
  c('mlg', 'bio', 'Massa livre de gordura', 'kg', 15, 200, ['massa livre de gordura', 'massa nao adiposa', 'massa magra', 'fat free mass', 'ffm', 'lean body mass']),
  c('massa_muscular', 'bio', 'Massa muscular', 'kg', 10, 150, ['massa muscular total', 'massa muscular', 'muscle mass', 'soft lean mass', 'massa magra muscular']),
  c('smm', 'bio', 'Músculo esquelético', 'kg', 8, 90, ['massa muscular esqueletica', 'musculo esqueletico', 'skeletal muscle mass', 'smm']),
  c('massa_ossea', 'bio', 'Massa óssea', 'kg', 0.5, 10, ['massa ossea', 'bone mass', 'conteudo mineral osseo', 'minerais']),
  c('agua_kg', 'bio', 'Água corporal', 'kg', 10, 120, ['agua corporal total', 'total body water', 'tbw', 'agua corporal']),
  c('agua_pct', 'bio', 'Água corporal (%)', '%', 20, 80, ['% de agua', 'agua (%)', 'percentual de agua', 'body water %']),
  c('visceral', 'bio', 'Gordura visceral', 'nível', 1, 59, ['nivel de gordura visceral', 'indice de gordura visceral', 'gordura visceral', 'visceral fat level', 'visceral fat', 'vfr', 'visceral']),
  c('idade_metabolica', 'bio', 'Idade metabólica', 'anos', 10, 99, ['idade metabolica', 'metabolic age']),
  c('tmb', 'bio', 'Metabolismo basal', 'kcal', 600, 5000, ['taxa metabolica basal', 'metabolismo basal', 'basal metabolic rate', 'tmb', 'bmr']),
  c('angulo_fase', 'bio', 'Ângulo de fase', '°', 2, 15, ['angulo de fase', 'phase angle']),
  c('gordura_pct_laudo', 'laudo', '% gordura (laudo)', '%', 2, 70, []),
  c('massa_gorda_laudo', 'laudo', 'Massa de gordura (laudo)', 'kg', 1, 200, []),
  c('mlg_laudo', 'laudo', 'Massa livre de gordura (laudo)', 'kg', 15, 200, []),
  c('imc_aparelho', 'bio', 'IMC (aparelho)', 'kg/m²', 10, 70, ['imc', 'indice de massa corporal', 'bmi']),
];

export const CAMPO_POR_KEY: Record<string, Campo> = Object.fromEntries(CAMPOS.map((f) => [f.key, f]));

export const GRUPOS: { id: Grupo; label: string }[] = [
  { id: 'basico', label: 'Dados básicos' },
  { id: 'dobras', label: 'Dobras cutâneas (mm)' },
  { id: 'circ', label: 'Circunferências (cm)' },
  { id: 'diametros', label: 'Diâmetros ósseos (cm)' },
  { id: 'bio', label: 'Bioimpedância (balança)' },
];

// Minúsculas, sem acentos e com espaços simples: base de toda comparação de rótulos.
export function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ \s]+/g, ' ')
    .trim();
}

// Acha o campo de um rótulo. Em `secao` vem o grupo em que o rótulo apareceu (ex.: a tabela
// de bioimpedância), que desempata rótulos repetidos como "Percentual de Gordura".
export function campoDoRotulo(rotulo: string, secao?: Grupo | null): Campo | null {
  const r = normalizar(rotulo);
  if (!r || IGNORAR.test(r)) return null;
  let melhor: { campo: Campo; tam: number; peso: number } | null = null;
  for (const campo of CAMPOS) {
    for (const s of campo.sinonimos) {
      const exato = r === s;
      if (!exato && !contemPalavra(r, s)) continue;
      const peso = (exato ? 1000 : 0) + (secao && campo.grupo === secao ? 100 : 0) + s.length;
      if (!melhor || peso > melhor.peso) melhor = { campo, tam: s.length, peso };
    }
  }
  if (!melhor) return null;
  if (/percentual|%/.test(r) && melhor.campo.unidade === 'kg') return null;
  // Rótulos de dobras: "Dobra da Coxa" não pode virar circunferência e vice-versa.
  if (/\bdobra/.test(r) && melhor.campo.grupo !== 'dobras') return null;
  if (/\b(circ|circunferencia|perimetro)/.test(r) && melhor.campo.grupo === 'dobras') return null;
  return melhor.campo;
}

// Linhas que o app recalcula ou que não são medidas (classificações, razões, ideais).
const IGNORAR = /^(classif|risco)|classificacao|relacao|\brcq\b|\bcmb\b|musc\. do|sentado|joelho|ideal|alvo|meta\b|somatorio|densidade|residual|recomendad|vestuario/;

function contemPalavra(texto: string, termo: string): boolean {
  const i = texto.indexOf(termo);
  if (i < 0) return false;
  const antes = i === 0 ? ' ' : texto[i - 1];
  const depois = i + termo.length >= texto.length ? ' ' : texto[i + termo.length];
  return !/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois);
}
