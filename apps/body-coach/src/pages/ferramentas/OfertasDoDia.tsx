// "Ofertas do dia" da Loja: produtos de treino que o robô de afiliados encontrou (links já com o código de afiliado).
import { useEffect, useState } from 'react';
import { chatApi } from '@/lib/chat';

export interface OfertaLoja {
  id: string; loja: string; titulo: string; preco: number | null; preco_antigo: number | null;
  desconto: number; imagem: string; link: string; categoria: string;
}

export const CATEGORIAS_OFERTAS: { id: string; nome: string; icone: string }[] = [
  { id: 'suplementos', nome: 'Suplementos', icone: 'ri-capsule-line' },
  { id: 'roupas', nome: 'Roupas', icone: 'ri-t-shirt-line' },
  { id: 'acessorios', nome: 'Acessórios', icone: 'ri-cup-line' },
  { id: 'em-casa', nome: 'Treino em casa', icone: 'ri-home-heart-line' },
  { id: 'relogios', nome: 'Relógios', icone: 'ri-time-line' },
  { id: 'fones', nome: 'Fones', icone: 'ri-headphone-line' },
];

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CartaoOferta({ o }: { o: OfertaLoja }) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-background-200 bg-background-50">
      <div className="relative aspect-[4/3] bg-white">
        {o.imagem ? <img src={o.imagem} alt="" loading="lazy" className="h-full w-full object-contain" /> : <i className="ri-shopping-bag-line absolute inset-0 m-auto h-fit w-fit text-3xl text-foreground-300"></i>}
        {o.desconto >= 5 && <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">-{o.desconto}%</span>}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground-900">{o.titulo}</p>
        <div className="mt-1.5">
          {o.preco != null && <p className="text-sm font-bold text-foreground-950">{reais(o.preco)}</p>}
          {o.preco_antigo != null && <p className="text-[11px] text-foreground-400 line-through">{reais(o.preco_antigo)}</p>}
        </div>
        {o.loja && <p className="mb-2 mt-0.5 text-[11px] text-foreground-500">{o.loja}</p>}
        <a href={o.link} target="_blank" rel="noopener sponsored" className="mt-auto block rounded-lg bg-primary-500 py-2 text-center text-xs font-bold text-background-50 dark:text-foreground-950">Ver oferta</a>
      </div>
    </div>
  );
}

export function OfertasLista({ ofertas }: { ofertas: OfertaLoja[] }) {
  const cats = CATEGORIAS_OFERTAS.filter((c) => ofertas.some((o) => o.categoria === c.id));
  const [cat, setCat] = useState('');
  const atual = cats.some((c) => c.id === cat) ? cat : cats[0]?.id;
  if (!cats.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400"><i className="ri-flashlight-line mr-1 text-primary-500"></i>Ofertas do dia</h2>
      <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
        {cats.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={atual === c.id} onClick={() => setCat(c.id)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${atual === c.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>
            <i className={c.icone}></i>{c.nome}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ofertas.filter((o) => o.categoria === atual).map((o) => <CartaoOferta key={o.id} o={o} />)}</div>
      <p className="mt-2 text-[11px] text-foreground-400">Links de afiliado: o Body Coach pode ganhar uma comissão, sem custo extra para você.</p>
    </section>
  );
}

export default function OfertasDoDia() {
  const [ofertas, setOfertas] = useState<OfertaLoja[] | null>(null);
  useEffect(() => {
    let vivo = true;
    chatApi<{ ofertas?: OfertaLoja[] }>({ acao: 'loja_ofertas' })
      .then((r) => { if (vivo) setOfertas(Array.isArray(r.ofertas) ? r.ofertas : []); })
      .catch(() => { if (vivo) setOfertas([]); });
    return () => { vivo = false; };
  }, []);
  if (ofertas === null) return <p className="text-sm text-foreground-500"><i className="ri-loader-4-line mr-1 animate-spin"></i>Carregando ofertas...</p>;
  if (!ofertas.length) return <p className="text-sm text-foreground-500">Sem ofertas agora. Veja "Para você" ou o "Catálogo".</p>;
  return <OfertasLista ofertas={ofertas} />;
}
