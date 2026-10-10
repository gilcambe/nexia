import { useEffect, useState } from 'react';
import { DIVISOES, divisaoSugerida, type Divisao, type EstadoDoDia } from '@/lib/dayPlan';
import type { Grupo } from '@/lib/exerciseDb';
import { treinoDiferente } from '@/lib/treinoDiferente';
import { diasPorSemana, tempoDoPerfil } from '@/lib/ficha';
import { useReadiness } from '@/components/feature/ReadinessContext';
import { statusMeta } from '@/lib/readinessEngine';
import MusicaTreino from './MusicaTreino';

interface PreTreinoProps {
  respostas: Record<string, unknown>;
  divisaoInicial?: Divisao; // divisão da ficha do aluno
  diaInicial?: number; // próximo dia do ciclo da ficha
  onStart: (config: {
    divisao: Divisao;
    diaDaDivisao: number;
    enfase: Grupo[];
    estado: EstadoDoDia;
  }) => void;
}

const GRUPOS_DISPONIVEIS: { id: Grupo; label: string }[] = [
  { id: 'peito', label: 'Peito' },
  { id: 'costas', label: 'Costas' },
  { id: 'ombros', label: 'Ombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'quadriceps', label: 'Quadríceps' },
  { id: 'posterior', label: 'Posterior' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'panturrilha', label: 'Panturrilha' },
  { id: 'abdomen', label: 'Abdômen' },
];

export default function PreTreino({ respostas, divisaoInicial, diaInicial, onStart }: PreTreinoProps) {
  const diasSemana = diasPorSemana(respostas);
  const divisaoPadrao = divisaoInicial ?? divisaoSugerida(diasSemana);

  const [divisao, setDivisao] = useState<Divisao>(divisaoPadrao);
  const [diaDaDivisao, setDiaDaDivisao] = useState<number>(diaInicial ?? 0);
  const [mudando, setMudando] = useState(false);
  const [enfase, setEnfase] = useState<Grupo[]>([]);
  
  // O check-in de Prontidão de hoje já responde sono e energia (o aluno pode mudar aqui).
  const { today, result: prontidao } = useReadiness();
  const sonoDoCheckin = (): EstadoDoDia['sono'] => {
    if (!today || today.sleep_hours == null) return 'bom';
    const h = today.sleep_hours, q = today.sleep_quality ?? 3;
    return h < 6 || q <= 2 ? 'ruim' : h < 7 || q === 3 ? 'regular' : 'bom';
  };
  const energiaDoCheckin = (): EstadoDoDia['energia'] => {
    if (!today || today.energy == null) return 4;
    let e = Math.min(5, Math.max(1, Math.ceil(today.energy / 2)));
    if (prontidao?.status === 'reduzir') e = Math.min(e, 2);
    return e as EstadoDoDia['energia'];
  };
  const [sono, setSono] = useState<EstadoDoDia['sono']>(sonoDoCheckin);
  const [alimentacao, setAlimentacao] = useState<EstadoDoDia['alimentacao']>('comi_bem');
  const [energia, setEnergia] = useState<EstadoDoDia['energia']>(energiaDoCheckin);
  useEffect(() => {
    if (!today) return;
    setSono(sonoDoCheckin());
    setEnergia(energiaDoCheckin());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.check_in_date, today?.readiness_score]);
  const [tempoMin, setTempoMin] = useState<number>(tempoDoPerfil(respostas));
  const [dores, setDores] = useState<string>('');

  const diasDaDivisaoAtual = DIVISOES[divisao].dias;

  const toggleEnfase = (g: Grupo) => {
    if (enfase.includes(g)) {
      setEnfase(enfase.filter((x) => x !== g));
    } else {
      if (enfase.length >= 2) {
        setEnfase([enfase[1], g]);
      } else {
        setEnfase([...enfase, g]);
      }
    }
  };

  const handleSubmit = (e: import('react').FormEvent) => {
    e.preventDefault();
    onStart({
      divisao,
      diaDaDivisao,
      enfase,
      estado: {
        sono,
        alimentacao,
        energia,
        tempoMin,
        dores,
        indisponiveis: [],
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto sm:px-4 sm:py-6 text-slate-800 dark:text-slate-100">
      <div className="mb-6 sm:mb-8">
        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full mb-2">
          Antes de Treinar
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Treino de hoje</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Seguindo a sua ficha. Conte como você está hoje: o treino se ajusta ao seu sono, alimentação, energia, tempo e dores.
        </p>
      </div>

      <div className="mb-5 sm:mb-8"><MusicaTreino variante="cartao" /></div>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-8">
        {/* Treino da ficha */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Na sua ficha ({DIVISOES[divisao].nome})</p>
          <p className="mt-1 text-lg font-bold">{diasDaDivisaoAtual[diaDaDivisao]?.titulo ?? diasDaDivisaoAtual[0].titulo}</p>
          {mudando && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Treino diferente só por hoje. A sua ficha continua a mesma.</p>}
        </div>

        {/* Como você está hoje */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-6">
          <h2 className="text-base font-semibold flex items-center gap-2">
            Como você está HOJE?
          </h2>
          {today && prontidao && (
            <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400" data-testid="pre-prontidao">
              Preenchido com seu check-in de hoje: Prontidão {prontidao.score} ({statusMeta[prontidao.status].label}). {prontidao.decision}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sono */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Sono</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'bom', label: 'Dormi bem' },
                  { id: 'regular', label: 'Regular' },
                  { id: 'ruim', label: 'Dormi mal' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSono(item.id as EstadoDoDia['sono'])}
                    className={`py-2.5 px-1.5 text-xs font-medium rounded-xl border text-center transition-all ${
                      sono === item.id
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alimentação */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Alimentação pré-treino</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'comi_bem', label: 'Comi bem' },
                  { id: 'comi_pouco', label: 'Comi pouco' },
                  { id: 'jejum', label: 'Em jejum' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setAlimentacao(item.id as EstadoDoDia['alimentacao'])}
                    className={`py-2.5 px-1.5 text-xs font-medium rounded-xl border text-center transition-all ${
                      alimentacao === item.id
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Energia */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Nível de energia</label>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {energia === 1 && '1 - Exausto'}
                {energia === 2 && '2 - Baixa'}
                {energia === 3 && '3 - Normal'}
                {energia === 4 && '4 - Boa'}
                {energia === 5 && '5 - Pilhado'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setEnergia(n)}
                  className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                    energia === n
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Tempo disponível */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Tempo disponível</label>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{tempoMin} minutos</span>
            </div>
            <input
              type="range"
              min="20"
              max="120"
              step="5"
              value={tempoMin}
              onChange={(e) => setTempoMin(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>20 min</span>
              <span>60 min</span>
              <span>120 min</span>
            </div>
          </div>

          {/* Dores ou desconfortos hoje */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Alguma dor ou desconforto hoje? (opcional)
            </label>
            <input
              type="text"
              value={dores}
              onChange={(e) => setDores(e.target.value)}
              placeholder="Ex: Leve dor no ombro direito, joelho estalando..."
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {mudando && (
          <>
        {/* Escolha da Divisão */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            Divisão só para hoje
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Object.keys(DIVISOES) as Divisao[]).map((key) => {
              const item = DIVISOES[key];
              const isSelected = divisao === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => {
                    setDivisao(key);
                    setDiaDaDivisao(0);
                  }}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent'
                  }`}
                >
                  <div className="font-semibold text-sm">{item.nome}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {item.dias.length} {item.dias.length === 1 ? 'dia' : 'dias'} por ciclo
                  </div>
                </button>
              );
            })}
          </div>

          {/* Seleção do dia específico dentro da divisão */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Qual treino do ciclo você quer fazer hoje?
            </label>
            <select
              value={diaDaDivisao}
              onChange={(e) => setDiaDaDivisao(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {diasDaDivisaoAtual.map((d, index) => (
                <option key={index} value={index}>
                  {d.titulo}
                </option>
              ))}
            </select>
            {diaDaDivisao !== 0 && diasDaDivisaoAtual[0] && treinoDiferente(diasDaDivisaoAtual[0].titulo, diasDaDivisaoAtual[diaDaDivisao].titulo) && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Este treino tem foco muscular diferente do dia 1 do ciclo ({diasDaDivisaoAtual[0].titulo}).
              </p>
            )}
          </div>
        </div>

        {/* Ênfase */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Ênfase opcional (até 2)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quer focar em algum grupo muscular específico hoje? Ganha mais um exercício na rotina.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {GRUPOS_DISPONIVEIS.map((g) => {
              const ativo = enfase.includes(g.id);
              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => toggleEnfase(g.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    ativo
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

          </>
        )}

        {/* Botões */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            <span>Começar treino de hoje</span>
          </button>
          <button
            type="button"
            onClick={() => { if (mudando) { setDivisao(divisaoPadrao); setDiaDaDivisao(diaInicial ?? 0); setEnfase([]); } setMudando((v) => !v); }}
            className="py-4 px-6 rounded-2xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            {mudando ? 'Voltar para a ficha' : 'Mudar treino de hoje'}
          </button>
        </div>
      </form>
    </div>
  );
}
