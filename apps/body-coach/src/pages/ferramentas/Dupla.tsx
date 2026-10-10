import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import MonitorCardiaco, { useFC } from '@/components/feature/MonitorCardiaco';
import { chatApi } from '@/lib/chat';
import { duplaAtual, enviarStatusDupla, guardarDupla, type SalaDupla } from '@/lib/ferramentas/social';

const RECADOS = ['Bora! 🔥', 'Mais uma! 💪', 'Água! 💧', 'Tô cansado 😮‍💨', 'Terminei! ✅'];
const ha = (em?: number) => {
  if (!em) return 'ainda não começou';
  const s = Math.round((Date.now() - em) / 1000);
  return s < 60 ? `há ${s} s` : `há ${Math.round(s / 60)} min`;
};

// Treino em dupla ao vivo: cada um treina no próprio celular e vê a série, os batimentos e os recados do outro.
export default function Dupla() {
  const { user, profile } = useAuth();
  const fc = useFC();
  const [codigo, setCodigo] = useState<string | null>(duplaAtual);
  const [sala, setSala] = useState<SalaDupla | null>(null);
  const [entrada, setEntrada] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const nome = profile?.full_name || user?.email?.split('@')[0] || 'Parceiro';

  const ver = useCallback(async (c: string) => {
    try {
      const r = await chatApi<{ sala: SalaDupla }>({ acao: 'dupla_ver', codigo: c });
      setSala(r.sala);
    } catch (e) {
      setErro((e as Error).message);
      guardarDupla(null);
      setCodigo(null);
      setSala(null);
    }
  }, []);

  // confere o parceiro a cada 8 s (pouca leitura no banco grátis)
  useEffect(() => {
    if (!codigo) return;
    void ver(codigo);
    const id = setInterval(() => { if (document.visibilityState === 'visible') void ver(codigo); }, 8000);
    return () => clearInterval(id);
  }, [codigo, ver]);

  // batimentos vão junto, quando há cinta ou relógio conectado
  useEffect(() => {
    if (!codigo || !fc.conectado || !fc.bpm) return;
    void enviarStatusDupla({ bpm: fc.bpm, kcal: Math.round(fc.kcal) });
  }, [codigo, fc.conectado, fc.bpm, fc.kcal]);

  const agir = async (corpo: Record<string, unknown>) => {
    if (ocupado) return;
    setOcupado(true); setErro('');
    try {
      const r = await chatApi<{ codigo: string; sala: SalaDupla }>({ nome, ...corpo });
      guardarDupla(r.codigo, r.sala.expira);
      setCodigo(r.codigo);
      setSala(r.sala);
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };

  const recado = async (texto: string) => {
    const s = await enviarStatusDupla({ recado: texto, bpm: fc.bpm || 0 }, true);
    if (s) setSala(s);
  };
  const sair = async () => {
    if (codigo) await chatApi({ acao: 'dupla_sair', codigo }).catch(() => {});
    guardarDupla(null); setCodigo(null); setSala(null);
  };
  const compartilhar = async () => {
    const texto = `Bora treinar junto no Body Coach? Abra Ferramentas › Treino em dupla e digite o código ${codigo}`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    } catch { /* cancelado */ }
  };

  if (!codigo || !sala) {
    return (
      <div className="space-y-3">
        <Card>
          <p className="text-sm text-foreground-700">Treine com um amigo, mesmo cada um na sua casa ou academia. Vocês veem a série, os batimentos e os recados um do outro em tempo real.</p>
          <button type="button" onClick={() => void agir({ acao: 'dupla_criar' })} disabled={ocupado} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-60">
            <i className="ri-add-circle-line mr-1"></i>Criar treino em dupla
          </button>
        </Card>
        <Card>
          <label className="text-sm font-semibold text-foreground-900" htmlFor="codigo-dupla">Tenho um código</label>
          <div className="mt-2 flex gap-2">
            <input id="codigo-dupla" value={entrada} onChange={(e) => setEntrada(e.target.value.toUpperCase())} maxLength={6} placeholder="Ex.: K7M2QP" className="min-w-0 flex-1 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-center font-mono text-lg tracking-widest" />
            <button type="button" onClick={() => void agir({ acao: 'dupla_entrar', codigo: entrada })} disabled={ocupado || entrada.length < 4} className="rounded-xl bg-accent-500 px-4 text-sm font-semibold text-background-50 disabled:opacity-60">Entrar</button>
          </div>
        </Card>
        {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
      </div>
    );
  }

  const ids = [sala.a, sala.b].filter(Boolean);
  const parceiro = ids.find((i) => i !== user?.id);
  const cartao = (uid: string | undefined, eu: boolean) => {
    const st = uid ? sala.status?.[uid] : undefined;
    return (
      <Card padding="p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground-950">{eu ? 'Você' : uid ? sala.nomes[uid] : 'Esperando o parceiro…'}</p>
          {st?.bpm ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-sm font-bold text-red-600"><i className="ri-heart-pulse-fill"></i> {st.bpm}</span> : null}
        </div>
        {uid ? (
          <>
            <p className="mt-1 text-sm text-foreground-700">{st?.exercicio || 'Aquecendo'}{st?.series ? ` · ${st.series} ${st.series === 1 ? 'série' : 'séries'}` : ''}</p>
            {st?.recado && <p className="mt-1 inline-block rounded-full bg-primary-50 px-2.5 py-1 text-sm font-semibold text-primary-800">{st.recado}</p>}
            <p className="mt-1 text-[11px] text-foreground-400">{ha(st?.em)}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-foreground-500">Mande o código para o seu amigo.</p>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Código da dupla</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-mono text-3xl font-bold tracking-widest text-foreground-950" data-testid="codigo-dupla">{codigo}</p>
          <button type="button" onClick={() => void compartilhar()} className="rounded-xl border border-background-200 px-3 py-2 text-sm font-semibold text-foreground-700"><i className="ri-share-line mr-1"></i>{copiado ? 'Copiado!' : 'Enviar'}</button>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cartao(user?.id, true)}
        {cartao(parceiro, false)}
      </div>
      <div className="flex flex-wrap gap-2">
        {RECADOS.map((r) => <button key={r} type="button" onClick={() => void recado(r)} className="rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-sm">{r}</button>)}
      </div>
      <MonitorCardiaco compacto />
      <div className="grid grid-cols-2 gap-2">
        <Link to="/workout" className="rounded-xl bg-primary-500 px-4 py-3 text-center text-sm font-semibold text-background-50">Ir para o treino</Link>
        <button type="button" onClick={() => void sair()} className="rounded-xl border border-background-200 px-4 py-3 text-sm font-semibold text-foreground-700">Encerrar dupla</button>
      </div>
      <p className="text-xs text-foreground-500">Durante o treino, cada série que você registra aparece para o seu parceiro sozinha.</p>
      {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
    </div>
  );
}
