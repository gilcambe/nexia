import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { refeicoesPadrao } from '@/lib/dietPlan';
import { gerarIcsRefeicoes, linkGoogleAgenda } from '@/lib/lembretes';

// Horários das refeições (o aluno ajusta à rotina dele) e lembretes no celular, sem servidor e sem custo:
// Google Agenda (um toque por refeição) ou arquivo de calendário com todas de uma vez.
export default function LembretesRefeicoes() {
  const { user, profile, refreshProfile } = useAuth();
  const [onboarding, setOnboarding] = useState<Record<string, unknown> | null>(null);
  const [aberto, setAberto] = useState(false);
  const [horas, setHoras] = useState<Record<string, string>>({});
  const [ligadas, setLigadas] = useState<Record<string, boolean>>({});
  const [agua, setAgua] = useState(false);
  const [antes, setAntes] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserDoc<{ onboarding?: Record<string, unknown> }>(user.id, 'profile', 'main').then((p) => setOnboarding(p?.onboarding ?? {})).catch(() => setOnboarding({}));
  }, [user]);

  const refeicoes = useMemo(() => {
    const plano = profile?.plano_nutri?.refeicoes.filter((r) => r.horario).map((r) => ({ nome: r.nome, horario: r.horario as string }));
    return plano?.length ? plano : refeicoesPadrao(onboarding ?? {});
  }, [profile?.plano_nutri, onboarding]);

  useEffect(() => {
    const salvos = profile?.horarios_refeicoes ?? {};
    setHoras(Object.fromEntries(refeicoes.map((r) => [r.nome, salvos[r.nome] ?? r.horario])));
    setLigadas(Object.fromEntries(refeicoes.map((r) => [r.nome, true])));
  }, [refeicoes, profile?.horarios_refeicoes]);

  const escolhidas = refeicoes.filter((r) => ligadas[r.nome]).map((r) => ({ nome: r.nome, hora: horas[r.nome] ?? r.horario }));

  const salvarHoras = async () => {
    if (!user) return;
    await setUserDoc(user.id, 'profile', 'main', { horarios_refeicoes: horas }, true);
    refreshProfile();
    setMsg('Horários salvos. O cardápio já mostra os novos horários.');
  };

  const baixar = () => {
    const blob = new Blob([gerarIcsRefeicoes(escolhidas, { agua, antecedenciaMin: antes })], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lembretes-refeicoes.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    void salvarHoras();
    setMsg('Arquivo baixado. Toque nele e escolha "Adicionar ao calendário".');
  };

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-4" data-testid="lembretes-refeicoes">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 text-left" aria-expanded={aberto}>
        <i className="ri-alarm-line text-lg text-primary-500"></i>
        <div className="flex-1">
          <h2 className="font-heading text-base font-bold text-foreground-950">Horários e lembretes das refeições</h2>
          <p className="text-xs text-foreground-500">Ajuste os horários à sua rotina e receba aviso no celular.</p>
        </div>
        <i className={`ri-arrow-${aberto ? 'up' : 'down'}-s-line text-xl text-foreground-500`}></i>
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          <ul className="space-y-2">
            {refeicoes.map((r) => (
              <li key={r.nome} className="flex items-center gap-2">
                <input type="checkbox" checked={!!ligadas[r.nome]} onChange={(e) => setLigadas((l) => ({ ...l, [r.nome]: e.target.checked }))} aria-label={`Lembrar ${r.nome}`} />
                <span className="flex-1 text-sm text-foreground-800">{r.nome}</span>
                <input type="time" value={horas[r.nome] ?? r.horario} onChange={(e) => setHoras((h) => ({ ...h, [r.nome]: e.target.value }))} className="rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm" aria-label={`Horário ${r.nome}`} />
                <a href={linkGoogleAgenda(`${r.nome}: hora de comer`, horas[r.nome] ?? r.horario, 'Abra o NEXIA Body Coach > Nutrição para ver o que comer.')} target="_blank" rel="noopener noreferrer" onClick={() => void salvarHoras()} className="rounded-lg bg-background-100 px-2 py-1.5 text-xs font-semibold text-foreground-700" aria-label={`Lembrete de ${r.nome} no Google Agenda`}>
                  <i className="ri-google-line"></i> Agenda
                </a>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm text-foreground-700"><input type="checkbox" checked={agua} onChange={(e) => setAgua(e.target.checked)} />Lembrar de beber água (5 vezes ao dia)</label>
          <label className="flex items-center gap-2 text-sm text-foreground-700">Avisar
            <select value={antes} onChange={(e) => setAntes(Number(e.target.value))} className="rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm">
              <option value={0}>na hora</option><option value={10}>10 min antes</option><option value={30}>30 min antes</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={baixar} disabled={!escolhidas.length} className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-40"><i className="ri-calendar-event-line mr-1"></i>Criar todos os lembretes</button>
            <button type="button" onClick={() => void salvarHoras()} className="rounded-xl bg-background-100 px-4 py-2.5 text-sm font-semibold text-foreground-700">Só salvar horários</button>
          </div>
          <p className="text-[11px] text-foreground-500">No Android, o botão "Agenda" de cada refeição abre o Google Agenda já preenchido (repete todo dia). "Criar todos" baixa um arquivo para o calendário do celular (iPhone e Samsung).</p>
          {msg && <p role="status" className="text-sm text-primary-700">{msg}</p>}
        </div>
      )}
    </div>
  );
}
