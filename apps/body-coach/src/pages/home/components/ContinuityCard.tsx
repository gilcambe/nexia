import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';

interface WorkoutRecord {
  title?: string;
  done_at?: string;
  duration_min?: number;
  sets?: number;
  volume_kg?: number;
}

export default function ContinuityCard() {
  const { user } = useAuth();

  let lastWorkout: WorkoutRecord | null = null;
  if (user?.id) {
    try {
      const stored = localStorage.getItem('bc_workouts_' + user.id);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lastWorkout = parsed[parsed.length - 1];
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-history-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Último treino</h2>
        </div>
      </div>

      {lastWorkout ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-100 p-4 dark:bg-surface-800">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-foreground-950">{lastWorkout.title || 'Treino realizado'}</h3>
                {lastWorkout.done_at && (
                  <p className="text-xs text-foreground-500 mt-0.5">
                    {new Date(lastWorkout.done_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Link
                to="/history"
                className="text-xs font-medium text-primary-500 hover:underline"
              >
                Ver histórico
              </Link>
            </div>
            
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {lastWorkout.duration_min !== undefined && (
                <div className="rounded-lg bg-surface-200/50 p-2 dark:bg-surface-700/50">
                  <span className="block text-foreground-500">Duração</span>
                  <span className="font-semibold text-foreground-900">{lastWorkout.duration_min} min</span>
                </div>
              )}
              {lastWorkout.sets !== undefined && (
                <div className="rounded-lg bg-surface-200/50 p-2 dark:bg-surface-700/50">
                  <span className="block text-foreground-500">Séries</span>
                  <span className="font-semibold text-foreground-900">{lastWorkout.sets}</span>
                </div>
              )}
              {lastWorkout.volume_kg !== undefined && (
                <div className="rounded-lg bg-surface-200/50 p-2 dark:bg-surface-700/50">
                  <span className="block text-foreground-500">Volume</span>
                  <span className="font-semibold text-foreground-900">{lastWorkout.volume_kg} kg</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/workout"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              Novo treino
            </Link>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-foreground-500">Nenhum treino registrado ainda. Seus treinos aparecem aqui.</p>
          <div className="mt-4">
            <Link
              to="/workout"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
            >
              Começar treino
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}