import { useCallback, useEffect, useState } from 'react';
import { listUserDocs, getUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import { readLocalList, localIso, LOCAL_PROGRESS_KEY } from '@/lib/localDemo';
import { localProgressSeed, localDemoProfile } from '@/mocks/localDemo';

export interface ProgressEntry {
  id: number;
  weight_kg: number | null;
  body_fat_pct: number | null;
  measurements: Record<string, number>;
  image_url: string | null;
  notes: string | null;
  taken_at: string;
  signedUrl: string | null;
}

export interface WeightTrendPoint {
  label: string;
  peso: number;
  cintura: number | null;
}

interface ProgressData {
  entries: ProgressEntry[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  latest: ProgressEntry | null;
  height: number;
  goalBodyFat: number;
  goalWeight: number | null;
  weightTrend: WeightTrendPoint[];
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

interface LocalProgressRecord {
  offset?: number;
  taken_at?: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist?: number | null;
  measurements?: Record<string, number>;
  notes: string | null;
}

function buildLocalEntries(): ProgressEntry[] {
  const stored = readLocalList<LocalProgressRecord>(LOCAL_PROGRESS_KEY);
  const records: LocalProgressRecord[] = stored ?? (localProgressSeed as LocalProgressRecord[]);
  return records
    .map((r) => {
      const takenAt = r.taken_at ?? localIso(r.offset ?? 0);
      const measurements = r.measurements ?? (r.waist != null ? { cintura: r.waist } : {});
      const entry: ProgressEntry = {
        id: new Date(takenAt).getTime(),
        weight_kg: r.weight_kg,
        body_fat_pct: r.body_fat_pct,
        measurements,
        image_url: null,
        notes: r.notes,
        taken_at: takenAt,
        signedUrl: null,
      };
      return entry;
    })
    .sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
}

// No Firestore a foto já vem dentro do documento (data URL): não há URL assinada.
function withPhotoUrls(entries: ProgressEntry[]): ProgressEntry[] {
  return entries.map((e) => ({ ...e, signedUrl: e.image_url || null }));
}

export function useProgressData(userId: string | undefined): ProgressData {
  const { isLocalDemo } = useAuth();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [height, setHeight] = useState(178);
  const [goalBodyFat, setGoalBodyFat] = useState(12);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!userId) {
        setEntries([]);
        setLoading(false);
        return;
      }

      if (isLocalDemo) {
        setEntries(buildLocalEntries());
        setHeight(localDemoProfile.height_cm);
        setGoalBodyFat(localDemoProfile.goal_body_fat_pct);
        setGoalWeight(localDemoProfile.goal_weight_kg);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [rawEntries, profileData] = await Promise.all([
          listUserDocs<Omit<ProgressEntry, 'signedUrl'>>(userId, 'progress_entries', 'taken_at', 'asc'),
          getUserDoc<{
            height_cm: number | null;
            goal_body_fat_pct: number | null;
            goal_weight_kg: number | null;
          }>(userId, 'profile', 'main').catch(() => null),
        ]);

        const withSigned = withPhotoUrls(
          rawEntries.map(({ _docId, ...e }) => ({
            ...e,
            measurements: (e.measurements ?? {}) as Record<string, number>,
            signedUrl: null,
          })),
        );

        if (!active) return;

        setEntries(withSigned);

        const onboardingData = await getUserDoc<{\n          height?: string | number | null;\n        }>(userId, 'onboarding', 'main').catch(() => null);\n\n        if (!active) return;\n\n        setEntries(withSigned);\n\n        // Regras para height:\n        // 1. perfil quando existir (height_cm)\n        // 2. quando o perfil não tiver height_cm, use a altura do questionário Number(onboarding.height) se for maior que 0\n        // 3. só se nenhum existir use 170\n        let resolvedHeight = 170;\n        if (profileData && profileData.height_cm && Number(profileData.height_cm) > 0) {\n          resolvedHeight = Number(profileData.height_cm);\n        } else if (onboardingData && onboardingData.height != null && Number(onboardingData.height) > 0) {\n          resolvedHeight = Number(onboardingData.height);\n        }\n        setHeight(resolvedHeight);\n\n        // Regras para goalBodyFat:\n        // 1. perfil quando existir (goal_body_fat_pct)\n        // 2. quando não tiver goal_body_fat_pct use 15\n        let resolvedGoalBodyFat = 15;\n        if (profileData && profileData.goal_body_fat_pct != null && Number(profileData.goal_body_fat_pct) > 0) {\n          resolvedGoalBodyFat = Number(profileData.goal_body_fat_pct);\n        }\n        setGoalBodyFat(resolvedGoalBodyFat);\n\n        if (profileData) {\n          setGoalWeight(profileData.goal_weight_kg ?? null);\n        }
      } catch (err) {
        if (active) setError('Não foi possível carregar seus dados de progresso.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [userId, reloadKey, isLocalDemo]);

  const latest = entries.length > 0 ? entries[entries.length - 1] : null;

  const weightTrend: WeightTrendPoint[] = entries
    .filter((e) => e.weight_kg !== null)
    .map((e) => ({
      label: formatShortDate(e.taken_at),
      peso: e.weight_kg ?? 0,
      cintura: e.measurements?.cintura ?? null,
    }));

  return {
    entries,
    loading,
    error,
    reload,
    latest,
    height,
    goalBodyFat,
    goalWeight,
    weightTrend,
  };
}