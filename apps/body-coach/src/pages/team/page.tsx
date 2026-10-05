import { teamCategories, type TeamMember } from '@/mocks/team';

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          member.active ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-400'
        }`}
      >
        <i className="ri-user-star-line text-base"></i>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-foreground-900">{member.name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              member.core ? 'bg-secondary-100 text-secondary-900' : 'bg-background-100 text-foreground-500'
            }`}
          >
            {member.core ? 'Núcleo' : 'Consultivo'}
          </span>
          {member.active && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500"></span>
              Ativo
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-foreground-500">{member.role}</p>
        {member.active && member.reason && (
          <p className="mt-1 text-[11px] text-primary-700">
            <i className="ri-radar-line mr-1"></i>
            {member.reason}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Team() {
  const totalMembers = teamCategories.reduce((a, c) => a + c.members.length, 0);
  const activeMembers = teamCategories.reduce(
    (a, c) => a + c.members.filter((m) => m.active).length,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Equipe de Especialistas</h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground-600">
          Não é um coach — é uma equipe de alta performance inteira dentro do app. Cada
          profissional assume uma camada, e os que estão <span className="font-semibold text-accent-700">ativos</span>{' '}
          estão "olhando" você agora, com o motivo do que monitoram.
        </p>
      </header>

      {/* resumo */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-background-200 bg-background-100/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <i className="ri-group-line text-lg text-primary-500"></i>
          <span className="text-sm text-foreground-700">
            <strong className="font-semibold text-foreground-950">{totalMembers}</strong> profissionais
          </span>
        </div>
        <span className="text-foreground-300">·</span>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-500"></span>
          <span className="text-sm text-foreground-700">
            <strong className="font-semibold text-foreground-950">{activeMembers}</strong> ativos agora
          </span>
        </div>
        <span className="text-foreground-300">·</span>
        <span className="text-xs text-foreground-500">
          Núcleo permanente + especialistas consultivos, acionados conforme a necessidade.
        </span>
      </div>

      {/* categorias */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {teamCategories.map((cat) => (
          <section
            key={cat.id}
            className="rounded-xl border border-background-200 bg-background-50 p-5"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <i className={`${cat.icon} text-lg`}></i>
              </div>
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground-950">{cat.title}</h2>
                <p className="mt-0.5 text-xs text-foreground-500">{cat.subtitle}</p>
              </div>
            </div>
            <div className="space-y-2">
              {cat.members.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}