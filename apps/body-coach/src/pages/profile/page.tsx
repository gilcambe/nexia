import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc } from '@/lib/userData';
import Card, { CardHeader } from '@/components/base/Card';

type Answers = Record<string, string | string[] | undefined>;
interface SavedProfile {
  full_name?: string | null;
  email?: string | null;
  height_cm?: number | null;
  onboarding?: Answers;
}

const MISSING = 'Não informado';
const text = (v: unknown, suffix = '') => (typeof v === 'string' && v.trim() ? `${v.trim()}${suffix}` : MISSING);

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background-100/70 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-foreground-500">
        <i className={`${icon} text-primary-500`}></i>
        {label}
      </span>
      <span className="text-sm font-medium text-foreground-900">{value}</span>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">{label}</p>
      <div className="rounded-lg bg-background-100/70 p-3 text-sm text-foreground-700">{text(value)}</div>
    </div>
  );
}

export default function Profile() {
  const { user, profile } = useAuth();
  // Lê o perfil salvo de novo ao abrir a página: o questionário pode ter acabado de gravar as respostas.
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  useEffect(() => {
    if (!user) return;
    getUserDoc<SavedProfile>(user.id, 'profile', 'main').then(setSaved).catch(() => {});
  }, [user]);

  const data: SavedProfile = { ...(profile ?? {}), ...(saved ?? {}) };
  const ob: Answers = data.onboarding ?? {};
  const name = data.full_name || (typeof ob.name === 'string' && ob.name.trim()) || user?.email || MISSING;
  const height = data.height_cm ? `${data.height_cm} cm` : text(ob.height, ' cm');
  const modality = Array.isArray(ob.modality) ? ob.modality : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Perfil</h1>
        <p className="mt-1 text-sm text-foreground-600">Identidade, saúde e preferências do atleta.</p>
      </header>

      {!data.onboarding && (
        <Card padding="p-5">
          <CardHeader title="Complete seu perfil" icon="ri-user-add-line" />
          <p className="text-sm text-foreground-600">Responda o questionário inicial para o coach montar seu plano.</p>
          <Link
            to="/onboarding"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
          >
            Responder agora <i className="ri-arrow-right-line"></i>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* identity */}
        <Card padding="p-5">
          <CardHeader title="Identidade" icon="ri-user-3-line" />
          <div className="space-y-2">
            <InfoRow icon="ri-user-3-line" label="Nome" value={name} />
            <InfoRow icon="ri-calendar-line" label="Idade" value={text(ob.age, ' anos')} />
            <InfoRow icon="ri-ruler-line" label="Altura" value={height} />
            <InfoRow icon="ri-scales-3-line" label="Peso" value={text(ob.weight, ' kg')} />
          </div>
        </Card>

        {/* goal & training */}
        <Card padding="p-5">
          <CardHeader title="Objetivo &amp; treino" icon="ri-sword-line" />
          <div className="space-y-2">
            <InfoRow icon="ri-trophy-line" label="Objetivo" value={text(ob.goal)} />
            <InfoRow icon="ri-bar-chart-line" label="Nível" value={text(ob.level)} />
            <InfoRow icon="ri-calendar-check-line" label="Disponibilidade" value={text(ob.days, 'x/semana')} />
            <InfoRow icon="ri-time-line" label="Duração" value={text(ob.minutes, ' min')} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Modalidades</p>
            {modality.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {modality.map((m) => (
                  <span key={m} className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-700">{m}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground-500">{MISSING}</p>
            )}
          </div>
        </Card>

        {/* health */}
        <Card padding="p-5">
          <CardHeader title="Saúde &amp; segurança" icon="ri-heart-pulse-line" />
          <p className="mb-3 text-xs text-foreground-500">O sistema não diagnostica e não altera medicamentos.</p>
          <div className="space-y-3">
            <TextBlock label="Histórico médico" value={ob.history} />
            <TextBlock label="Lesões anteriores" value={ob.injuries} />
            <TextBlock label="Sintomas atuais" value={ob.symptoms} />
          </div>
        </Card>
      </div>
    </div>
  );
}
