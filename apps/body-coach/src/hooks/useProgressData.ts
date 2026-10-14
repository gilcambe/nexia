import { useCallback, useEffect, useState } from 'react';
import { listUserDocs, getUserDoc } from '@/lib/userData';
import type { Avaliacao, Sexo } from '@/lib/avaliacao/calculos';
import type { Fotos, PerfilAvaliacao } from '@/lib/avaliacao/dados';

export interface ProgressEntry {
  id: number;
  weight_kg: number | null;
  body_fat_pct: number | null;
  measurements: Record<string, number>;
  image_url: string | null;
  notes: string | null;
  taken_at: string;
  signedUrl: string | null;
  // Avaliação completa (antropometria/bioimpedância) e as 4 fotos, quando houver.
  avaliacao?: Avaliacao | null;
  fotos?: Fotos | null;
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
  perfil: PerfilAvaliacao;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// No Firestore a foto já vem dentro do documento (data URL): não há URL assinada.
function withPhotoUrls(entries: ProgressEntry[]): ProgressEntry[] {
  return entries.map((e) => ({ ...e, signedUrl: e.fotos?.frente || e.image_url || null }));
}

export function useProgressData(userId: string | undefined): ProgressData {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  // Sem dado do aluno: valores neutros (não os do atleta de exemplo).
  const [height, setHeight] = useState(170);
  const [goalBodyFat, setGoalBodyFat] = useState(15);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [perfil, setPerfil] = useState<PerfilAvaliacao>({ sexo: null, idade: null, altura: null, nome: null });
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


      setLoading(true);
      setError(null);

      try {
        const [rawEntries, profileData] = await Promise.all([
          listUserDocs<Omit<ProgressEntry, 'signedUrl'>>(userId, 'progress_entries', 'taken_at', 'asc'),
          getUserDoc<{
            height_cm: number | null;
            goal_body_fat_pct: number | null;
            goal_weight_kg: number | null;
            full_name?: string | null;
            apelido?: string | null;
            sexo?: Sexo | null;
            onboarding?: { height?: string; age?: string; name?: string };
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

        if (profileData) {
          const p = profileData;
          const obHeight = Number(p.onboarding?.height);
          if (p.height_cm) setHeight(p.height_cm);
          else if (obHeight > 0) setHeight(obHeight);
          if (p.goal_body_fat_pct) setGoalBodyFat(p.goal_body_fat_pct);
          setGoalWeight(p.goal_weight_kg ?? null);
          const idade = Number(p.onboarding?.age);
          setPerfil({
            sexo: p.sexo === 'M' || p.sexo === 'F' ? p.sexo : null,
            idade: idade > 0 ? idade : null,
            altura: p.height_cm || (obHeight > 0 ? obHeight : null),
            nome: p.full_name || p.onboarding?.name || p.apelido || null,
          });
        }
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
  }, [userId, reloadKey]);

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
    perfil,
  };
}