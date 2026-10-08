import { useEffect, useRef, useState } from 'react';
import { buscarPorCodigo, buscarPorNome, lerCodigoDaCamera, podeLerCodigo, porPorcao, type Alimento } from '@/lib/alimentos';
import type { MealFood } from '@/mocks/nutrition';

// Procura o alimento pelo nome ou pelo código de barras e preenche as calorias e macros pela quantidade em gramas.
export default function BuscaAlimento({ onAdd, onClose }: { onAdd: (m: MealFood) => void; onClose: () => void }) {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<Alimento[]>([]);
  const [escolhido, setEscolhido] = useState<Alimento | null>(null);
  const [gramas, setGramas] = useState('100');
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState('');
  const [camera, setCamera] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);

  const buscar = async () => {
    setMsg(''); setCarregando(true); setEscolhido(null);
    try {
      const so = texto.replace(/\s/g, '');
      if (/^\d{8,14}$/.test(so)) {
        const a = await buscarPorCodigo(so);
        if (a) { setLista([a]); setEscolhido(a); } else { setLista([]); setMsg('Não achei esse código. Tente buscar pelo nome.'); }
      } else {
        const r = await buscarPorNome(texto);
        setLista(r); if (!r.length) setMsg('Não achei nada. Tente outra palavra.');
      }
    } catch (e) { setMsg((e as Error).message); }
    finally { setCarregando(false); }
  };

  useEffect(() => {
    if (!camera) return;
    let parar = false;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (vid.current) { vid.current.srcObject = stream; await vid.current.play().catch(() => {}); }
        const c = vid.current ? await lerCodigoDaCamera(vid.current, () => parar) : null;
        if (c && !parar) { setTexto(c); setCamera(false); setCarregando(true); const a = await buscarPorCodigo(c); setCarregando(false); if (a) { setLista([a]); setEscolhido(a); } else setMsg('Li o código, mas não achei esse produto.'); }
      } catch { setMsg('Não consegui abrir a câmera. Digite o número do código.'); setCamera(false); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera]);

  const g = Number(gramas) > 0 ? Number(gramas) : 100;
  const adicionar = () => {
    if (!escolhido) return;
    const p = porPorcao(escolhido, g);
    onAdd({ id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: `${escolhido.nome} (${g} g)`, time: new Date().toTimeString().slice(0, 5), ...p });
    onClose();
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Buscar alimento ou código de barras</p>
      <form onSubmit={(e) => { e.preventDefault(); void buscar(); }} className="flex gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: iogurte natural ou 7891000100103" aria-label="Buscar alimento" className="min-w-0 flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-400" />
        <button type="submit" disabled={carregando || texto.trim().length < 2} className="rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50 disabled:opacity-40">{carregando ? '…' : 'Buscar'}</button>
        {podeLerCodigo() && <button type="button" onClick={() => setCamera((c) => !c)} aria-label="Ler código de barras com a câmera" className="rounded-lg border border-background-200 px-3 py-2 text-sm text-foreground-700"><i className="ri-barcode-line"></i></button>}
      </form>
      {camera && <video ref={vid} playsInline muted className="mt-2 aspect-video w-full rounded-lg bg-black object-cover" aria-label="Câmera para ler o código" />}
      {msg && <p role="status" className="mt-2 text-sm text-foreground-600">{msg}</p>}
      {!escolhido && lista.length > 0 && (
        <ul className="mt-2 space-y-1">
          {lista.map((a) => (
            <li key={a.codigo + a.nome}>
              <button type="button" onClick={() => setEscolhido(a)} className="flex w-full items-center justify-between rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-left hover:bg-background-100">
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground-800">{a.nome}</span>{a.marca && <span className="block truncate text-[11px] text-foreground-500">{a.marca}</span>}</span>
                <span className="ml-2 shrink-0 text-[11px] text-foreground-500">{a.kcal} kcal/100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {escolhido && (() => {
        const p = porPorcao(escolhido, g);
        return (
          <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
            <p className="text-sm font-semibold text-foreground-900">{escolhido.nome}</p>
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground-700">Quantidade (g)
              <input type="number" inputMode="numeric" value={gramas} onChange={(e) => setGramas(e.target.value)} className="w-24 rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm" />
            </label>
            <p className="mt-2 text-xs text-foreground-600">{p.calories} kcal · {p.protein} g prot · {p.carbs} g carbo · {p.fat} g gord</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={adicionar} className="flex-1 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50">Adicionar à refeição</button>
              <button type="button" onClick={() => setEscolhido(null)} className="rounded-lg border border-background-200 px-3 py-2 text-sm text-foreground-700">Voltar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
