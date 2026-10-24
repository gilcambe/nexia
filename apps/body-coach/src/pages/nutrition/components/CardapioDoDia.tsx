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
  const [aberta, setAberta] = useState<string | null | undefined>(undefined);
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
  // Só a próxima refeição fica aberta; as outras são uma linha (toque para ver), assim cabe sem rolar.
  const agora = new Date().getHours() * 60 + new Date().getMinutes();
  const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const proxima = (refeicoes.find((r) => minutos(horarios[r.nome] ?? r.horario) >= agora) ?? refeicoes[0])?.nome ?? null;
  const abertaAgora = aberta === undefined ? proxima : aberta;
  const todos = refeicoes.flatMap((r) => r.itens.map((i, k) => efetivo(`${r.nome}|${k}`, i)));
  const totalKcal = Math.round(todos.reduce((t, i) => t + (i.kcal ?? 0), 0));
  const totalProt = Math.round(todos.reduce((t, i) => t + (i.p ?? 0), 0));

  const salvarEvitar = async (lista: string[]) => {
    if (!user) return;
    await setUserDoc(user.id, 'profile', 'main', { alimentos_evitar: lista }, true);
    refreshProfile();
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-3" data-testid="cardapio">
      <div className="flex items-baseline gap-2">
        <h2 className="font-heading text-base font-bold text-foreground-950">Cardápio de hoje</h2>
        <span className="ml-auto text-xs font-semibold text-foreground-700">{totalKcal} kcal · {totalProt} g prot.</span>
      </div>
      <div className="mt-1.5 divide-y divide-background-200">
        {refeicoes.map((r) => {
          const aberto = abertaAgora === r.nome;
          const kcal = Math.round(r.itens.reduce((t, i, k) => t + (efetivo(`${r.nome}|${k}`, i).kcal ?? 0), 0));
          return (
          <div key={r.nome} className="py-0.5">
            <button type="button" onClick={() => setAberta(aberto ? null : r.nome)} aria-expanded={aberto} className="flex w-full items-center gap-2 py-0.5 text-left" data-testid="cardapio-refeicao">
              <span className="text-sm font-semibold text-foreground-900">{r.nome}</span>
              <span className="text-xs text-foreground-500">{horarios[r.nome] ?? r.horario}</span>
              {r.nome === proxima && <span className="rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">próxima</span>}
              <span className="ml-auto text-xs text-foreground-500">{kcal} kcal</span>
              <i className={`ri-arrow-${aberto ? 'up' : 'down'}-s-line text-foreground-400`}></i>
            </button>
            {aberto && (
            <ul className="text-[13px] text-foreground-700">
              {r.itens.map((i, k) => {
                const chave = `${r.nome}|${k}`;
                const t = trocas[chave];
                const v = efetivo(chave, i);
                return (
                  <li key={chave}>
                    <button type="button" onClick={() => { setTirar(false); setAberto({ chave, item: i }); }} className="flex w-full items-center justify-between gap-3 rounded-lg py-0.5 text-left active:bg-primary-50" data-testid="cardapio-item">
                      <span>
                        {v.nome} <span className="text-foreground-500">({v.porcao})</span>
                        {t && <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-semibold text-primary-700">trocado</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-foreground-500">
                        {v.kcal != null && `${v.kcal} kcal`}
                        <i className="ri-arrow-left-right-line text-primary-500" aria-hidden="true" title="Trocar por um equivalente"></i>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          );
        })}
      </div>
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
