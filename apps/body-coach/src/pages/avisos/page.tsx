import { useEffect, useState } from 'react';
import { ativarAvisos, assinaturaAtual, desativarAvisos, ehIphoneSemInstalar, salvarPrefs, suportaAvisos, testarAviso, verAvisos, type PrefsAvisos } from '@/lib/avisos';

const PADRAO: PrefsAvisos = { mensagens: true, treino: { ativo: true, hora: '18:00' }, agua: { ativo: false, de: '08:00', ate: '20:00', cada: 2 }, mensalidade: true };
const campo = 'rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm text-foreground-900';

// Avisos no celular: mensagens do coach/aluno, hora do treino, beber água, mensalidade e fim do descanso. Tudo grátis.
export default function Avisos() {
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<PrefsAvisos>(PADRAO);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    void (async () => {
      const sub = await assinaturaAtual();
      const ativo = !!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted';
      setLigado(ativo);
      if (ativo) verAvisos().then((r) => setPrefs(r.prefs)).catch(() => undefined);
    })();
  }, []);

  const fazer = async (f: () => Promise<unknown>, ok: string) => {
    setOcupado(true); setErro(''); setMsg('');
    try { await f(); setMsg(ok); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const mudar = (p: PrefsAvisos) => { setPrefs(p); if (ligado) void fazer(() => salvarPrefs(p), 'Salvo.'); };

  const Chave = ({ on, onChange, rotulo, detalhe }: { on: boolean; onChange: (v: boolean) => void; rotulo: string; detalhe?: string }) => (
    <label className="flex items-center justify-between gap-3 py-2.5">
      <span><span className="block text-sm font-semibold text-foreground-900">{rotulo}</span>{detalhe && <span className="block text-xs text-foreground-500">{detalhe}</span>}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={rotulo} className="h-5 w-9 shrink-0 accent-primary-500" />
    </label>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Avisos no celular</h1>
        <p className="mt-1 text-sm text-foreground-600">Mensagens do coach, hora do treino, beber água e o fim do descanso, mesmo com o app fechado. Grátis.</p>
      </header>
      {msg && <p role="status" className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800"><i className="ri-check-line mr-1"></i>{msg}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {ligado === false && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4" data-testid="avisos-desligados">
          {!suportaAvisos() && ehIphoneSemInstalar() && <p className="mb-3 text-sm text-foreground-700"><b>iPhone:</b> toque em Compartilhar → “Adicionar à Tela de Início”, abra o app por lá e volte aqui.</p>}
          <button type="button" disabled={ocupado} onClick={() => void fazer(async () => { const r = await ativarAvisos(prefs); setPrefs(r.prefs); setLigado(true); }, 'Avisos ligados neste celular!')} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
            <i className="ri-notification-3-line mr-1"></i>{ocupado ? 'Ligando...' : 'Ligar avisos neste celular'}
          </button>
          <p className="mt-2 text-center text-[11px] text-foreground-500">O celular vai perguntar se pode mostrar notificações: toque em Permitir.</p>
        </div>
      )}

      <div className={`rounded-2xl border border-background-200 bg-background-50 px-4 py-1 ${ligado ? '' : 'opacity-70'}`} data-testid="avisos-prefs">
        <Chave on={prefs.mensagens} onChange={(v) => mudar({ ...prefs, mensagens: v })} rotulo="Mensagens da conversa" detalhe="Coach e alunos: mensagem, ficha nova, dieta, treino feito" />
        <div className="border-t border-background-200">
          <Chave on={prefs.treino.ativo} onChange={(v) => mudar({ ...prefs, treino: { ...prefs.treino, ativo: v } })} rotulo="Lembrete do treino" detalhe="Só nos dias em que você ainda não treinou" />
          {prefs.treino.ativo && <label className="flex items-center gap-2 pb-2.5 text-xs text-foreground-600">Horário <input type="time" step={300} value={prefs.treino.hora} onChange={(e) => e.target.value && mudar({ ...prefs, treino: { ...prefs.treino, hora: e.target.value } })} aria-label="Horário do lembrete do treino" className={campo} /></label>}
        </div>
        <div className="border-t border-background-200">
          <Chave on={prefs.agua.ativo} onChange={(v) => mudar({ ...prefs, agua: { ...prefs.agua, ativo: v } })} rotulo="Beber água" />
          {prefs.agua.ativo && (
            <div className="flex flex-wrap items-center gap-2 pb-2.5 text-xs text-foreground-600">
              De <input type="time" step={300} value={prefs.agua.de} onChange={(e) => e.target.value && mudar({ ...prefs, agua: { ...prefs.agua, de: e.target.value } })} aria-label="Água a partir de" className={campo} />
              até <input type="time" step={300} value={prefs.agua.ate} onChange={(e) => e.target.value && mudar({ ...prefs, agua: { ...prefs.agua, ate: e.target.value } })} aria-label="Água até" className={campo} />
              <select value={prefs.agua.cada} onChange={(e) => mudar({ ...prefs, agua: { ...prefs.agua, cada: Number(e.target.value) } })} aria-label="Água a cada" className={campo}>
                {[1, 2, 3].map((h) => <option key={h} value={h}>a cada {h} h</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="border-t border-background-200">
          <Chave on={prefs.mensalidade} onChange={(v) => mudar({ ...prefs, mensalidade: v })} rotulo="Mensalidade" detalhe="Lembrete antes de vencer (alunos de coach com Pix)" />
        </div>
        <p className="border-t border-background-200 py-2.5 text-xs text-foreground-500"><i className="ri-timer-line mr-1"></i>Fim do descanso: com os avisos ligados, o celular vibra e avisa mesmo com a tela bloqueada (Android).</p>
      </div>

      {ligado && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={ocupado} onClick={() => void fazer(testarAviso, 'Aviso de teste enviado. Chegou?')} className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800 disabled:opacity-50">Mandar um teste</button>
          <button type="button" disabled={ocupado} onClick={() => void fazer(async () => { await desativarAvisos(); setLigado(false); }, 'Avisos desligados neste celular.')} className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">Desligar</button>
        </div>
      )}
    </div>
  );
}
