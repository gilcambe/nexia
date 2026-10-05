// Dados-semente do MODO LOCAL (demonstração sem backend).
// Usados quando o login de teste (admin / admin01) está ativo.

export const localDemoProfile = {
  full_name: 'Admin Demo',
  email: 'admin',
  height_cm: 178,
  gender: 'masculino',
  birth_date: '1992-05-14',
  goal_weight_kg: 82,
  goal_body_fat_pct: 12,
  coach_notes: 'Sessão de demonstração local — dados de exemplo, sem backend.',
};

// offset = quantos dias atrás (0 = hoje)
export const localReadinessSeed = [
  { offset: 0, sleep_hours: 6.3, sleep_quality: 3, soreness: 4, fatigue: 6, energy: 6, stress: 6, pain_level: 1, hrv: 54, rhr: 61, notes: 'Acordei cansado, dormi mal.' },
  { offset: 1, sleep_hours: 7.8, sleep_quality: 4, soreness: 3, fatigue: 4, energy: 8, stress: 3, pain_level: 0, hrv: 62, rhr: 58, notes: null },
  { offset: 2, sleep_hours: 7.5, sleep_quality: 4, soreness: 4, fatigue: 4, energy: 7, stress: 4, pain_level: 0, hrv: 60, rhr: 59, notes: null },
  { offset: 3, sleep_hours: 6.8, sleep_quality: 3, soreness: 5, fatigue: 5, energy: 6, stress: 5, pain_level: 1, hrv: 57, rhr: 60, notes: 'Treino de pernas pesado ontem.' },
  { offset: 4, sleep_hours: 7.9, sleep_quality: 5, soreness: 2, fatigue: 3, energy: 8, stress: 3, pain_level: 0, hrv: 65, rhr: 57, notes: null },
  { offset: 5, sleep_hours: 8.1, sleep_quality: 5, soreness: 2, fatigue: 3, energy: 9, stress: 2, pain_level: 0, hrv: 66, rhr: 56, notes: 'Sono excelente.' },
  { offset: 6, sleep_hours: 7.2, sleep_quality: 4, soreness: 3, fatigue: 4, energy: 7, stress: 4, pain_level: 0, hrv: 61, rhr: 58, notes: null },
];

// offset = quantos dias atrás (0 = hoje)
export const localProgressSeed = [
  { offset: 42, weight_kg: 80.1, body_fat_pct: 18.5, waist: 86.2, notes: 'Início do acompanhamento' },
  { offset: 35, weight_kg: 80.6, body_fat_pct: 17.9, waist: 85.9, notes: null },
  { offset: 28, weight_kg: 81.0, body_fat_pct: 17.4, waist: 85.5, notes: null },
  { offset: 21, weight_kg: 81.3, body_fat_pct: 17.2, waist: 85.2, notes: 'Semana consistente.' },
  { offset: 14, weight_kg: 81.9, body_fat_pct: 16.8, waist: 84.8, notes: null },
  { offset: 7, weight_kg: 82.1, body_fat_pct: 16.4, waist: 84.5, notes: null },
  { offset: 0, weight_kg: 82.4, body_fat_pct: 16.0, waist: 84.0, notes: 'Peso subindo, cintura caindo.' },
];

// offset = quantos dias atrás (0 = hoje)
export const localExamSeed = [
  { offset: 8, exam_type: 'Hemograma', title: 'Hemograma completo', notes: 'Ferritina no limite inferior — monitorar.' },
  { offset: 26, exam_type: 'Lipidograma', title: 'Perfil lipídico', notes: 'LDL controlado, HDL bom.' },
  { offset: 47, exam_type: 'Imagem', title: 'Ressonância ombro direito', notes: 'Bursite em resolução, sem lesão estrutural.' },
];