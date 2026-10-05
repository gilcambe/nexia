export interface MealFood {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface QuickFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const nutritionTargets: NutritionTargets = {
  calories: 2850,
  protein: 180,
  carbs: 320,
  fat: 85,
  fiber: 35,
};

export const waterGoal = 3.1;

export const initialWater = 1.4;

export const initialMeals: MealFood[] = [
  { id: 'm1', name: 'Omelete + pão integral', time: '07:30', calories: 520, protein: 38, carbs: 48, fat: 20, fiber: 7 },
  { id: 'm2', name: 'Iogurte + granola', time: '10:20', calories: 310, protein: 21, carbs: 34, fat: 9, fiber: 4 },
  { id: 'm3', name: 'Frango + arroz + legumes', time: '12:40', calories: 640, protein: 52, carbs: 68, fat: 14, fiber: 9 },
  { id: 'm4', name: 'Whey + banana (pós-treino)', time: '17:10', calories: 260, protein: 28, carbs: 30, fat: 5, fiber: 2 },
  { id: 'm5', name: 'Salmão + batata-doce + salada', time: '20:30', calories: 650, protein: 44, carbs: 72, fat: 17, fiber: 10 },
];

export const quickFoods: QuickFood[] = [
  { id: 'q1', name: 'Frango grelhado (150g)', calories: 245, protein: 45, carbs: 0, fat: 7 },
  { id: 'q2', name: 'Arroz branco (200g)', calories: 258, protein: 5, carbs: 54, fat: 1 },
  { id: 'q3', name: 'Batata-doce (200g)', calories: 172, protein: 3, carbs: 40, fat: 0 },
  { id: 'q4', name: 'Ovos inteiros (3 un)', calories: 234, protein: 18, carbs: 2, fat: 15 },
  { id: 'q5', name: 'Whey protein (1 scoop)', calories: 120, protein: 24, carbs: 3, fat: 2 },
  { id: 'q6', name: 'Banana (1 un)', calories: 105, protein: 1, carbs: 27, fat: 0 },
  { id: 'q7', name: 'Iogurte natural (170g)', calories: 120, protein: 10, carbs: 12, fat: 4 },
  { id: 'q8', name: 'Aveia (50g)', calories: 190, protein: 7, carbs: 33, fat: 4 },
  { id: 'q9', name: 'Salmão (150g)', calories: 312, protein: 30, carbs: 0, fat: 20 },
  { id: 'q10', name: 'Castanha-do-pará (30g)', calories: 185, protein: 4, carbs: 6, fat: 18 },
];

export interface WeeklyTrendPoint {
  label: string;
  calories: number;
  protein: number;
}

export const weeklyTrend: WeeklyTrendPoint[] = [
  { label: 'Seg', calories: 2620, protein: 168 },
  { label: 'Ter', calories: 2810, protein: 181 },
  { label: 'Qua', calories: 2740, protein: 175 },
  { label: 'Qui', calories: 2890, protein: 186 },
  { label: 'Sex', calories: 2780, protein: 178 },
  { label: 'Sáb', calories: 2950, protein: 182 },
  { label: 'Dom', calories: 2720, protein: 170 },
];