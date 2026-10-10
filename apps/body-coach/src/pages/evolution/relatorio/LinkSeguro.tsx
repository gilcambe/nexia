import { useState } from 'react';
import { criarLink, revogarLink } from '@/lib/avaliacao/coach';

// Link para o aluno mandar a avaliação ao médico ou nutricionista: abre sem login e vence sozinho.
export default function LinkSeguro({ entrada, temFotos }: { entrada: number; temFotos: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState(7);
  const [fotos, setFotos] = useState(false);
  const [link, setLink] = useState<{ url: string; token: string; expira: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');

  const criar = async () => {
    setOcupado(true); setMsg('');
    try {
      const r = await criarLink(entrada, dias, fotos);
      setLink({ url: `${window.location.origin}${import.meta.env.BASE_URL}compartilhado/${r.token}`, token: r.token, expira: r.expira });
    } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  const enviar = async () => {
    if (!link) return;
    try {
      if (navigator.share) await navigator.share({ title: 'Minha avaliação física', url: link.url });
      else { await navigator.clipboard.writeText(link.url); setMsg('Link copiado.'); }
    } catch { /* cancelado */ }
  };
  const revogar = async () => {
    if (!link) return;
    setOcupado(true);
    try { await revogarLink(link.token); setLink(null); setMsg('Link cancelado. Quem tinha o link não abre mais.'); }
    catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <section className="rounded-2xl border border-background-200 bg-background-50 p-4">
      <button type="button" onClick={() => setAberto((a) => !a)} className="flex w-full items-center gap-2 text-left" aria-expanded={aberto}>
        <i className="ri-links-line text-lg text-primary-500"></i>
        <span className="flex-1 font-heading text-base font-semibold text-foreground-950">Link seguro para médico ou nutricionista</span>
        <i className={aberto ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
      </button>
      {aberto && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-foreground-600">Quem receber abre o relatório sem precisar de conta. O link vence sozinho e você pode cancelar antes.</p>
          {!link ? (
            <>
              <label className="flex items-center gap-2">Vale por
                <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-lg border border-background-300 bg-background-50 px-2 py-1.5">
                  <option value={1}>1 dia</option><option value={7}>7 dias</option><option value={30}>30 dias</option>
                </select>
              </label>
              {temFotos && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={fotos} onChange={(e) => setFotos(e.target.checked)} /> Incluir as fotos</label>
              )}
              <button type="button" disabled={ocupado} onClick={() => void criar()} className="w-full rounded-lg bg-primary-500 px-4 py-2 font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">Criar link</button>
            </>
          ) : (
            <>
              <p className="break-all rounded-lg bg-background-100 px-3 py-2 text-xs" data-testid="link-seguro">{link.url}</p>
              <p className="text-xs text-foreground-500">Vence em {new Date(link.expira).toLocaleDateString('pt-BR')}.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void enviar()} className="flex-1 rounded-lg bg-primary-500 px-3 py-2 font-semibold text-background-50 dark:text-foreground-950">Enviar link</button>
                <button type="button" disabled={ocupado} onClick={() => void revogar()} className="rounded-lg border border-background-300 px-3 py-2 font-semibold text-foreground-700">Cancelar link</button>
              </div>
            </>
          )}
          {msg && <p className="text-xs text-foreground-600">{msg}</p>}
        </div>
      )}
    </section>
  );
}
