import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNutrition } from '@/components/feature/NutritionContext';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { montarCardapio, restricoes, POR_ID, type Alimento } from '@/lib/dietPlan';
import { equivalentes } from '@/lib/trocas';
import { useTrocasDoDia } from '@/lib/useTrocasDoDia';
import TrocaAlimento from './TrocaAlimento';

// Cardápio sugerido do dia: calculado das metas do aluno e das respostas do questionário.
// Cada alimento pode ser trocado por um equivalente do mesmo grupo (vale só hoje), e o aluno
// pode tirar de vez um alimento que não quer mais ver no cardápio.
export default function CardapioDoDia() {
  const { targets } = useNutrition();
  const { user, profile, refreshProfile } = useAuth();
  const [onboarding, setOnboarding] = useState<Record<string, unknown> | null | undefined>(undefined);
  const { trocas, definir } = useTrocasDoDia(user?.id, 'cardapio');
  const [aberto, setAberto] = useState<{ chave: string; item: Alimento } | null>(null);
  const [tirar, setTirar] = useState(false);
  const evitar = useMemo(() => profile?.alimentos_evitar ?? [], [profile?.alimentos_evitar]);
  const horarios = profile?.horarios_refeicoes ?? {};

  useEffect(() => {
    if (!user) return;
    getUserDoc<{ onboarding?: Record<string, unknown> }>(user.id, 'profile', 'main')
      .then((p) => setOnboarding(p?.onboarding ?? null))
      .catch(() => setOnboarding(null));
  }, [user]);

  const refeicoes = useMemo(
    () => (onboarding ? montarCardapio(onboarding, { kcal: targets.calories, proteina: targets.protein, carbo: targets.carbs, gordura: targets.fat }, undefined, evitar) : []),
    [onboarding, targets, evitar],
  );
  const proibidas = useMemo(() => restricoes(onboarding ?? {}), [onboarding]);

  // Com o plano do nutricionista, ele substitui o cardápio automático.
  if (onboarding === undefined || profile?.plano_nutri) return null;
  if (!onboarding) {
    return (
      <div className="rounded-2xl border border-background-200 bg-background-50 p-4">
        <h2 className="font-heading text-lg font-bold text-foreground-950">Cardápio sugerido de hoje</h2>
        <p className="mt-1 text-sm text-foreground-600">Responda o questionário para montar seu cardápio.</p>
        <Link to="/onboarding" className="mt-3 inline-flex rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50">Responder agora</Link>
      </div>
    );
  }

  const efetivo = (chave: string, i: Alimento) => trocas[chave] ?? i;
  const todos = refeicoes.flatMap((r) => r.itens.map((i, k) => efetivo(`${r.nome}|${k}`, i)));
  const totalKcal = Math.round(todos.reduce((t, i) => t + (i.kcal ?? 0), 0));
  const totalProt = Math.round(todos.reduce((t, i) => t + (i.p ?? 0), 0));

  const salvarEvitar = async (lista: string[]) => {
    if (!user) return;
    await setUserDoc(user.id, 'profile', 'main', { alimentos_evitar: lista }, true);
    refreshProfile();
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="cardapio">
      <h2 className="font-heading text-lg font-bold text-foreground-950">Cardápio sugerido de hoje</h2>
      <p className="mt-1 text-xs text-foreground-500">Montado com suas metas e restrições. Toque em um alimento para trocar por um equivalente.</p>
      <div className="mt-3 space-y-3">
        {refeicoes.map((r) => (
          <div key={r.nome}>
            <p className="text-sm font-semibold text-foreground-900">{r.nome} <span className="font-normal text-foreground-500">· {horarios[r.nome] ?? r.horario}</span></p>
            <ul className="mt-1 space-y-0.5 text-sm text-foreground-700">
              {r.itens.map((i, k) => {
                const chave = `${r.nome}|${k}`;
                const t = trocas[chave];
                const v = efetivo(chave, i);
                return (
                  <li key={chave}>
                    <button type="button" onClick={() => { setTirar(false); setAberto({ chave, item: i }); }} className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left active:bg-primary-50" data-testid="cardapio-item">
                      <span>
                        {v.nome} <span className="text-foreground-500">({v.porcao})</span>
                        {t && <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">trocado</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-foreground-500">
                        {v.kcal != null && `${v.kcal} kcal`}
                        <i className="ri-arrow-left-right-line text-primary-500" aria-hidden="true"></i>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-background-200 pt-2 text-sm font-semibold text-foreground-900">Total: {totalKcal} kcal · {totalProt} g de proteína</p>
      {evitar.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-foreground-600">
          <span>Fora do seu cardápio:</span>
          {evitar.filter((id) => POR_ID[id]).map((id) => (
            <button key={id} type="button" onClick={() => salvarEvitar(evitar.filter((x) => x !== id))} className="rounded-full bg-background-100 px-2 py-0.5" aria-label={`Voltar a incluir ${POR_ID[id].nome}`}>
              {POR_ID[id].nome} <i className="ri-close-line"></i>
            </button>
          ))}
        </div>
      )}

      {aberto && (
        <TrocaAlimento
          item={aberto.item}
          doApp={aberto.item.id && aberto.item.qtd ? equivalentes(aberto.item.id, aberto.item.qtd, { proibidas, evitar }) : []}
          trocado={!!trocas[aberto.chave]}
          onFechar={() => setAberto(null)}
          onDesfazer={() => { definir(aberto.chave, null); setAberto(null); }}
          onEscolher={(o) => {
            definir(aberto.chave, o);
            if (tirar && aberto.item.id) void salvarEvitar([...new Set([...evitar, aberto.item.id])]);
            setAberto(null);
          }}
          extra={{ label: `Não colocar mais ${aberto.item.nome.toLowerCase()} no meu cardápio`, marcado: tirar, onMudar: setTirar }}
        />
      )}
    </div>
  );
}
