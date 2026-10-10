import { useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { APPS_TELA, IDEIAS, abrirTela, episodiosNoCardio, youtube } from '@/lib/entretenimento';

// "Assistir no cardio": abre Netflix, Prime Video, YouTube etc. por cima do NEXIA, já na série do aluno.
// variante "cartao": destaque na hora do cardio; "pilula": botão pequeno na barra do treino (não cobre nada).
export default function EntretenimentoTreino({ variante = 'cartao', minutosSugeridos = 0 }: { variante?: 'cartao' | 'pilula'; minutosSugeridos?: number }) {
  const { user, profile, refreshProfile } = useAuth();
  const pref = profile?.entretenimento ?? {};
  const [aberto, setAberto] = useState(false);
  const [app, setApp] = useState(pref.app ?? 'netflix');
  const [serie, setSerie] = useState(pref.serie ?? '');
  const [minutos, setMinutos] = useState(minutosSugeridos || 30);

  const salvar = (mais: { app?: string; serie?: string }) => {
    if (!user) return;
    void setUserDoc(user.id, 'profile', 'main', { entretenimento: { app, serie: pref.serie ?? '', ...mais } }, true).then(refreshProfile).catch(() => {});
  };
  const abrir = (url: string) => { window.open(url, '_blank', 'noopener'); setAberto(false); };
  const nomeApp = (id: string) => APPS_TELA.find((a) => a.id === id)?.nome ?? '';

  const assistirNoApp = (id: string) => {
    setApp(id);
    salvar({ app: id });
    abrir(abrirTela(id, pref.serie));
  };
  const salvarSerie = () => {
    const s = serie.trim().slice(0, 80);
    salvar({ serie: s, app });
    abrir(abrirTela(app, s));
  };

  const continuar = pref.serie ? (
    <button type="button" onClick={() => abrir(abrirTela(pref.app ?? app, pref.serie))} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-foreground-950" data-testid="tela-continuar">
      <i className="ri-play-circle-fill text-3xl text-primary-500"></i>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">Continuar {pref.serie}</span>
        <span className="block text-[11px] text-foreground-500">no {nomeApp(pref.app ?? app)} · só vale assistir no cardio</span>
      </span>
    </button>
  ) : null;

  return (
    <>
      {variante === 'pilula' ? (
        <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#2a1416] to-black px-3 py-2 text-xs font-semibold text-white shadow-sm" aria-label="Assistir no cardio" data-testid="tela-botao">
          <i className="ri-tv-2-fill text-base text-[#E50914]"></i>Assistir
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1416] via-[#141012] to-black p-4 text-white" data-testid="tela-cartao">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E50914]"><i className="ri-movie-2-fill text-2xl"></i></span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-base font-bold">Cardio com a sua série</p>
              <p className="text-xs text-white/70">O tempo passa voando. Escolha o app e dê o play.</p>
            </div>
          </div>
          {continuar}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {APPS_TELA.slice(0, 4).map((a) => (
              <button key={a.id} type="button" onClick={() => assistirNoApp(a.id)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium ${app === a.id ? 'bg-white/15 ring-1 ring-white/40' : 'bg-white/5'}`} aria-label={`Abrir ${a.nome}`}>
                <i className={`${a.icone} text-2xl`} style={{ color: a.cor }}></i>
                {a.nome.replace(' Video', '')}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAberto(true)} className="mt-2 w-full rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/90" data-testid="tela-mais">
            <i className="ri-sparkling-line mr-1"></i>Mais apps, ideias e minha série
          </button>
        </div>
      )}
      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setAberto(false)} role="dialog" aria-modal="true" aria-label="Assistir no cardio">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background-50 p-4 pb-8 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-foreground-950">Assistir no cardio</h3>
              <button type="button" onClick={() => setAberto(false)} className="rounded-full p-2 text-foreground-500" aria-label="Fechar"><i className="ri-close-line text-xl"></i></button>
            </div>
            <p className="text-xs text-foreground-500">O app abre por cima. Assista na esteira ou na bike e volte para o NEXIA para registrar o cardio.</p>

            <p className="mt-3 text-sm font-semibold text-foreground-800">Quanto tempo de cardio?</p>
            <div className="mt-1.5 flex gap-1.5">
              {[15, 30, 45, 60].map((m) => (
                <button key={m} type="button" onClick={() => setMinutos(m)} aria-pressed={minutos === m} className={`rounded-full border px-3 py-1 text-xs font-medium ${minutos === m ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200 text-foreground-600'}`}>{m} min</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-foreground-600" data-testid="tela-cabe">{episodiosNoCardio(minutos)}</p>

            <p className="mt-4 text-sm font-semibold text-foreground-800">Seu app</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {APPS_TELA.map((a) => (
                <button key={a.id} type="button" onClick={() => assistirNoApp(a.id)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${app === a.id ? 'border-primary-500 bg-primary-50 text-foreground-950' : 'border-background-200 text-foreground-700'}`}>
                  <i className={`${a.icone} text-lg`} style={{ color: a.cor }}></i>{a.nome}
                </button>
              ))}
            </div>

            <p className="mt-4 text-sm font-semibold text-foreground-800">Minha série do cardio</p>
            <p className="text-[11px] text-foreground-500">Combine com você mesmo: essa série só no cardio. Vira motivo para não faltar.</p>
            <div className="mt-1.5 flex gap-2">
              <input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Ex.: Round 6, The Boys, novela..." className="min-w-0 flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm" aria-label="Nome da série" />
              <button type="button" onClick={salvarSerie} disabled={!serie.trim()} className="rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" data-testid="tela-salvar-serie">Salvar e abrir</button>
            </div>

            <p className="mt-4 text-sm font-semibold text-foreground-800">Ideias para o cardio <span className="font-normal text-foreground-500">(YouTube, grátis)</span></p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {IDEIAS.map((i) => (
                <button key={i.id} type="button" onClick={() => abrir(youtube(i.busca))} className="rounded-xl border border-background-200 p-2.5 text-left" data-testid={`tela-ideia-${i.id}`}>
                  <i className={`${i.icone} text-xl text-primary-500`}></i>
                  <span className="mt-1 block text-xs font-bold text-foreground-900">{i.titulo}</span>
                  <span className="block text-[11px] leading-tight text-foreground-500">{i.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
