import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { listUserDocs, setUserDoc } from '@/lib/userData';
import { useAuth } from './AuthContext';
import { localDateKey } from '@/lib/localDemo';
import { localReadinessSeed } from '@/mocks/localDemo';
import {
  computeReadiness,
  type ReadinessResult,
  type ReadinessInput,
} from '@/lib/readinessEngine';

export interface DailyReadinessRow {
  id: number;
  check_in_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  soreness: number | null;
  fatigue: number | null;
  energy: number | null;
  stress: number | null;
  pain_level: number | null;
  hrv: number | null;
  rhr: number | null;
  readiness_score: number | null;
  notes: string | null;
  created_at: string;
}

interface ReadinessContextValue {
  entries: DailyReadinessRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  today: DailyReadinessRow | null;
  latest: DailyReadinessRow | null;
  streak: number;
  result: ReadinessResult | null;
  hasCheckedToday: boolean;
  checkIn: (input: ReadinessInput, notes?: string) => Promise<{ error: string | null }>;
}

const ReadinessContext = createContext<ReadinessContextValue | null>(null);

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildLocalReadinessRows(): DailyReadinessRow[] {
  return localReadinessSeed
    .map((s, i) => {
      const input: ReadinessInput = {
        sleepHours: s.sleep_hours,
        sleepQuality: s.sleep_quality,
        soreness: s.soreness,
        fatigue: s.fatigue,
        energy: s.energy,
        stress: s.stress,
        painLevel: s.pain_level,
        hrv: s.hrv,
        rhr: s.rhr,
      };
      const row: DailyReadinessRow = {
        id: i + 1,
        check_in_date: localDateKey(s.offset),
        sleep_hours: s.sleep_hours,
        sleep_quality: s.sleep_quality,
        soreness: s.soreness,
        fatigue: s.fatigue,
        energy: s.energy,
        stress: s.stress,
        pain_level: s.pain_level,
        hrv: s.hrv,
        rhr: s.rhr,
        readiness_score: computeReadiness(input).score,
        notes: s.notes,
        created_at: new Date().toISOString(),
      };
      return row;
    })
    .sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));
}

function toInput(row: DailyReadinessRow): ReadinessInput {
  return {
    sleepHours: row.sleep_hours ?? 8,
    sleepQuality: row.sleep_quality ?? 4,
    soreness: row.soreness ?? 3,
    fatigue: row.fatigue ?? 4,
    energy: row.energy ?? 7,
    stress: row.stress ?? 4,
    painLevel: row.pain_level ?? 0,
    hrv: row.hrv,
    rhr: row.rhr,
  };
}

export function useReadiness() {
  const ctx = useContext(ReadinessContext);
  if (!ctx) throw new Error('useReadiness deve ser usado dentro do ReadinessProvider');
  return ctx;
}

export function ReadinessProvider({ children }: { children: ReactNode }) {
  const { user, isLocalDemo } = useAuth();
  const [entries, setEntries] = useState<DailyReadinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setEntries([]);
        setLoading(false);
        return;
      }
      if (isLocalDemo) {
        setEntries(buildLocalReadinessRows());
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await listUserDocs<DailyReadinessRow>(user.id, 'daily_readiness', 'check_in_date', 'desc');
        if (!active) return;
        setEntries(data.map(({ _docId, ...row }) => row as DailyReadinessRow));
      } catch {
        if (active) setError('Não foi possível carregar seu check-in.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user?.id, reloadKey, isLocalDemo]);

  const checkIn = useCallback(
    async (input: ReadinessInput, notes?: string) => {
      if (!user) return { error: 'Usuário não autenticado.' };
      const score = computeReadiness(input).score;
      const todayKey = toDateKey(new Date());

      // MODO LOCAL: atualiza o estado em memória, sem tocar no backend.
      if (isLocalDemo) {
        setEntries((prev) => {
          const others = prev.filter((e) => e.check_in_date.slice(0, 10) !== todayKey);
          const row: DailyReadinessRow = {
            id: Date.now(),
            check_in_date: todayKey,
            sleep_hours: input.sleepHours,
            sleep_quality: input.sleepQuality,
            soreness: input.soreness,
            fatigue: input.fatigue,
            energy: input.energy,
            stress: input.stress,
            pain_level: input.painLevel,
            hrv: input.hrv ?? null,
            rhr: input.rhr ?? null,
            readiness_score: score,
            notes: notes || null,
            created_at: new Date().toISOString(),
          };
          return [row, ...others].sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));
        });
        return { error: null };
      }

      // Um check-in por dia: o id do documento é a própria data (equivale ao
      // upsert por user_id + check_in_date do original).
      const existing = entries.find((e) => e.check_in_date.slice(0, 10) === todayKey);
      const nowIso = new Date().toISOString();
      const err = await setUserDoc(user.id, 'daily_readiness', todayKey, {
        id: existing?.id ?? Date.now(),
        user_id: user.id,
        check_in_date: todayKey,
        sleep_hours: input.sleepHours,
        sleep_quality: input.sleepQuality,
        soreness: input.soreness,
        fatigue: input.fatigue,
        energy: input.energy,
        stress: input.stress,
        pain_level: input.painLevel,
        hrv: input.hrv ?? null,
        rhr: input.rhr ?? null,
        readiness_score: score,
        notes: notes || null,
        created_at: existing?.created_at ?? nowIso,
      })
        .then(() => null)
        .catch((e: unknown) => (e instanceof Error ? e : new Error('Falha ao salvar o check-in.')));
      if (err) return { error: err.message };
      reload();
      return { error: null };
    },
    [user?.id, reload, isLocalDemo, entries],
  );

  const todayKey = toDateKey(new Date());
  const today = entries.find((e) => e.check_in_date.slice(0, 10) === todayKey) ?? null;
  const latest = entries.length > 0 ? entries[0] : null;

  const result = useMemo<ReadinessResult | null>(() => {
    if (!latest) return null;
    return computeReadiness(toInput(latest));
  }, [latest]);

  const streak = useMemo(() => {
    const dateSet = new Set(entries.map((e) => e.check_in_date.slice(0, 10)));
    let count = 0;
    const cursor = new Date();
    if (!dateSet.has(toDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (dateSet.has(toDateKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [entries]);

  const value = useMemo(
    () => ({
      entries,
      loading,
      error,
      reload,
      today,
      latest,
      streak,
      result,
      hasCheckedToday: today !== null,
      checkIn,
    }),
    [entries, loading, error, reload, today, latest, streak, result, checkIn],
  );

  return <ReadinessContext.Provider value={value}>{children}</ReadinessContext.Provider>;
}