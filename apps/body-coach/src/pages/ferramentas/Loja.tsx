import { useMemo, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { interpretMarker } from '@/pages/exams/components/markerRules';
import OfertasDoDia from './OfertasDoDia';
import { PRODUTOS, linkAmazon, linkMercadoLivre, recomendados, type ProdutoLoja } from '@/lib/ferramentas/loja';

function Produto({ p }: { p: ProdutoLoja }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-background-200 bg-background-50 p-2">
      <div className="flex items-center gap-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-base text-primary-700"><i className={p.icone}></i></span>
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground-950">{p.nome}</p>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-foreground-500" title={p.porque}>{p.porque}</p>
      <div className="mt-auto grid grid-cols-2 gap-1 pt-1.5">
        <a href={linkAmazon(p.busca)} target="_blank" rel="noreferrer sponsored" className="rounded-md bg-[#ff9900] py-1.5 text-center text-[11px] font-bold text-black" aria-label={`Ver ${p.nome} na Amazon`}>Amazon</a>
        <a href={linkMercadoLivre(p.busca)} target="_blank" rel="noreferrer sponsored" className="rounded-md bg-[#ffe600] py-1.5 text-center text-[11px] font-bold text-[#2d3277]" aria-label={`Ver ${p.nome} no Mercado Livre`}>M. Livre</a>
      </div>
    </div>
  );
}

export default function Loja() {
  const { profile } = useAuth();
  const ob = (profile?.onboarding ?? {}) as Record<string, unknown>;
  const ult = [...(profile?.marcadores_hist ?? [])].sort((a, b) => a.data.localeCompare(b.data)).pop();
  const baixos = ult ? Object.entries(ult.valores).filter(([k, v]) => interpretMarker(k, v)?.status === 'low').map(([k]) => k) : [];
  const altos = ult ? Object.entries(ult.valores).filter(([k, v]) => interpretMarker(k, v)?.status === 'high').map(([k]) => k) : [];
  const recs = useMemo(() => recomendados({
    objetivo: String(ob.goal ?? ''),
    modalidades: Array.isArray(ob.modality) ? (ob.modality as string[]) : [],
    marcadoresBaixos: [...baixos, ...altos],
    suplementos: (profile?.suplementos ?? []).map((s) => s.nome),
  }), [ob.goal, ob.modality, baixos.join(), altos.join(), profile?.suplementos]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = [...new Set(PRODUTOS.map((p) => p.categoria))];
  const [cat, setCat] = useState<string>(cats[0]);
  const [busca, setBusca] = useState('');
  const [parte, setParte] = useState<'ofertas' | 'voce' | 'catalogo'>('ofertas');

  // Em abas (ofertas, para você, catálogo) e cartões em 2 colunas: menos rolagem no celular.
  return (
    <div className="space-y-2">
      <form onSubmit={(e) => { e.preventDefault(); if (busca.trim()) window.open(linkAmazon(busca.trim()), '_blank', 'noopener'); }} className="flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto (ex.: whey, tênis)" className="min-w-0 flex-1 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-sm" aria-label="Buscar produto" />
        <button type="submit" className="rounded-xl bg-primary-500 px-4 text-background-50 dark:text-foreground-950" aria-label="Buscar"><i className="ri-search-line"></i></button>
      </form>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-background-100 p-1" role="tablist" aria-label="Partes da loja">
        {([['ofertas', 'Ofertas'], ['voce', 'Para você'], ['catalogo', 'Catálogo']] as const).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={parte === id} onClick={() => setParte(id)} className={`rounded-lg py-1.5 text-xs font-semibold ${parte === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{nome}</button>
        ))}
      </div>

      {parte === 'ofertas' && <OfertasDoDia />}

      {parte === 'voce' && (recs.length > 0
        ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{recs.map((p) => <Produto key={p.id} p={p} />)}</div>
        : <p className="text-sm text-foreground-500">Responda o questionário e registre seus exames para ver indicações para você.</p>)}

      {parte === 'catalogo' && (
        <section>
          <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cat === c ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>{c}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{PRODUTOS.filter((p) => p.categoria === cat).map((p) => <Produto key={p.id} p={p} />)}</div>
        </section>
      )}

      <p className="text-[11px] leading-snug text-foreground-400"><i className="ri-information-line mr-1"></i>Compra direto na Amazon ou no Mercado Livre. O Body Coach pode receber uma pequena comissão, sem custo extra. Suplementos: confira com seu nutricionista e, se for atleta federado, no Anti-Doping.</p>
    </div>
  );
}
