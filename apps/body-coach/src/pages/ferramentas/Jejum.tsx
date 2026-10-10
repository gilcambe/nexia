import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { PROTOCOLOS, hhmm, progressoJejum, type Jejum as JejumT } from '@/lib/ferramentas/jejum';

// O jejum em andamento fica no perfil (vale em qualquer aparelho) e no aparelho (funciona offline).
export default function Jejum() {
  const { user, profile, refreshProfile } = useAuth();
  const chave = user ? `bc_jejum_${user.id}` : '';
  const [jejum, setJejum] = useState<JejumT | null>(() => {
    try { return chave ? JSON.parse(localStorage.getItem(chave) || 'null') : null; } catch { return null; }
  });
  const [horas, setHoras] = useState(16);
  const [, tique] = useState(0);

  useEffect(() => { if (profile?.jejum !== undefined) setJejum(profile.jejum ?? null); }, [profile?.jejum]);
  useEffect(() => {
    if (!jejum) return;
    const id = setInterval(() => tique((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, [jejum]);

  const gravar = (j: JejumT | null) => {
    setJejum(j);
    try { if (chave) localStorage.setItem(chave, JSON.stringify(j)); } catch { /* sem armazenamento */ }
    if (user) void setUserDoc(user.id, 'profile', 'main', { jejum: j }, true).then(refreshProfile).catch(() => {});
  };

  const prog = jejum ? progressoJejum(jejum) : null;
  const raio = 70, circ = 2 * Math.PI * raio;

  return (
    <div className="space-y-3">
      <Card>
        {!jejum || !prog ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Escolha o protocolo e toque em começar logo depois da última refeição.</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PROTOCOLOS.map((p) => (
                <button key={p.id} type="button" onClick={() => setHoras(p.horas)} className={`rounded-xl py-2.5 text-center ${horas === p.horas ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-700'}`}>
                  <span className="block font-heading text-lg font-bold">{p.nome}</span>
                  <span className="block text-[10px] opacity-80">{p.dica}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => gravar({ inicio: Date.now(), horas })} className="w-full rounded-xl bg-primary-500 py-3.5 font-semibold text-background-50 dark:text-foreground-950">
              <i className="ri-play-fill mr-1"></i>Começar jejum de {horas} horas
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <svg viewBox="0 0 180 180" className="h-48 w-48" role="img" aria-label={`Jejum ${prog.pct}% concluído`}>
              <circle cx="90" cy="90" r={raio} fill="none" strokeWidth="14" className="stroke-background-200" />
              <circle cx="90" cy="90" r={raio} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-primary-500" strokeDasharray={circ} strokeDashoffset={circ * (1 - prog.pct / 100)} transform="rotate(-90 90 90)" />
              <text x="90" y="86" textAnchor="middle" className="fill-foreground-950 font-heading text-[28px] font-bold">{hhmm(prog.passadoMin)}</text>
              <text x="90" y="110" textAnchor="middle" className="fill-foreground-500 text-[12px]">de {jejum.horas}h · {prog.pct}%</text>
            </svg>
            <p className="text-center text-sm font-semibold text-foreground-900">{prog.concluido ? 'Meta batida! Pode comer quando quiser.' : `Faltam ${hhmm(prog.faltaMin)}`}</p>
            <p className="rounded-lg bg-primary-50 px-3 py-2 text-center text-xs text-foreground-700">{prog.fase}</p>
            <p className="text-xs text-foreground-500">Começou {new Date(jejum.inicio).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · termina {new Date(jejum.inicio + jejum.horas * 3600000).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            <button type="button" onClick={() => gravar(null)} className={`w-full rounded-xl py-3 font-semibold ${prog.concluido ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-300 text-foreground-700'}`}>
              {prog.concluido ? 'Encerrar e comer' : 'Parar o jejum agora'}
            </button>
          </div>
        )}
      </Card>
      <p className="text-[11px] leading-relaxed text-foreground-400">Jejum é opcional e não serve para todos. Evite se estiver grávida ou amamentando, tiver diabetes, histórico de transtorno alimentar ou usar remédios que exijam comida. Na dúvida, fale com seu nutricionista. Beba água, café e chá sem açúcar à vontade.</p>
    </div>
  );
}
