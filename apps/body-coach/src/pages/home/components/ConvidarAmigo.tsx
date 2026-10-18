import { useEffect, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { chatApi } from '@/lib/chat';
import { verCupom } from '@/lib/acesso';
import { codigoIndicacao } from '@/lib/ferramentas/cartao';

// Monta o link curto de convite (com cupom, se houver) e a mensagem pronta para o WhatsApp.
// Coach: link curto da equipe. Aluno comum: link de indicação (quem indicou ganha 1 mês quando o amigo assina).
export const linkConvite = (origem: string, base: string, codigoCoach: string, cupom: string, indicacao = '') => {
  const extra = cupom ? `cupom=${encodeURIComponent(cupom)}` : '';
  if (codigoCoach) return `${origem}${base}c/${codigoCoach}${extra ? `?${extra}` : ''}`;
  const q = [indicacao ? `ref=${indicacao}` : '', extra].filter(Boolean).join('&');
  return `${origem}${base}${indicacao ? 'auth' : 'c/amigo'}${q ? `?${q}` : ''}`;
};

export const recadoConvite = (nome: string, link: string, pct = 0) =>
  `Oi! Sou ${nome || 'seu amigo'} e estou treinando com o Body Coach (treino, dieta e coach de IA no celular). Entra pelo meu link${pct ? ` e ganha ${pct}% de desconto no Premium` : ''}: ${link}`;

export default function ConvidarAmigo({ onFechar }: { onFechar: () => void }) {
  const { user, profile } = useAuth();
  const [codigoCoach, setCodigoCoach] = useState('');
  const [cupom, setCupom] = useState('');
  const [msg, setMsg] = useState('');
  const nome = (profile?.nickname || profile?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];

  useEffect(() => {
    chatApi<{ papel: string; codigo?: string }>({ acao: 'contatos' }).then((r) => { if (r.papel === 'coach' && r.codigo) setCodigoCoach(r.codigo); }).catch(() => { /* sem coach: link comum */ });
  }, []);

  const preparar = async () => {
    setMsg('');
    let pct = 0;
    const c = cupom.trim().toUpperCase();
    if (c) {
      try { pct = (await verCupom(c)).pct; } catch (e) { setMsg((e as Error).message); return null; }
    }
    const link = linkConvite(window.location.origin, import.meta.env.BASE_URL, codigoCoach, c, user ? codigoIndicacao(user.id) : '');
    return { link, texto: recadoConvite(nome, link, pct) };
  };
  const zap = async () => { const r = await preparar(); if (r) window.open(`https://wa.me/?text=${encodeURIComponent(r.texto)}`, '_blank', 'noopener'); };
  const copiar = async () => {
    const r = await preparar();
    if (!r) return;
    try { await navigator.clipboard.writeText(r.texto); setMsg('Mensagem copiada! Cole no WhatsApp.'); } catch { setMsg('Não consegui copiar. Use o botão do WhatsApp.'); }
  };

  return (
    <section className="rounded-2xl border border-primary-300 bg-primary-100 p-4" aria-label="Convidar um amigo">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold text-foreground-950"><i className="ri-user-add-line mr-1"></i>Convidar um amigo</h2>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-foreground-500"><i className="ri-close-line text-xl"></i></button>
      </div>
      <p className="mt-1 text-sm text-foreground-700">{codigoCoach ? 'Quem entrar pelo seu link entra na sua equipe.' : 'Mande o seu link por WhatsApp.'} Tem cupom de desconto? Coloque abaixo e ele vai junto no link.</p>
      <input value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} placeholder="Cupom (opcional)" aria-label="Cupom do convite" className="mt-2 w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-base uppercase" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void zap()} className="rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white"><i className="ri-whatsapp-line mr-1"></i>Enviar no WhatsApp</button>
        <button type="button" onClick={() => void copiar()} className="rounded-xl border border-primary-300 px-4 py-2 text-sm font-semibold text-primary-700"><i className="ri-file-copy-line mr-1"></i>Copiar mensagem</button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-primary-700">{msg}</p>}
    </section>
  );
}
