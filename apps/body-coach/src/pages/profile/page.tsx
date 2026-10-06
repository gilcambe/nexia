import { useAuth } from '@/components/feature/AuthContext';
import Card, { CardHeader } from '@/components/base/Card';

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background-100/70 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-foreground-500">
        <i className={`${icon} text-primary-500`}></i>
        {label}
      </span>
      <span className="text-sm font-medium capitalize text-foreground-900">{value}</span>
    </div>
  );
}

function calculateAge(birthDateStr?: string): string {
  if (!birthDateStr) return '-';
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} anos`;
}

export default function Profile() {
  const { user, profile } = useAuth();

  const fullName = profile?.full_name || user?.displayName || user?.email || 'Atleta';
  const email = profile?.email || user?.email || '-';
  const heightCm = profile?.height_cm ? `${profile.height_cm} cm` : '-';
  const birthDate = profile?.birth_date || '-';
  const age = calculateAge(profile?.birth_date);
  const gender = profile?.gender ? (profile.gender === 'male' ? 'Masculino' : profile.gender === 'female' ? 'Feminino' : profile.gender) : '-';
  const goalWeight = profile?.goal_weight_kg ? `${profile.goal_weight_kg} kg` : '-';
  const goalBodyFat = profile?.goal_body_fat_pct ? `${profile.goal_body_fat_pct}%` : '-';
  const onboarding = profile?.onboarding || {};

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Perfil</h1>
        <p className="mt-1 text-sm text-foreground-600">Identidade, saúde e preferências do atleta.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* identity */}
        <Card padding="p-5">
          <CardHeader title="Identidade" icon="ri-user-3-line" />
          <div className="space-y-2">
            <InfoRow icon="ri-user-3-line" label="Nome" value={fullName} />
            <InfoRow icon="ri-mail-line" label="E-mail" value={email} />
            <InfoRow icon="ri-calendar-line" label="Idade" value={age} />
            <InfoRow icon="ri-cake-line" label="Data de Nascimento" value={birthDate} />
            <InfoRow icon="ri-user-heart-line" label="Gênero" value={gender} />
            <InfoRow icon="ri-arrow-up-line" label="Altura" value={heightCm} />
            <InfoRow icon="ri-scales-line" label="Peso Meta" value={goalWeight} />
            <InfoRow icon="ri-percent-line" label="Gordura Corporal Meta" value={goalBodyFat} />
          </div>
        </Card>

        {/* goal & training */}
        <Card padding="p-5">
          <CardHeader title="Objetivo &amp; treino" icon="ri-sword-line" />
          <div className="space-y-2">
            <InfoRow icon="ri-trophy-line" label="Objetivo" value={onboarding.goal || onboarding.objective || 'Hipertrofia / Condicionamento'} />
            <InfoRow icon="ri-layout-grid-line" label="Nível" value={onboarding.level || onboarding.experience || 'Intermediário'} />
            <InfoRow icon="ri-calendar-line" label="Disponibilidade" value={onboarding.availabilityDays ? `${onboarding.availabilityDays}x/semana` : (onboarding.daysPerWeek ? `${onboarding.daysPerWeek}x/semana` : '4x/semana')} />
            <InfoRow icon="ri-time-line" label="Duração por sessão" value={onboarding.sessionMinutes ? `${onboarding.sessionMinutes} min` : '60 min'} />
          </div>
          {onboarding.modality && Array.isArray(onboarding.modality) && onboarding.modality.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Modalidades</p>
              <div className="flex flex-wrap gap-2">
                {onboarding.modality.map((m: string) => (
                  <span key={m} className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-700 capitalize">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* preferences */}
        <Card padding="p-5">
          <CardHeader title="Preferências" icon="ri-fire-line" />
          <div className="space-y-3">
            {onboarding.preferredExercises && Array.isArray(onboarding.preferredExercises) && onboarding.preferredExercises.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Exercícios preferidos</p>
                <div className="flex flex-wrap gap-2">
                  {onboarding.preferredExercises.map((e: string) => (
                    <span key={e} className="rounded-full bg-accent-100 px-3 py-1.5 text-xs text-accent-800 capitalize">{e}</span>
                  ))}
                </div>
              </div>
            )}
            {onboarding.avoidedExercises && Array.isArray(onboarding.avoidedExercises) && onboarding.avoidedExercises.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Exercícios evitados</p>
                <div className="flex flex-wrap gap-2">
                  {onboarding.avoidedExercises.map((e: string) => (
                    <span key={e} className="rounded-full bg-primary-100 px-3 py-1.5 text-xs text-primary-700 capitalize">{e}</span>
                  ))}
                </div>
              </div>
            )}
            {onboarding.equipment && Array.isArray(onboarding.equipment) && onboarding.equipment.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Equipamentos</p>
                <div className="flex flex-wrap gap-2">
                  {onboarding.equipment.map((e: string) => (
                    <span key={e} className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-700 capitalize">{e}</span>
                  ))}
                </div>
              </div>
            )}
            {(!onboarding.preferredExercises && !onboarding.avoidedExercises && !onboarding.equipment) && (
              <p className="text-sm text-foreground-500">Nenhuma preferência específica informada no onboarding.</p>
            )}
          </div>
        </Card>

        {/* health */}
        <Card padding="p-5">
          <CardHeader title="Saúde &amp; segurança" icon="ri-heart-pulse-line" />
          <p className="mb-3 text-xs text-foreground-500">
            Histórico e sintomas são armazenados separadamente, com status e data. O sistema não diagnostica e não altera medicamentos.
          </p>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Histórico médico</p>
              <div className="rounded-lg bg-background-100/70 p-3 text-sm text-foreground-700">
                {profile?.medicalHistory ? profile.medicalHistory : (onboarding.medicalHistory || 'Nenhum histórico restritivo informado.')}
              </div>
            </div>
            {profile?.medical?.pastInjuries && Array.isArray(profile.medical.pastInjuries) && profile.medical.pastInjuries.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Lesões anteriores</p>
                <div className="space-y-1.5">
                  {profile.medical.pastInjuries.map((i: any) => (
                    <div key={i.name || i} className="flex items-center justify-between rounded-lg bg-background-100/70 px-3 py-2">
                      <span className="text-sm text-foreground-700">{i.name || i}</span>
                      {i.date && <span className="text-[11px] text-foreground-400">{i.date} {i.status ? `· ${i.status}` : ''}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {onboarding.knownLimitations && Array.isArray(onboarding.knownLimitations) && onboarding.knownLimitations.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Limitações conhecidas</p>
                <div className="flex flex-wrap gap-2">
                  {onboarding.knownLimitations.map((l: string) => (
                    <span key={l} className="rounded-full bg-accent-100 px-3 py-1.5 text-xs text-accent-800">{l}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Sintomas atuais / Observações</p>
              <div className="rounded-lg bg-accent-100/60 p-3 text-sm text-accent-800">
                {profile?.currentSymptoms || onboarding.currentSymptoms || 'Nenhum sintoma relatado.'}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Medicamentos</p>
              <div className="rounded-lg bg-background-100/70 p-3 text-sm text-foreground-700">
                {profile?.medications || onboarding.medications || 'Nenhum informado'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}