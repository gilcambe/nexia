import { useState } from 'react';
import { useNutrition } from '@/components/feature/NutritionContext';
import Card from '@/components/base/Card';
import { alternarFavorita, ehFavorita, lerFavoritas, type Favorita } from '@/lib/refeicoesFavoritas';

// Registrar em 1 toque: estrela nas refeições de hoje e lista das favoritas para repetir.
export default function Favoritas() {
  const { meals, addMeal } = useNutrition();
  const [favs, setFavs] = useState<Favorita[]>(() => lerFavoritas());
  const [msg, setMsg] = useState('');
  const hora = () => new Date().toTimeString().slice(0, 5);
  const repetir = async (f: Favorita) => {
    try { await addMeal({ id: '', name: f.name, time: hora(), calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber }); setMsg(`${f.name} registrada.`); }
    catch (e) { setMsg((e as Error).message); }
  };
  const paraFav = (m: (typeof meals)[number]): Favorita => ({ name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber ?? 0 });
  if (!favs.length && !meals.length) return null;
  return (
    <Card padding="p-5">
      <div className="flex items-center gap-2"><i className="ri-star-line text-lg text-primary-500"></i><h2 className="font-heading text-base font-semibold text-foreground-950">Favoritas: registrar em 1 toque</h2></div>
      {favs.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {favs.map((f) => (
            <li key={f.name} className="flex items-center gap-2 rounded-xl bg-background-100 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{f.name} <span className="text-xs text-foreground-500">· {Math.round(f.calories)} kcal</span></span>
              <button type="button" onClick={() => void repetir(f)} className="rounded-lg bg-primary-500 px-3 py-1 text-xs font-semibold text-background-50">Registrar</button>
              <button type="button" aria-label={`Tirar ${f.name} das favoritas`} onClick={() => setFavs(alternarFavorita(favs, f))} className="text-foreground-400"><i className="ri-close-line"></i></button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-foreground-600">Toque na estrela de uma refeição de hoje para guardá-la aqui.</p>}
      {meals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Guardar refeição de hoje">
          {meals.slice(0, 6).map((m) => (
            <button key={m.id || m.name} type="button" onClick={() => setFavs(alternarFavorita(favs, paraFav(m)))} className="rounded-full border border-background-200 px-3 py-1 text-xs text-foreground-700">
              <i className={`${ehFavorita(favs, m.name) ? 'ri-star-fill text-primary-500' : 'ri-star-line'} mr-1`}></i>{m.name}
            </button>
          ))}
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-sm text-primary-700">{msg}</p>}
    </Card>
  );
}
