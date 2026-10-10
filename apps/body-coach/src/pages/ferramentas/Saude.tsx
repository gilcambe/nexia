import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { classificarGlicemia, classificarPressao } from '@/lib/ferramentas/dicas';

type Sinal = { data: string; sistolica?: number | null; diastolica?: number | null; glicemia?: number | null; fc_repouso?: number | null; jejum?: boolean };

// Lembretes anuais/semestrais no Google Agenda (grátis).
const CHECKUPS = [
  { nome: 'Exame de sangue completo', freq: 'YEARLY', quando: 'Todo ano' },
  { nome: 'Consulta com clínico geral', freq: 'YEARLY', quando: 'Todo ano' },
  { nome: 'Dentista', freq: 'MONTHLY;INTERVAL=6', quando: 'A cada 6 meses' },
  { nome: 'Avaliação física (medidas e bioimpedância)', freq: 'MONTHLY;INTERVAL=2', quando: 'A cada 2 meses' },
  { nome: 'Eletrocardiograma / teste ergométrico', freq: 'YEARLY', quando: 'Todo ano (acima de 35 anos ou treino intenso)' },
];
function linkCheckup(nome: string, freq: string): string {
  const d = new Date(Date.now() + 7 * 86400000);
  const q = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `Marcar: ${nome}`, dates: `${q}/${q}`, details: 'Lembrete do Body Coach', recur: `RRULE:FREQ=${freq}` });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export default function Saude() {
  const { user, profile, refreshProfile } = useAuth();
  const sinais: Sinal[] = [...(profile?.sinais ?? [])].sort((a, b) => a.data.localeCompare(b.data));
  const [f, setF] = useState({ s: '', d: '', g: '', fc: '', jejum: true });
  const [ok, setOk] = useState(false);
  const n = (x: string) => { const v = Number(x.replace(',', '.')); return v > 0 ? v : null; };
  const s = n(f.s), d = n(f.d), g = n(f.g), fc = n(f.fc);
  const pressao = s && d ? classificarPressao(s, d) : null;
  const glic = g ? classificarGlicemia(g, f.jejum) : null;

  const salvar = () => {
    if (!user || (!s && !g && !fc)) return;
    const novo: Sinal = { data: new Date().toISOString(), sistolica: s, diastolica: d, glicemia: g, fc_repouso: fc, jejum: f.jejum };
    void setUserDoc(user.id, 'profile', 'main', { sinais: [...sinais, novo].slice(-120) }, true).then(refreshProfile).catch(() => {});
    setOk(true);
    setF({ s: '', d: '', g: '', fc: '', jejum: f.jejum });
    setTimeout(() => setOk(false), 2500);
  };
  const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const grafPressao = sinais.filter((x) => x.sistolica && x.diastolica).map((x) => ({ dia: dia(x.data), s: x.sistolica, d: x.diastolica }));
  const grafOutros = sinais.filter((x) => x.glicemia || x.fc_repouso).map((x) => ({ dia: dia(x.data), g: x.glicemia ?? undefined, fc: x.fc_repouso ?? undefined }));
  const campo = 'w-full min-w-0 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm';

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Registrar agora</h2>
        <p className="mt-1 text-xs text-foreground-500">Meça sentado, depois de 5 minutos de repouso. Preencha só o que mediu.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs text-foreground-600">Pressão máxima</span><input inputMode="numeric" type="number" placeholder="120" value={f.s} onChange={(e) => setF({ ...f, s: e.target.value })} className={campo} aria-label="Pressão sistólica" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-foreground-600">Pressão mínima</span><input inputMode="numeric" type="number" placeholder="80" value={f.d} onChange={(e) => setF({ ...f, d: e.target.value })} className={campo} aria-label="Pressão diastólica" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-foreground-600">Glicemia (mg/dL)</span><input inputMode="numeric" type="number" placeholder="90" value={f.g} onChange={(e) => setF({ ...f, g: e.target.value })} className={campo} aria-label="Glicemia" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-foreground-600">Batimentos em repouso</span><input inputMode="numeric" type="number" placeholder="60" value={f.fc} onChange={(e) => setF({ ...f, fc: e.target.value })} className={campo} aria-label="Frequência cardíaca de repouso" /></label>
        </div>
        {f.g && (
          <div className="mt-2 flex gap-2 text-xs">
            {[true, false].map((j) => <button key={String(j)} type="button" onClick={() => setF({ ...f, jejum: j })} className={`flex-1 rounded-lg py-2 font-semibold ${f.jejum === j ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 text-foreground-600'}`}>{j ? 'Em jejum' : 'Depois de comer'}</button>)}
          </div>
        )}
        {pressao && <div className="mt-3 flex items-start gap-2 rounded-xl bg-background-100/70 p-3"><span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${pressao.cor}`} /><p className="text-sm text-foreground-800"><b>{pressao.nome}.</b> {pressao.texto}</p></div>}
        {glic && <div className="mt-2 flex items-center gap-2 rounded-xl bg-background-100/70 p-3"><span className={`h-3 w-3 shrink-0 rounded-full ${glic.cor}`} /><p className="text-sm text-foreground-800">Glicemia: <b>{glic.nome}</b></p></div>}
        {fc && <p className="mt-2 rounded-xl bg-background-100/70 p-3 text-sm text-foreground-800">Repouso {fc} bpm: <b>{fc < 60 ? 'ótimo condicionamento' : fc <= 80 ? 'normal' : fc <= 100 ? 'pode melhorar com cardio' : 'alto: procure seu médico'}</b></p>}
        <button type="button" onClick={salvar} disabled={!s && !g && !fc} className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">{ok ? 'Salvo!' : 'Salvar medição'}</button>
      </Card>

      {grafPressao.length > 1 && (
        <Card>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Pressão ao longo do tempo</h2>
          <div className="mt-2 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={grafPressao} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={[50, 'auto']} /><Tooltip />
            <Line dataKey="s" name="Máxima" stroke="oklch(var(--primary-500))" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line dataKey="d" name="Mínima" stroke="oklch(var(--accent-500))" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart></ResponsiveContainer></div>
        </Card>
      )}
      {grafOutros.length > 1 && (
        <Card>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Glicemia e batimentos em repouso</h2>
          <div className="mt-2 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={grafOutros} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} /><Tooltip />
            <Line dataKey="g" name="Glicemia" stroke="oklch(var(--primary-500))" strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
            <Line dataKey="fc" name="FC repouso" stroke="oklch(var(--accent-500))" strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
          </LineChart></ResponsiveContainer></div>
        </Card>
      )}
      {sinais.length > 0 && (
        <Card padding="p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-400">Últimas medições</h2>
          <ul className="divide-y divide-background-200 text-sm">
            {[...sinais].reverse().slice(0, 10).map((x) => (
              <li key={x.data} className="flex justify-between gap-2 py-2">
                <span className="text-foreground-500">{new Date(x.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-right font-medium text-foreground-900">{[x.sistolica && x.diastolica ? `${x.sistolica}/${x.diastolica}` : '', x.glicemia ? `${x.glicemia} mg/dL` : '', x.fc_repouso ? `${x.fc_repouso} bpm` : ''].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Lembretes de check-up</h2>
        <p className="mt-1 text-xs text-foreground-500">Toque para criar um lembrete que se repete no Google Agenda.</p>
        <div className="mt-2 divide-y divide-background-200">
          {CHECKUPS.map((c) => (
            <a key={c.nome} href={linkCheckup(c.nome, c.freq)} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2.5">
              <i className="ri-calendar-check-line text-xl text-primary-600"></i>
              <span className="flex-1"><span className="block text-sm font-semibold text-foreground-900">{c.nome}</span><span className="block text-xs text-foreground-500">{c.quando}</span></span>
              <i className="ri-add-circle-line text-xl text-primary-600"></i>
            </a>
          ))}
        </div>
      </Card>
      <Link to="/exams" className="block rounded-2xl border border-background-200 bg-background-50 p-3 text-center text-sm font-semibold text-primary-700"><i className="ri-stethoscope-line mr-1"></i>Exames de sangue com histórico e gráfico</Link>
      <p className="text-[11px] text-foreground-400">Referências: Diretriz Brasileira de Hipertensão (2020) e Sociedade Brasileira de Diabetes. Não substitui consulta médica.</p>
    </div>
  );
}
