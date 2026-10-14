import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { chatApi } from '@/lib/chat';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';

const DEPOIS_DE = 10; // treinos feitos
const VOLTA_EM = 15 * 86400000; // "Agora não" volta em 15 dias

// Card "Está gostando do Body Coach?": aparece 1 vez depois do 10º treino. 4-5 estrelas pede uma frase
// (e se pode mostrar na página do app); 1-3 pergunta o que melhorar (só para o admin).
export default function PedirAvaliacao() {
  const { user } = useAuth();
  const chave = user ? `bc_avaliou_${user.id}` : '';
  const [mostrar, setMostrar] = useState(false);
  const [estrelas, setEstrelas] = useState(0);
  const [texto, setTexto] = useState('');
  const [publicar, setPublicar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    try {
      const v = localStorage.getItem(chave);
      if (v === 'feito' || (v && Number(v) > Date.now())) return;
    } catch { return; }
    carregarTreinos(user.id).then((t) => { if (vivo && t.length >= DEPOIS_DE) setMostrar(true); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [user, chave]);

  const guardar = (v: string) => { try { localStorage.setItem(chave, v); } catch { /* sem armazenamento */ } };
  const agoraNao = () => { guardar(String(Date.now() + VOLTA_EM)); setMostrar(false); };
  const enviar = async () => {
    setEnviando(true);
    try {
      await chatApi({ acao: 'avaliar', estrelas, texto: texto.trim(), publicar: estrelas >= 4 && publicar, nome: user?.email?.split('@')[0] ?? '' });
      guardar('feito'); setFeito(true);
      setTimeout(() => setMostrar(false), 2500);
    } catch { /* tenta de novo depois */ } finally { setEnviando(false); }
  };

  if (!mostrar) return null;
  const bom = estrelas >= 4;
  return (
    <section className="rounded-2xl border border-primary-200 bg-primary-50 p-4" data-testid="pedir-avaliacao">
      {feito ? <p role="status" className="text-center text-sm font-semibold text-foreground-900">Obrigado! 💪</p> : (
        <>
          <p className="font-heading text-base font-bold text-foreground-950">Está gostando do Body Coach?</p>
          <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Sua nota">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={estrelas === n} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} onClick={() => setEstrelas(n)} className="p-1 text-3xl text-amber-400">
                <i className={n <= estrelas ? 'ri-star-fill' : 'ri-star-line'}></i>
              </button>
            ))}
          </div>
          {estrelas > 0 && (
            <>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} rows={2} placeholder={bom ? 'Conte em uma frase' : 'O que podemos melhorar?'} aria-label={bom ? 'Conte em uma frase' : 'O que podemos melhorar?'} className="mt-2 w-full rounded-xl border border-background-200 bg-background-50 p-3 text-sm outline-none focus:border-primary-300" />
              {bom && <label className="mt-1 flex items-center gap-2 text-sm text-foreground-700"><input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />Pode mostrar na página do app</label>}
              <button type="button" disabled={enviando} onClick={() => void enviar()} className="mt-3 w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-background-50 disabled:opacity-50">{enviando ? 'Enviando…' : 'Enviar'}</button>
            </>
          )}
          <button type="button" onClick={agoraNao} className="mt-2 w-full py-1 text-sm font-medium text-foreground-500">Agora não</button>
        </>
      )}
    </section>
  );
}
