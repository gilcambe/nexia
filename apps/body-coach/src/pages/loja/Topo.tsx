import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import type { CoachPublico } from '@/lib/coach/negocio';

// Topo da página pública do coach: foto/logo, bio, alunos, WhatsApp, "Treinar comigo" e QR code para divulgar.
export default function Topo({ coach, codigo }: { coach: CoachPublico; codigo: string }) {
  const link = `${location.origin}${import.meta.env.BASE_URL}loja/${codigo}`;
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(link); q.make(); return q.createDataURL(5, 2); }, [link]);
  const [copiado, setCopiado] = useState(false);
  const nome = coach.marca?.nome || coach.nome;
  const imagem = coach.marca?.logo || coach.foto;
  const whats = (coach.whats || '').replace(/\D/g, '');
  const wa = whats ? `https://wa.me/${whats.length >= 12 && whats.startsWith('55') ? whats : `55${whats}`}` : '';
  const compartilhar = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: nome, text: `Treine comigo: ${nome}`, url: link }); return; }
      await navigator.clipboard.writeText(link); setCopiado(true);
    } catch { /* cancelado */ }
  };
  return (
    <header className="space-y-3 rounded-2xl border border-background-200 bg-white p-4 shadow-sm dark:bg-background-100" data-testid="loja-topo">
      <div className="flex items-center gap-3">
        {imagem ? <img src={imagem} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-700"><i className="ri-user-star-line"></i></span>}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold leading-tight text-foreground-950">{nome}</h1>
          {(coach.alunos ?? 0) >= 3 && <p className="text-sm text-foreground-600"><i className="ri-group-line mr-1"></i>{coach.alunos} alunos treinando comigo</p>}
        </div>
      </div>
      {coach.bio && <p className="whitespace-pre-line text-sm text-foreground-700">{coach.bio}</p>}
      <div className="grid gap-2">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"><i className="ri-whatsapp-line text-lg"></i>Falar no WhatsApp</a>}
        <Link to={`/convite/${codigo}`} className="rounded-xl bg-primary-500 px-4 py-3 text-center text-sm font-semibold text-white">Treinar comigo</Link>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-background-50 p-3">
        <img src={qr} alt="QR code da minha página" className="h-24 w-24 shrink-0 rounded-lg bg-white p-1 [image-rendering:pixelated]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-foreground-500">Aponte a câmera ou envie o link.</p>
          <button type="button" onClick={() => void compartilhar()} className="mt-2 w-full rounded-lg border border-background-200 px-3 py-2 text-sm font-semibold text-foreground-800"><i className="ri-share-line mr-1"></i>{copiado ? 'Link copiado!' : 'Compartilhar'}</button>
        </div>
      </div>
    </header>
  );
}
