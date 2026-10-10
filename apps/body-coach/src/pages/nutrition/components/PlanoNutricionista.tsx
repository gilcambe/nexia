import { useRef, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { useNutrition } from '@/components/feature/NutritionContext';
import { setUserDoc } from '@/lib/userData';
import type { PlanoAlimentar, RefeicaoPlano } from '@/lib/planoAlimentar';

const minutos = (h: string | null) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : null);
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// Próxima refeição com horário a partir de agora (dá a volta no fim do dia).
function proxima(refeicoes: RefeicaoPlano[], agora = new Date()): number {
  const m = agora.getHours() * 60 + agora.getMinutes();
  const comHora = refeicoes.map((r, i) => ({ i, t: minutos(r.horario) })).filter((x) => x.t != null) as { i: number; t: number }[];
  if (!comHora.length) return -1;
  const depois = comHora.filter((x) => x.t >= m).sort((a, b) => a.t - b.t);
  return (depois[0] ?? comHora.sort((a, b) => a.t - b.t)[0]).i;
}

function Refeicao({ r, destaque }: { r: RefeicaoPlano; destaque: boolean }) {
  const [aberta, setAberta] = useState(destaque);
  const { meals, addMeal } = useNutrition();
  const feita = meals.some((m) => m.name === `${r.nome} (plano)`);
  const registrar = () => r.macros && addMeal({
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${r.nome} (plano)`,
    time: new Date().toTimeString().slice(0, 5),
    calories: Math.round(r.macros.kcal), protein: r.macros.proteina, carbs: r.macros.carbo, fat: r.macros.gordura, fiber: 0,
  });
  const extras = r.trocas.length + r.obs.length;
  return (
    <div className={`rounded-xl border p-3 ${destaque ? 'border-primary-300 bg-primary-50/60' : 'border-background-200'}`} data-testid="plano-refeicao">
      <div className="flex items-baseline gap-2">
        {r.horario && <span className="font-heading text-sm font-bold text-primary-600">{r.horario}</span>}
        <p className="text-sm font-semibold text-foreground-900">{r.nome}</p>
        {destaque && <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-semibold text-white">próxima</span>}
        {r.macros && r.macros.kcal > 0 && <span className="ml-auto shrink-0 text-xs text-foreground-500">{fmt(r.macros.kcal)} kcal</span>}
      </div>
      <ul className="mt-1.5 space-y-0.5 text-sm text-foreground-700">
        {r.itens.map((i) => (
          <li key={i.nome + i.qtd} className="flex justify-between gap-3">
            <span>{i.nome}</span>
            <span className="shrink-0 text-right text-foreground-500">{i.qtd}</span>
          </li>
        ))}
      </ul>
      {r.macros && r.macros.kcal > 0 && (
        <p className="mt-1 text-[11px] text-foreground-500">Proteína {fmt(r.macros.proteina)} g · Carbo {fmt(r.macros.carbo)} g · Gordura {fmt(r.macros.gordura)} g</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {r.macros && r.macros.kcal > 0 && (
          <button type="button" onClick={registrar} disabled={feita} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${feita ? 'bg-green-100 text-green-700' : 'bg-primary-500 text-white'}`}>
            {feita ? '✓ Registrada hoje' : 'Comi esta refeição'}
          </button>
        )}
        {extras > 0 && (
          <button type="button" onClick={() => setAberta((a) => !a)} className="text-xs font-semibold text-primary-600">
            {aberta ? 'Esconder trocas e observações' : `Ver trocas e observações (${extras})`}
          </button>
        )}
      </div>
      {aberta && extras > 0 && (
        <div className="mt-1.5 space-y-1.5 text-xs text-foreground-600">
          {r.trocas.map((t) => (
            <p key={t.de}><span className="font-semibold text-foreground-800">Trocar {t.de} por:</span> {t.por.join(' ou ')}</p>
          ))}
          {r.obs.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4">
              {r.obs.map((o) => <li key={o}>{o}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Plano alimentar do nutricionista: o aluno importa o PDF e o app mostra as refeições do dia,
// destaca a próxima e usa as metas do plano no resumo de calorias e macros.
export default function PlanoNutricionista() {
  const { user, profile, refreshProfile } = useAuth();
  const plano = profile?.plano_nutri ?? null;
  const ref = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verExtras, setVerExtras] = useState(false);

  const salvar = async (p: PlanoAlimentar | null) => {
    if (!user) return;
    await setUserDoc(user.id, 'profile', 'main', { plano_nutri: p }, true);
    refreshProfile();
  };

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErro(null);
    setLendo(true);
    try {
      const { lerPlanoPdf } = await import('@/lib/planoAlimentarPdf');
      const p = await lerPlanoPdf(f);
      if (!p.refeicoes.length) throw new Error('vazio');
      await salvar(p);
    } catch {
      setErro('Não consegui ler as refeições deste arquivo. Envie o PDF do plano alimentar exportado pelo sistema do nutricionista.');
    } finally {
      setLendo(false);
    }
  };

  const entrada = <input ref={ref} type="file" className="hidden" onChange={escolher} data-testid="plano-arquivo" />;

  if (!plano) {
    return (
      <div className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/40 p-4">
        <div className="flex items-start gap-3">
          <i className="ri-file-list-3-line text-2xl text-primary-500"></i>
          <div className="flex-1">
            <h2 className="font-heading text-base font-bold text-foreground-950">Tem plano do nutricionista?</h2>
            <p className="mt-0.5 text-sm text-foreground-600">Envie o PDF e o app monta suas refeições com horários, trocas e metas do plano.</p>
            <button type="button" onClick={() => ref.current?.click()} disabled={lendo} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <i className={lendo ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'}></i>
              {lendo ? 'Lendo o plano...' : 'Importar plano alimentar'}
            </button>
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
          </div>
        </div>
        {entrada}
      </div>
    );
  }

  const prox = proxima(plano.refeicoes);
  const t = plano.totais;
  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="plano-nutri">
      <div className="flex items-center gap-2">
        <i className="ri-file-list-3-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-lg font-bold text-foreground-950">Plano do nutricionista</h2>
      </div>
      <p className="mt-0.5 text-xs text-foreground-500">Todos os dias · importado em {new Date(plano.importado_em).toLocaleDateString('pt-BR')}</p>
      {t && t.kcal > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {([['kcal', fmt(t.kcal)], ['Proteína', `${fmt(t.proteina)} g`], ['Carbo', `${fmt(t.carbo)} g`], ['Gordura', `${fmt(t.gordura)} g`]] as const).map(([l, v]) => (
            <div key={l} className="rounded-lg bg-background-100 px-1 py-2">
              <p className="font-heading text-sm font-bold text-foreground-950">{v}</p>
              <p className="text-[10px] text-foreground-500">{l}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {plano.refeicoes.map((r, i) => <Refeicao key={`${r.nome}-${i}`} r={r} destaque={i === prox} />)}
      </div>
      {plano.extras.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setVerExtras((v) => !v)} className="text-xs font-semibold text-primary-600">
            {verExtras ? 'Esconder' : 'Ver'} {plano.extras.map((e) => e.titulo.toLowerCase()).join(', ')}
          </button>
          {verExtras && plano.extras.map((e) => (
            <div key={e.titulo} className="mt-2">
              <p className="text-sm font-semibold text-foreground-900">{e.titulo}</p>
              <p className="whitespace-pre-line text-xs text-foreground-600">{e.texto.join('\n')}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2 border-t border-background-200 pt-3">
        <button type="button" onClick={() => ref.current?.click()} disabled={lendo} className="rounded-lg bg-background-100 px-3 py-1.5 text-xs font-semibold text-foreground-700">
          {lendo ? 'Lendo...' : 'Trocar plano'}
        </button>
        <button type="button" onClick={() => { if (confirm('Remover o plano do nutricionista?')) salvar(null); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground-500">
          Remover
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      {entrada}
    </div>
  );
}
