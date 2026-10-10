import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { interpretMarker } from '@/pages/exams/components/markerRules';
import { PRODUTOS, linkAmazon, linkMercadoLivre, recomendados, type ProdutoLoja } from '@/lib/ferramentas/loja';

function Produto({ p }: { p: ProdutoLoja }) {
  return (
    <div className="rounded-2xl border border-background-200 bg-background-50 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-xl text-primary-700"><i className={p.icone}></i></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground-950">{p.nome}</p>
          <p className="text-xs text-foreground-500">{p.porque}</p>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <a href={linkAmazon(p.busca)} target="_blank" rel="noreferrer sponsored" className="rounded-lg bg-[#ff9900] py-2 text-center text-xs font-bold text-black">Ver na Amazon</a>
        <a href={linkMercadoLivre(p.busca)} target="_blank" rel="noreferrer sponsored" className="rounded-lg bg-[#ffe600] py-2 text-center text-xs font-bold text-[#2d3277]">Mercado Livre</a>
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

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (busca.trim()) window.open(linkAmazon(busca.trim()), '_blank', 'noopener'); }} className="flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto (ex.: whey, tênis)" className="min-w-0 flex-1 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Buscar produto" />
        <button type="submit" className="rounded-xl bg-primary-500 px-4 text-background-50 dark:text-foreground-950" aria-label="Buscar"><i className="ri-search-line"></i></button>
      </form>

      {recs.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400"><i className="ri-sparkling-line mr-1 text-primary-500"></i>Para você (objetivo, dieta e exames)</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{recs.map((p) => <Produto key={p.id} p={p} />)}</div>
        </section>
      )}

      <section>
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cat === c ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>{c}</button>)}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{PRODUTOS.filter((p) => p.categoria === cat).map((p) => <Produto key={p.id} p={p} />)}</div>
      </section>

      <Card padding="p-4">
        <p className="text-xs text-foreground-500"><i className="ri-information-line mr-1"></i>A compra é feita direto na Amazon ou no Mercado Livre, com a segurança e a entrega deles. O Body Coach pode receber uma pequena comissão, sem custo extra para você. Suplementos: confira com seu nutricionista e, se for atleta federado, na aba Anti-Doping.</p>
      </Card>
    </div>
  );
}
