import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { useNutrition } from '@/components/feature/NutritionContext';
import { listaDaSemana, listaDoPlano } from '@/lib/ferramentas/listaCompras';

export default function ListaCompras() {
  const { user, profile } = useAuth();
  const { targets } = useNutrition();
  const ob = profile?.onboarding as Record<string, unknown> | undefined;
  const itens = useMemo(() => {
    if (profile?.plano_nutri?.refeicoes?.length) return listaDoPlano(profile.plano_nutri.refeicoes);
    if (!ob) return [];
    return listaDaSemana(ob, { kcal: targets.calories, proteina: targets.protein, carbo: targets.carbs, gordura: targets.fat }, profile?.alimentos_evitar ?? []);
  }, [ob, targets, profile?.plano_nutri, profile?.alimentos_evitar]);
  const chave = user ? `bc_compras_${user.id}` : '';
  const [marcados, setMarcados] = useState<string[]>([]);
  useEffect(() => {
    try { setMarcados(chave ? JSON.parse(localStorage.getItem(chave) || '[]') : []); } catch { setMarcados([]); }
  }, [chave]);
  const marcar = (id: string) => {
    const l = marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id];
    setMarcados(l);
    try { if (chave) localStorage.setItem(chave, JSON.stringify(l)); } catch { /* sem armazenamento */ }
  };
  const texto = () => {
    const grupos = [...new Set(itens.map((i) => i.grupo))];
    return 'Lista de compras da semana (Body Coach)\n' + grupos.map((g) => `\n${g}\n` + itens.filter((i) => i.grupo === g).map((i) => `- ${i.nome}: ${i.total}`).join('\n')).join('\n');
  };
  const [copiado, setCopiado] = useState(false);
  const compartilhar = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Lista de compras', text: texto() }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(texto()); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sem área de transferência */ }
  };

  if (!itens.length) {
    return (
      <Card>
        <p className="text-sm text-foreground-600">Ainda não há dieta para montar a lista. Responda o questionário ou importe o plano do seu nutricionista.</p>
        <Link to="/nutrition" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 dark:text-foreground-950">Ir para Nutrição</Link>
      </Card>
    );
  }
  const grupos = [...new Set(itens.map((i) => i.grupo))];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => void compartilhar()} className="flex-1 rounded-xl bg-primary-500 py-3 text-sm font-semibold text-background-50 dark:text-foreground-950"><i className="ri-share-line mr-1"></i>{copiado ? 'Copiado!' : 'Enviar no WhatsApp'}</button>
        <button type="button" onClick={() => { setMarcados([]); try { localStorage.removeItem(chave); } catch { /* */ } }} className="rounded-xl border border-background-300 px-4 py-3 text-sm font-semibold text-foreground-600">Limpar</button>
      </div>
      <p className="text-xs text-foreground-500">{profile?.plano_nutri ? 'Itens do plano do seu nutricionista.' : 'Quantidades para 7 dias do seu cardápio, já arredondadas.'} {marcados.length}/{itens.length} no carrinho.</p>
      {grupos.map((g) => (
        <Card key={g} padding="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">{g}</h2>
          <ul className="divide-y divide-background-200">
            {itens.filter((i) => i.grupo === g).map((i) => {
              const ok = marcados.includes(i.id);
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => marcar(i.id)} aria-pressed={ok} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-background-300 text-transparent'}`}><i className="ri-check-line"></i></span>
                    <span className={`flex-1 text-sm ${ok ? 'text-foreground-400 line-through' : 'text-foreground-900'}`}>{i.nome}</span>
                    <span className="text-sm font-semibold text-foreground-700">{i.total}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
