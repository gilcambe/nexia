export default function Team() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Equipe</h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground-600">Os profissionais que acompanham você.</p>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-group-line text-base"></i>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-900">Sua equipe</p>
          <p className="mt-0.5 text-xs text-foreground-500">
            Em breve você poderá convidar seu treinador, nutricionista e médico para acompanhar sua evolução aqui.
          </p>
        </div>
      </div>
    </div>
  );
}
