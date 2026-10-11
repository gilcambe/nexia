import { useMemo, useState, type ReactNode } from 'react';
import { DIVISOES, type Divisao } from '@/lib/dayPlan';
import { EXERCICIOS, type Grupo } from '@/lib/exerciseDb';
import { idDoNome, novoExercicio, rascunhoDaFicha, type ExercicioCoach, type FichaCoach } from '@/lib/coach/fichaCoach';

const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: 'peito', nome: 'Peito' }, { id: 'costas', nome: 'Costas' }, { id: 'ombros', nome: 'Ombros' }, { id: 'biceps', nome: 'Bíceps' },
  { id: 'triceps', nome: 'Tríceps' }, { id: 'quadriceps', nome: 'Quadríceps' }, { id: 'posterior', nome: 'Posterior' },
  { id: 'gluteos', nome: 'Glúteos' }, { id: 'panturrilha', nome: 'Panturrilha' }, { id: 'abdomen', nome: 'Abdômen' },
];
const DESCANSOS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const LETRAS = 'ABCDEFG';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const campo = 'w-full rounded-lg border border-background-200 bg-background-50 px-2.5 py-2 text-sm text-foreground-900 outline-none focus:border-primary-300';

// Coach monta a ficha do aluno: rascunho automático pelo questionário do aluno, depois ajusta tudo à mão.
export default function FichaEditor({ nomeAluno, respostas, inicial, salvando, onSalvar, onRemover, rotuloEnviar, podeRemover = !!inicial, extraVazio, extraRodape }: {
  nomeAluno: string;
  respostas: Record<string, unknown>;
  inicial: FichaCoach | null;
  salvando: boolean;
  onSalvar: (f: FichaCoach) => void;
  onRemover: () => void;
  rotuloEnviar?: string;
  podeRemover?: boolean;
  extraVazio?: ReactNode; // ex.: "Usar um modelo"
  extraRodape?: (f: FichaCoach) => ReactNode; // ex.: salvar como modelo, PDF, WhatsApp
}) {
  const [ficha, setFicha] = useState<FichaCoach | null>(inicial);
  const [dia, setDia] = useState(0);
  const [escolhendo, setEscolhendo] = useState(false);
  const temQuestionario = Object.keys(respostas).some((k) => k !== 'mobility');

  if (!ficha) {
    return (
      <div className="space-y-4" data-testid="ficha-vazia">
        {nomeAluno && <p className="text-sm text-foreground-600">{nomeAluno} ainda não tem ficha montada por você. Enquanto isso, o app monta o treino sozinho.</p>}
        {extraVazio}
        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4">
          <h3 className="font-heading text-base font-bold text-foreground-950"><i className="ri-magic-line mr-1 text-primary-600"></i>Rascunho automático</h3>
          <p className="mt-1 text-sm text-foreground-700">
            {temQuestionario
              ? 'Escolha a divisão. O app monta os treinos pelo nível, objetivo, lesões e limitações do aluno, e você só ajusta.'
              : 'O aluno ainda não respondeu o questionário: o rascunho sai com um treino padrão. Ajuste à vontade.'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(DIVISOES) as Divisao[]).map((d) => (
              <button key={d} type="button" onClick={() => { setFicha(rascunhoDaFicha(respostas, d)); setDia(0); }} className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-left text-sm font-semibold text-foreground-900 hover:border-primary-300">
                {DIVISOES[d].nome}<span className="block text-[11px] font-normal text-foreground-500">{DIVISOES[d].dias.length} treino{DIVISOES[d].dias.length > 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => { setFicha({ nome: 'Minha ficha', obs: '', dias: [{ titulo: 'Treino A', exercicios: [] }] }); setDia(0); }} className="w-full rounded-xl border border-background-200 bg-background-50 px-4 py-3 text-sm font-semibold text-foreground-700">
          <i className="ri-edit-2-line mr-1"></i>Montar do zero
        </button>
      </div>
    );
  }

  const d = ficha.dias[Math.min(dia, ficha.dias.length - 1)];
  const iDia = ficha.dias.indexOf(d);
  const mudarDia = (fn: (x: typeof d) => typeof d) => setFicha({ ...ficha, dias: ficha.dias.map((x, i) => (i === iDia ? fn(x) : x)) });
  const mudarEx = (j: number, campos: Partial<ExercicioCoach>) => mudarDia((x) => ({ ...x, exercicios: x.exercicios.map((e, k) => (k === j ? { ...e, ...campos } : e)) }));
  const moverEx = (j: number, para: number) => mudarDia((x) => {
    if (para < 0 || para >= x.exercicios.length) return x;
    const l = x.exercicios.slice();
    const [e] = l.splice(j, 1);
    l.splice(para, 0, e);
    return { ...x, exercicios: l };
  });
  const vazios = ficha.dias.filter((x) => !x.exercicios.length).length;

  return (
    <div className="space-y-4" data-testid="ficha-editor">
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-foreground-600">Nome da ficha
          <input value={ficha.nome} onChange={(e) => setFicha({ ...ficha, nome: e.target.value })} maxLength={60} className={`${campo} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-foreground-600">Recado para o aluno (opcional)
          <textarea value={ficha.obs} onChange={(e) => setFicha({ ...ficha, obs: e.target.value })} maxLength={500} rows={2} placeholder="Ex.: aqueça bem os ombros antes do supino." className={`${campo} mt-1`} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Treinos da ficha">
        {ficha.dias.map((x, i) => (
          <button key={i} type="button" onClick={() => setDia(i)} aria-pressed={i === iDia} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === iDia ? 'bg-primary-500 text-background-50' : 'border border-background-200 bg-background-50 text-foreground-700'}`}>
            {x.titulo.split('·')[0].trim() || `Treino ${LETRAS[i]}`} ({x.exercicios.length})
          </button>
        ))}
        {ficha.dias.length < 7 && (
          <button type="button" onClick={() => { setFicha({ ...ficha, dias: [...ficha.dias, { titulo: `Treino ${LETRAS[ficha.dias.length]}`, exercicios: [] }] }); setDia(ficha.dias.length); }} className="rounded-full border border-dashed border-primary-300 px-3 py-1.5 text-xs font-semibold text-primary-700">
            + Treino
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-background-200 bg-background-50 p-3">
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-xs font-semibold text-foreground-600">Nome do treino
            <input value={d.titulo} onChange={(e) => mudarDia((x) => ({ ...x, titulo: e.target.value }))} maxLength={60} className={`${campo} mt-1`} />
          </label>
          {ficha.dias.length > 1 && (
            <button type="button" onClick={() => { if (window.confirm(`Apagar o ${d.titulo}?`)) { setFicha({ ...ficha, dias: ficha.dias.filter((_, i) => i !== iDia) }); setDia(0); } }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600" aria-label="Apagar este treino">
              <i className="ri-delete-bin-line"></i>
            </button>
          )}
        </div>

        <ol className="mt-3 space-y-3">
          {d.exercicios.map((x, j) => (
            <li key={`${x.id}-${j}`} className="rounded-xl bg-background-100/70 p-3" data-testid="ficha-exercicio">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground-950">{j + 1}. {x.nome}</p>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => moverEx(j, j - 1)} disabled={j === 0} aria-label={`Subir ${x.nome}`} className="rounded p-1 text-foreground-600 disabled:opacity-30"><i className="ri-arrow-up-line"></i></button>
                  <button type="button" onClick={() => moverEx(j, j + 1)} disabled={j === d.exercicios.length - 1} aria-label={`Descer ${x.nome}`} className="rounded p-1 text-foreground-600 disabled:opacity-30"><i className="ri-arrow-down-line"></i></button>
                  <button type="button" onClick={() => mudarDia((y) => ({ ...y, exercicios: y.exercicios.filter((_, k) => k !== j) }))} aria-label={`Tirar ${x.nome}`} className="rounded p-1 text-red-600"><i className="ri-close-line"></i></button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-[11px] font-semibold text-foreground-500">Séries
                  <input type="number" inputMode="numeric" min={1} max={10} value={x.series} onChange={(e) => mudarEx(j, { series: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} className={`${campo} mt-0.5`} aria-label={`Séries de ${x.nome}`} />
                </label>
                <label className="text-[11px] font-semibold text-foreground-500">Repetições
                  <input value={x.reps} onChange={(e) => mudarEx(j, { reps: e.target.value })} maxLength={12} placeholder="8–12" className={`${campo} mt-0.5`} aria-label={`Repetições de ${x.nome}`} />
                </label>
                <label className="text-[11px] font-semibold text-foreground-500">Descanso
                  <select value={x.descanso} onChange={(e) => mudarEx(j, { descanso: Number(e.target.value) })} className={`${campo} mt-0.5`} aria-label={`Descanso de ${x.nome}`}>
                    {[...new Set([...DESCANSOS, x.descanso])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-[11px] font-semibold text-foreground-500">Carga
                  <input value={x.carga} onChange={(e) => mudarEx(j, { carga: e.target.value })} maxLength={16} placeholder="ex.: 20 kg" className={`${campo} mt-0.5`} aria-label={`Carga de ${x.nome}`} />
                </label>
                <label className="col-span-2 text-[11px] font-semibold text-foreground-500">Observação
                  <input value={x.obs} onChange={(e) => mudarEx(j, { obs: e.target.value })} maxLength={200} placeholder="ex.: descida em 3 segundos" className={`${campo} mt-0.5`} aria-label={`Observação de ${x.nome}`} />
                </label>
              </div>
            </li>
          ))}
        </ol>
        {d.exercicios.length < 15 && (
          <button type="button" onClick={() => setEscolhendo(true)} className="mt-3 w-full rounded-xl border border-dashed border-primary-300 px-4 py-2.5 text-sm font-semibold text-primary-700">
            <i className="ri-add-line mr-1"></i>Adicionar exercício
          </button>
        )}
      </div>

      {escolhendo && (
        <EscolherExercicio
          jaNoTreino={d.exercicios.map((x) => x.id)}
          onFechar={() => setEscolhendo(false)}
          onEscolher={(x) => { mudarDia((y) => ({ ...y, exercicios: [...y.exercicios, x] })); setEscolhendo(false); }}
        />
      )}

      {vazios > 0 && <p className="text-xs text-secondary-800">Treino sem exercício não vai para o aluno ({vazios}).</p>}
      <button type="button" disabled={salvando || ficha.dias.every((x) => !x.exercicios.length)} onClick={() => onSalvar(ficha)} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
        <i className={salvando ? 'ri-loader-4-line mr-1 animate-spin' : 'ri-send-plane-line mr-1'}></i>{salvando ? 'Enviando...' : rotuloEnviar ?? `Enviar ficha para ${nomeAluno}`}
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={() => { if (window.confirm('Descartar o que mudou aqui?')) { setFicha(inicial); setDia(0); } }} className="flex-1 rounded-xl border border-background-200 px-3 py-2 text-xs font-semibold text-foreground-600">Desfazer mudanças</button>
        {podeRemover && <button type="button" onClick={() => { if (window.confirm(`Tirar a ficha de ${nomeAluno}? O app volta a montar o treino sozinho.`)) onRemover(); }} className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Tirar ficha do aluno</button>}
      </div>
      {extraRodape?.(ficha)}
    </div>
  );
}

function EscolherExercicio({ jaNoTreino, onEscolher, onFechar }: { jaNoTreino: string[]; onEscolher: (x: ExercicioCoach) => void; onFechar: () => void }) {
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState<Grupo | ''>('');
  const lista = useMemo(() => EXERCICIOS.filter((x) => (!grupo || x.grupo === grupo) && (!busca || norm(x.nome).includes(norm(busca)))), [busca, grupo]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-label="Escolher exercício">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-background-50 p-4 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground-950">Adicionar exercício</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1 text-foreground-500"><i className="ri-close-line text-xl"></i></button>
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: supino, agachamento..." aria-label="Buscar exercício" className={`${campo} mt-3`} autoFocus />
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          <button type="button" onClick={() => setGrupo('')} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${!grupo ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-700'}`}>Todos</button>
          {GRUPOS.map((g) => <button key={g.id} type="button" onClick={() => setGrupo(g.id)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${grupo === g.id ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-700'}`}>{g.nome}</button>)}
        </div>
        <ul className="mt-2 flex-1 space-y-1.5 overflow-y-auto">
          {lista.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => onEscolher(novoExercicio(x.id))} className="flex w-full items-center justify-between rounded-xl border border-background-200 px-3 py-2.5 text-left text-sm hover:border-primary-300">
                <span><span className="font-medium text-foreground-900">{x.nome}</span><span className="block text-[11px] text-foreground-500">{GRUPOS.find((g) => g.id === x.grupo)?.nome}{jaNoTreino.includes(x.id) ? ' · já está no treino' : ''}</span></span>
                <i className="ri-add-circle-line text-lg text-primary-500"></i>
              </button>
            </li>
          ))}
          {busca.trim().length >= 3 && (
            <li>
              <button type="button" onClick={() => onEscolher(novoExercicio(idDoNome(busca.trim()), busca.trim()))} className="w-full rounded-xl border border-dashed border-primary-300 px-3 py-2.5 text-left text-sm font-semibold text-primary-700">
                <i className="ri-add-line mr-1"></i>Usar “{busca.trim()}” (exercício próprio)
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
