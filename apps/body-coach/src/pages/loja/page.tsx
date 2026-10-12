import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { useAuth } from '@/components/feature/AuthContext';
import { avisarCompra, comprar, minhasCompras, verLoja, type Compra, type ProgramaPublico } from '@/lib/coach/negocio';
import { codigoPix, reais, type TipoChave } from '@/lib/ferramentas/pix';

type Loja = Awaited<ReturnType<typeof verLoja>>;
interface Pagando { compra: Compra; codigo: string; coach: string }

// Loja pública do coach: qualquer pessoa vê os programas; para comprar entra (ou cria a conta) e paga por Pix direto ao coach.
export default function LojaPage() {
  const { codigo = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [erro, setErro] = useState('');
  const [compras, setCompras] = useState<Compra[]>([]);
  const [pagando, setPagando] = useState<Pagando | null>(null);
  const [ocupado, setOcupado] = useState('');

  useEffect(() => { verLoja(codigo).then(setLoja).catch((e: Error) => setErro(e.message)); }, [codigo]);
  useEffect(() => { if (user) minhasCompras().then(setCompras).catch(() => undefined); }, [user]);

  const iniciar = async (p: ProgramaPublico) => {
    if (!user) { navigate('/auth', { state: { from: `/loja/${codigo}` } }); return; }
    setOcupado(p.id); setErro('');
    try {
      const r = await comprar(p.id);
      setPagando({ compra: r.compra, coach: r.coach, codigo: codigoPix({ ...r.pix, tipo: r.pix.tipo as TipoChave, valor: r.compra.preco, descricao: p.titulo }) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(''); }
  };

  return (
    <div className="min-h-screen bg-background-50 px-4 py-6">
      <div className="mx-auto max-w-xl space-y-4">
        {loja && (
          <header className="flex items-center gap-3">
            {loja.coach.foto ? <img src={loja.coach.foto} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-2xl text-primary-700"><i className="ri-user-star-line"></i></span>}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Programas de</p>
              <h1 className="font-heading text-2xl font-bold text-foreground-950">{loja.coach.nome}</h1>
            </div>
          </header>
        )}
        {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
        {!loja && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}

        {pagando && <PagarPix p={pagando} onAvisou={() => setPagando({ ...pagando, compra: { ...pagando.compra, status: 'avisou' } })} />}

        {loja && loja.programas.length === 0 && <p className="rounded-xl bg-background-100 p-4 text-sm text-foreground-600">Nenhum programa à venda agora.</p>}
        <ul className="space-y-3">
          {loja?.programas.map((p) => {
            const minha = compras.find((c) => c.programa === p.id && c.status !== 'recusado');
            return (
              <li key={p.id} className="rounded-2xl border border-background-200 bg-white p-4 shadow-sm dark:bg-background-100" data-testid="loja-programa">
                <h2 className="font-heading text-lg font-bold text-foreground-950">{p.titulo}</h2>
                <p className="text-xs text-foreground-500">{p.semanas} semanas · {p.resumo}{p.temDieta ? ' · com dieta' : ''}</p>
                {p.descricao && <p className="mt-2 whitespace-pre-line text-sm text-foreground-700">{p.descricao}</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="font-heading text-2xl font-bold text-foreground-950">{reais(p.preco)}</p>
                  {minha?.status === 'pago'
                    ? <Link to="/workout" className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white">Já é seu: treinar</Link>
                    : <button type="button" disabled={!!ocupado || !loja.coach.recebePix} onClick={() => void iniciar(p)} className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{ocupado === p.id ? 'Abrindo...' : minha ? 'Ver o Pix de novo' : 'Comprar com Pix'}</button>}
                </div>
                {minha && minha.status !== 'pago' && <p className="mt-2 text-xs text-secondary-800">{minha.status === 'avisou' ? '⏳ Você avisou que pagou; aguardando o coach confirmar.' : 'Pix gerado; falta pagar.'}</p>}
              </li>
            );
          })}
        </ul>
        <p className="text-center text-xs text-foreground-400">O pagamento vai direto para o coach, sem taxa. Ao confirmar, o programa aparece no seu app NEXIA Body Coach.</p>
      </div>
    </div>
  );
}

function PagarPix({ p, onAvisou }: { p: Pagando; onAvisou: () => void }) {
  const src = useMemo(() => { const q = qrcode(0, 'M'); q.addData(p.codigo); q.make(); return q.createDataURL(6, 2); }, [p.codigo]);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-center" data-testid="loja-pix">
      <p className="text-sm font-semibold text-foreground-900">{p.compra.titulo} · {reais(p.compra.preco)}</p>
      {p.compra.status === 'avisou' ? (
        <p className="mt-2 text-sm text-foreground-700" role="status">✅ {p.coach} foi avisado. Assim que ele confirmar o Pix, o programa aparece no seu app e você recebe um aviso.</p>
      ) : (
        <>
          <img src={src} alt="QR Code do Pix" className="mx-auto mt-2 h-52 w-52 rounded-xl bg-white p-1 [image-rendering:pixelated]" />
          <p className="mt-1 text-xs text-foreground-500">App do banco › Pix › Ler QR Code, ou copie o código.</p>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(p.codigo); setCopiado(true); } catch { /* sem área de transferência */ } }} className="mt-2 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white">{copiado ? 'Copiado! Cole no app do banco' : 'Copiar Pix copia e cola'}</button>
          <button type="button" disabled={ocupado} onClick={async () => { setOcupado(true); try { await avisarCompra(p.compra.id); onAvisou(); } finally { setOcupado(false); } }} className="mt-2 w-full rounded-xl border border-background-200 bg-background-50 px-4 py-3 text-sm font-semibold text-foreground-800">Já paguei, avisar o coach</button>
        </>
      )}
    </div>
  );
}
