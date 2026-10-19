import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { compartilharCanvas, desenharCartao, desenharResumoSemanal, linkIndicacao, type DadosCartao } from '@/lib/ferramentas/cartao';

// Botão + prévia do cartão para Instagram/WhatsApp. O nome e o link de indicação entram sozinhos.
// formato 'feed': resumo da semana em 1080×1350 (post do Instagram); padrão: story 1080×1920.
export default function CompartilharCartao({ dados, rotulo = 'Compartilhar no Instagram', formato = 'story', texto = 'Treino feito no Body Coach! 💪' }: { dados: Omit<DadosCartao, 'nome' | 'link'>; rotulo?: string; formato?: 'story' | 'feed'; texto?: string }) {
  const { user, profile } = useAuth();
  const ref = useRef<HTMLCanvasElement>(null);
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState('');
  const link = user ? linkIndicacao(user.id) : '';
  const nome = profile?.nickname || profile?.full_name?.split(' ')[0] || undefined;

  useEffect(() => {
    if (aberto && ref.current) (formato === 'feed' ? desenharResumoSemanal : desenharCartao)(ref.current, { ...dados, nome, link });
  }, [aberto, dados, nome, link, formato]);

  const enviar = async () => {
    if (!ref.current) return;
    try {
      const r = await compartilharCanvas(ref.current, texto, link);
      setMsg(r === 'baixado' ? `Imagem salva. Poste no ${formato === 'feed' ? 'feed' : 'story'} e marque @nexiabodycoach!` : '');
    } catch {
      setMsg('Não consegui gerar a imagem neste aparelho.');
    }
  };

  return (
    <div>
      <button type="button" onClick={() => setAberto((a) => !a)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 py-3 text-sm font-semibold text-white">
        <i className="ri-instagram-line text-lg"></i>{rotulo}
      </button>
      {aberto && (
        <div className="mt-3 space-y-2">
          <canvas ref={ref} className="mx-auto block w-48 rounded-xl shadow-lg" aria-label="Prévia do cartão" />
          <button type="button" onClick={() => void enviar()} className="w-full rounded-xl bg-foreground-950 py-3 text-sm font-semibold text-background-50"><i className="ri-share-forward-line mr-1"></i>Enviar imagem</button>
          {msg && <p className="text-center text-xs text-foreground-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
