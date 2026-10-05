import { useState } from 'react';
import { quickFoods, type MealFood, type QuickFood } from '@/mocks/nutrition';

export default function AddMealModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (meal: MealFood) => void;
}) {
  const [name, setName] = useState('');
  const [time, setTime] = useState('12:00');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const nowLabel = new Date().toTimeString().slice(0, 5);

  const addQuick = (q: QuickFood) => {
    onAdd({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: q.name,
      time: nowLabel,
      calories: q.calories,
      protein: q.protein,
      carbs: q.carbs,
      fat: q.fat,
      fiber: 0,
    });
    onClose();
  };

  const submit = () => {
    const cal = Number(calories) || 0;
    const prot = Number(protein) || 0;
    const carb = Number(carbs) || 0;
    const f = Number(fat) || 0;
    if (!name.trim() && !cal) return;
    onAdd({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'Refeição sem nome',
      time: time || nowLabel,
      calories: cal,
      protein: prot,
      carbs: carb,
      fat: f,
      fiber: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-foreground-950/30" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-background-200 bg-background-50 p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground-950">Registrar refeição</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-500 hover:bg-background-100"
            aria-label="Fechar"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Adicionar rápido</p>
        <div className="grid grid-cols-2 gap-2">
          {quickFoods.map((q) => (
            <button
              key={q.id}
              onClick={() => addQuick(q)}
              className="flex items-center justify-between rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-left transition hover:bg-background-100"
            >
              <span className="text-sm font-medium text-foreground-800">{q.name}</span>
              <span className="ml-2 shrink-0 text-[11px] text-foreground-500">{q.calories} kcal</span>
            </button>
          ))}
        </div>

        <div className="my-4 border-t border-background-200" />

        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-400">Entrada manual</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-foreground-500">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: frango com arroz"
              className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-foreground-500">Horário</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-foreground-500">Calorias (kcal)</label>
              <input
                type="number"
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Proteína (g)', val: protein, set: setProtein },
              { label: 'Carbo (g)', val: carbs, set: setCarbs },
              { label: 'Gordura (g)', val: fat, set: setFat },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-xs text-foreground-500">{f.label}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          className="mt-5 w-full whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
        >
          Adicionar refeição
        </button>
      </div>
    </div>
  );
}