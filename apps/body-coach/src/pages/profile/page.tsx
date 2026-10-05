import { athlete } from '@/mocks/athlete';
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

export default function Profile() {
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
            <InfoRow icon="ri-user-3-line" label="Nome" value={athlete.name} />
            <InfoRow icon="ri-calendar-line" label="Idade" value={`${athlete.age} anos`} />
            <InfoRow icon="ri-arrow-up-line" label="Altura" value={`${athlete.height} cm`} />
            <InfoRow icon="ri-scales-line" label="Peso" value={`${athlete.weight} kg`} />
            <InfoRow icon="ri-drop-line" label="Cintura" value={`${athlete.waist} cm`} />
            <InfoRow icon="ri-planet-line" label="País" value={athlete.country} />
          </div>
        </Card>

        {/* goal & training */}
        <Card padding="p-5">
          <CardHeader title="Objetivo &amp; treino" icon="ri-sword-line" />
          <div className="space-y-2">
            <InfoRow icon="ri-trophy-line" label="Objetivo" value={athlete.goal} />
            <InfoRow icon="ri-layout-grid-line" label="Nível" value={athlete.level} />
            <InfoRow icon="ri-calendar-line" label="Disponibilidade" value={`${athlete.availabilityDays}x/semana`} />
            <InfoRow icon="ri-time-line" label="Duração por sessão" value={`${athlete.sessionMinutes} min`} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Modalidades</p>
            <div className="flex flex-wrap gap-2">
              {athlete.modality.map((m) => (
                <span key={m} className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-700">
                  {m === 'musculacao' ? 'Musculação' : 'Powerlifting'}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* preferences */}
        <Card padding="p-5">
          <CardHeader title="Preferências" icon="ri-fire-line" />
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Exercícios preferidos</p>
              <div className="flex flex-wrap gap-2">
                {athlete.preferredExercises.map((e) => (
                  <span key={e} className="rounded-full bg-accent-100 px-3 py-1.5 text-xs text-accent-800 capitalize">{e}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Exercícios evitados</p>
              <div className="flex flex-wrap gap-2">
                {athlete.avoidedExercises.map((e) => (
                  <span key={e} className="rounded-full bg-primary-100 px-3 py-1.5 text-xs text-primary-700 capitalize">{e}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Equipamentos</p>
              <div className="flex flex-wrap gap-2">
                {athlete.equipment.map((e) => (
                  <span key={e} className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-700 capitalize">{e === 'pesos_livres' ? 'Pesos livres' : 'Máquinas'}</span>
                ))}
              </div>
            </div>
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
                {athlete.medical.medicalHistory.join(' · ')}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Lesões anteriores</p>
              <div className="space-y-1.5">
                {athlete.medical.pastInjuries.map((i) => (
                  <div key={i.name} className="flex items-center justify-between rounded-lg bg-background-100/70 px-3 py-2">
                    <span className="text-sm text-foreground-700">{i.name}</span>
                    <span className="text-[11px] text-foreground-400">{i.date} · {i.status === 'estavel' ? 'estável' : i.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Limitações conhecidas</p>
              <div className="flex flex-wrap gap-2">
                {athlete.medical.knownLimitations.map((l) => (
                  <span key={l} className="rounded-full bg-accent-100 px-3 py-1.5 text-xs text-accent-800">{l}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Sintomas atuais</p>
              <div className="rounded-lg bg-accent-100/60 p-3 text-sm text-accent-800">
                {athlete.medical.currentSymptoms.join(' · ')}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Medicamentos</p>
              <div className="rounded-lg bg-background-100/70 p-3 text-sm text-foreground-700">
                {athlete.medical.medications.length ? athlete.medical.medications.join(' · ') : 'Nenhum informado'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}