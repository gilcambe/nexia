// Documentação técnica do projeto: cores, tipografia, layout, stack, parâmetros e cálculos.
// Os valores abaixo espelham exatamente o index.css, o tailwind.config.ts e os motores de cálculo.

export interface PaletteRole {
  role: string;
  swatch: string;
  usage: string;
  anchors: string[];
}

export const paletteRoles: PaletteRole[] = [
  {
    role: 'background',
    swatch: 'var(--background-200)',
    usage: 'Base da página, camadas de seção, cartões, painéis e alternância sutil.',
    anchors: ['background-50 (canvas)', 'background-100 / 200 (cartões, divisores)', 'background-950 (contraste escuro)'],
  },
  {
    role: 'primary',
    swatch: 'var(--primary-500)',
    usage: 'Cor de marca e conversão: CTAs, ações principais e destaques fortes.',
    anchors: ['primary-500 (CTA)', 'primary-100 (fundo suave)', 'primary-700 (texto sobre suave)'],
  },
  {
    role: 'accent',
    swatch: 'var(--accent-500)',
    usage: 'Segunda cor expressiva: recuperação/positivo, streaks, recordes, destaques.',
    anchors: ['accent-500', 'accent-100', 'accent-700'],
  },
  {
    role: 'secondary',
    swatch: 'var(--secondary-500)',
    usage: 'Apoio: filtros, chips, metadados e controles secundários.',
    anchors: ['secondary-500', 'secondary-100', 'secondary-900'],
  },
  {
    role: 'foreground',
    swatch: 'var(--foreground-950)',
    usage: 'Texto e neutro de maior contraste (tipografia e ícones).',
    anchors: ['foreground-950 (texto)', 'foreground-700 / 600 (secundário)', 'foreground-400 (metadados)'],
  },
];

export interface TypoDoc {
  alias: string;
  cssVar: string;
  font: string;
}

export const typography: TypoDoc[] = [
  { alias: 'font-heading / font-display', cssVar: 'var(--font-heading)', font: 'Space Grotesk' },
  { alias: 'font-body / font-sans', cssVar: 'var(--font-body)', font: 'Inter' },
  { alias: 'font-label', cssVar: 'var(--font-label)', font: 'Inter' },
];

export const layoutScale = [
  { token: 'rounded-lg (8px)', usage: 'Cartões e containers' },
  { token: 'rounded-md (6px)', usage: 'Botões e campos de formulário' },
  { token: 'rounded-full', usage: 'Pills, avatares e badges' },
  { token: 'px-4 md:px-6', usage: 'Padding horizontal responsivo' },
  { token: 'gap-3 md:gap-5', usage: 'Espaçamento entre blocos' },
  { token: 'max-w-6xl mx-auto', usage: 'Largura do conteúdo (garante ≥1024px no desktop)' },
];

export const stack = [
  { name: 'React', version: '19' },
  { name: 'Vite', version: '^8' },
  { name: 'TypeScript', version: '~5.8' },
  { name: 'Tailwind CSS', version: '^3.4' },
  { name: 'react-router-dom', version: '^7.6' },
  { name: 'recharts', version: '3.2' },
  { name: 'firebase', version: '12.0' },
];

export const dataModel = [
  { table: 'profile (athlete_profiles)', columns: 'main: full_name, email, height_cm, gender, birth_date, goal_weight_kg, goal_body_fat_pct, coach_notes' },
  { table: 'progress_entries', columns: 'id, user_id, weight_kg, body_fat_pct, measurements (map), image_url (data URL), notes, taken_at' },
  { table: 'daily_readiness', columns: '{data AAAA-MM-DD}: id, user_id, check_in_date, sleep_hours, sleep_quality, soreness, fatigue, energy, stress, pain_level, hrv, rhr, readiness_score, notes' },
  { table: 'meals', columns: 'id, user_id, name, meal_time, calories, protein, carbs, fat, fiber, created_at' },
  { table: 'medical_exams', columns: 'id, user_id, exam_type, title, file_url (data URL), taken_at, notes' },
  { table: 'workout_sessions', columns: 'id, user_id, title, started_at, duration_min, volume_kg, notes (a criar)' },
  { table: 'workout_sets', columns: 'id, user_id, session_id, exercise, set_index, weight, reps, rir (a criar)' },
];

export interface CalcDoc {
  title: string;
  formula: string;
  description: string;
  source: string;
}

export const calculations: CalcDoc[] = [
  {
    title: 'Readiness Score (0–100)',
    formula:
      'score = 0.25·sono + 0.25·recuperação + 0.15·energia + 0.10·dores + 0.10·estresse + 0.15·dor',
    description:
      'sono = 0.6·(horas/8) + 0.4·(qualidade/5); recuperação = (10−fadiga)×10; energia = energia×10; dores = (10−DOMS)×10; estresse = (10−estresse)×10; dor = (10−dor)×10. Status: ≥78 Pronto · ≥60 Atenção · <60 Reduzir.',
    source: 'src/lib/readinessEngine.ts',
  },
  {
    title: 'Marcadores de sangue',
    formula: 'status = "low" se valor < mínimo · "high" se valor > máximo · senão "normal"',
    description:
      'Regras por marcador (vitamina D, ferritina, testosterona total, TSH, hemoglobina, cortisol) com mensagem, sugestão de suplementação e encaminhamento. Não é diagnóstico.',
    source: 'src/pages/exams/components/markerRules.ts',
  },
  {
    title: '% de gordura (método da Marinha)',
    formula: 'BF% = 495 / (1.0324 − 0.19077·log10(cintura − pescoço) + 0.15456·log10(altura)) − 450',
    description:
      'Estimativa de gordura corporal a partir de circunferências (referência para homens). Usada como estimativa visual, não medida clínica.',
    source: 'src/pages/evolution/components/bodyAnalysis.ts',
  },
  {
    title: 'Medidas a partir da foto (silhueta)',
    formula: 'largura_cm = largura_px / pxPorCm ; pxPorCm = (altura_imagem × 0.85) / altura_cm',
    description:
      'Detecta a silhueta contra o fundo, mede pescoço, ombro, cintura e quadril e converte para cm usando a altura conhecida.',
    source: 'src/pages/evolution/components/bodyAnalysis.ts',
  },
  {
    title: 'Tendência de peso',
    formula: 'delta = peso_atual − peso_anterior',
    description: 'Série temporal montada a partir de progress_entries (peso, cintura e massa magra estimada).',
    source: 'src/hooks/useProgressData.ts',
  },
  {
    title: 'Anti-Doping (lista WADA)',
    formula: 'veredito = proibido se termo ∈ lista · cuidado se parcial/estimulante · senão permitido',
    description:
      'Cruza o nome do suplemento/ingrediente digitado com as categorias proibidas da WADA e retorna o veredito com a categoria e o motivo.',
    source: 'src/pages/antidoping/components/wadaData.ts',
  },
  {
    title: 'Relatório semanal',
    formula: 'variação = valor_últimos_7d − valor_7d_anteriores',
    description:
      'Compara readiness médio, peso e adesão de nutrição da semana atual com a anterior e gera um texto narrado por voz.',
    source: 'src/pages/home/components/WeeklyReport.tsx',
  },
];