import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Macros, PlanoAlimentar, RefeicaoPlano } from '@/lib/planoAlimentar';

export type Plano = Pick<PlanoAlimentar, 'refeicoes' | 'totais' | 'extras'>;
// sem largura: quem usa escolhe (w-full na maioria; na linha do alimento o nome estica e a quantidade fica fixa)
const caixa = 'rounded-lg border border-background-200 bg-background-50 px-2.5 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300';
const campo = `w-full ${caixa}`;
const refeicao = (nome: string, horario: string): RefeicaoPlano => ({ nome, horario, itens: [{ nome: '', qtd: '' }], trocas: [], obs: [], macros: null });
const MODELO: RefeicaoPlano[] = [
  refeicao('Café da manhã', '07:00'), refeicao('Lanche da manhã', '10:00'), refeicao('Almoço', '12:30'),
  refeicao('Lanche da tarde', '16:00'), refeicao('Jantar', '19:30'),
];

// Coach monta (ou importa do PDF da nutricionista) o plano alimentar do aluno, no mesmo formato que o app do aluno já mostra.
export default function DietaEditor({ nomeAluno, inicial, salvando, onSalvar, onRemover, rotuloEnviar, podeRemover = !!inicial, extraVazio, extraRodape }: {
  nomeAluno: string;
  inicial: Plano | null;
  salvando: boolean;
  onSalvar: (p: Plano) => void;
  onRemover: () => void;
  rotuloEnviar?: string;
  podeRemover?: boolean;
  extraVazio?: ReactNode;
  extraRodape?: (p: Plano) => ReactNode;
}) {
  const [plano, setPlano] = useState<Plano | null>(inicial ? { refeicoes: inicial.refeicoes, totais: inicial.totais, extras: inicial.extras ?? [] } : null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErro(''); setLendo(true);
    try {
      const { lerPlanoPdf } = await import('@/lib/planoAlimentarPdf');
      const p = await lerPlanoPdf(f);
      if (!p.refeicoes.length) throw new Error('vazio');
      setPlano({ refeicoes: p.refeicoes, totais: p.totais, extras: p.extras });
    } catch {
      setErro('Não consegui ler as refeições deste PDF. Use o PDF do plano alimentar exportado pelo sistema de nutrição, ou monte à mão.');
    } finally {
      setLendo(false);
    }
  };
  const entrada = <input ref={arquivo} type="file" accept="application/pdf,.pdf" className="hidden" onChange={importar} data-testid="dieta-pdf" />;

  if (!plano) {
    return (
      <div className="space-y-3" data-testid="dieta-vazia">
        {nomeAluno && <p className="text-sm text-foreground-600">{nomeAluno} ainda não tem plano alimentar. Sem plano, o app sugere um cardápio pelas metas do aluno.</p>}
        {extraVazio}
        <button type="button" onClick={() => setPlano({ refeicoes: MODELO, totais: null, extras: [] })} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 dark:text-foreground-950">
          <i className="ri-restaurant-line mr-1"></i>Montar com 5 refeições
        </button>
        <button type="button" onClick={() => arquivo.current?.click()} disabled={lendo} className="w-full rounded-xl border border-background-200 bg-background-50 px-4 py-3 text-sm font-semibold text-foreground-700 disabled:opacity-60">
          <i className={lendo ? 'ri-loader-4-line mr-1 animate-spin' : 'ri-file-upload-line mr-1'}></i>{lendo ? 'Lendo o PDF...' : 'Importar PDF da nutricionista'}
        </button>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        {entrada}
      </div>
    );
  }

  const t: Macros = plano.totais ?? { kcal: 0, proteina: 0, carbo: 0, gordura: 0 };
  const mudarTotal = (k: keyof Macros, v: string) => setPlano({ ...plano, totais: { ...t, [k]: Math.max(0, Number(v) || 0) } });
  const mudarRef = (i: number, r: Partial<RefeicaoPlano>) => setPlano({ ...plano, refeicoes: plano.refeicoes.map((x, k) => (k === i ? { ...x, ...r } : x)) });
  const semItens = plano.refeicoes.filter((r) => !r.itens.some((it) => it.nome.trim())).length;

  return (
    <div className="space-y-4" data-testid="dieta-editor">
      <div className="rounded-2xl border border-background-200 bg-background-50 p-3">
        <p className="text-xs font-semibold text-foreground-600">Metas do dia (opcional: viram as metas do aluno no app)</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {([['kcal', 'kcal'], ['proteina', 'Prot. g'], ['carbo', 'Carbo g'], ['gordura', 'Gord. g']] as const).map(([k, l]) => (
            <label key={k} className="text-[11px] font-semibold text-foreground-500">{l}
              <input type="number" inputMode="numeric" min={0} value={t[k] || ''} onChange={(e) => mudarTotal(k, e.target.value)} className={`${campo} mt-0.5 px-1.5`} aria-label={`Meta de ${l}`} />
            </label>
          ))}
        </div>
      </div>

      <ol className="space-y-3">
        {plano.refeicoes.map((r, i) => (
          <li key={i} className="rounded-2xl border border-background-200 bg-background-50 p-3" data-testid="dieta-refeicao">
            <div className="flex items-end gap-2">
              <label className="w-24 shrink-0 text-[11px] font-semibold text-foreground-500">Horário
                <input type="time" value={r.horario ?? ''} onChange={(e) => mudarRef(i, { horario: e.target.value || null })} className={`${campo} mt-0.5 px-1.5`} aria-label={`Horário de ${r.nome}`} />
              </label>
              <label className="flex-1 text-[11px] font-semibold text-foreground-500">Refeição
                <input value={r.nome} onChange={(e) => mudarRef(i, { nome: e.target.value })} maxLength={40} className={`${campo} mt-0.5`} aria-label={`Nome da refeição ${i + 1}`} />
              </label>
              <button type="button" onClick={() => setPlano({ ...plano, refeicoes: plano.refeicoes.filter((_, k) => k !== i) })} aria-label={`Tirar ${r.nome}`} className="rounded-lg border border-red-200 px-2.5 py-2 text-red-600"><i className="ri-delete-bin-line"></i></button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {r.itens.map((it, j) => (
                <li key={j} className="flex gap-1.5">
                  <input value={it.nome} onChange={(e) => mudarRef(i, { itens: r.itens.map((x, k) => (k === j ? { ...x, nome: e.target.value } : x)) })} maxLength={80} placeholder="Alimento (ex.: ovo cozido)" aria-label={`Alimento ${j + 1} de ${r.nome}`} className={`${caixa} min-w-0 flex-1`} />
                  <input value={it.qtd} onChange={(e) => mudarRef(i, { itens: r.itens.map((x, k) => (k === j ? { ...x, qtd: e.target.value } : x)) })} maxLength={40} placeholder="Qtd. (2 un)" aria-label={`Quantidade ${j + 1} de ${r.nome}`} className={`${caixa} w-24 shrink-0`} />
                  <button type="button" onClick={() => mudarRef(i, { itens: r.itens.filter((_, k) => k !== j) })} aria-label={`Tirar alimento ${j + 1}`} className="px-1 text-foreground-400"><i className="ri-close-line"></i></button>
                </li>
              ))}
            </ul>
            {r.itens.length < 20 && <button type="button" onClick={() => mudarRef(i, { itens: [...r.itens, { nome: '', qtd: '' }] })} aria-label={`Adicionar alimento em ${r.nome}`} className="mt-2 text-xs font-semibold text-primary-700"><i className="ri-add-line mr-0.5"></i>Alimento</button>}
            <input value={r.obs.join(' ')} onChange={(e) => mudarRef(i, { obs: e.target.value ? [e.target.value] : [] })} maxLength={200} placeholder="Observação (opcional)" aria-label={`Observação de ${r.nome}`} className={`${campo} mt-2`} />
            {r.trocas.length > 0 && <p className="mt-1 text-[11px] text-foreground-500">{r.trocas.length} troca{r.trocas.length > 1 ? 's' : ''} do PDF mantida{r.trocas.length > 1 ? 's' : ''}.</p>}
          </li>
        ))}
      </ol>
      {plano.refeicoes.length < 10 && (
        <button type="button" onClick={() => setPlano({ ...plano, refeicoes: [...plano.refeicoes, refeicao('Ceia', '22:00')] })} className="w-full rounded-xl border border-dashed border-primary-300 px-4 py-2.5 text-sm font-semibold text-primary-700">
          <i className="ri-add-line mr-1"></i>Adicionar refeição
        </button>
      )}

      {semItens > 0 && <p className="text-xs text-secondary-800">Refeição sem alimento não vai para o aluno ({semItens}).</p>}
      <button type="button" disabled={salvando || semItens === plano.refeicoes.length} onClick={() => onSalvar(plano)} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
        <i className={salvando ? 'ri-loader-4-line mr-1 animate-spin' : 'ri-send-plane-line mr-1'}></i>{salvando ? 'Enviando...' : rotuloEnviar ?? `Enviar dieta para ${nomeAluno}`}
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={() => arquivo.current?.click()} disabled={lendo} className="flex-1 rounded-xl border border-background-200 px-3 py-2 text-xs font-semibold text-foreground-600">{lendo ? 'Lendo...' : 'Trocar pelo PDF'}</button>
        {podeRemover && <button type="button" onClick={() => { if (window.confirm(`Tirar o plano alimentar de ${nomeAluno}?`)) onRemover(); }} className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Tirar dieta do aluno</button>}
      </div>
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      {entrada}
      {extraRodape?.(plano)}
    </div>
  );
}
