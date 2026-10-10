import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import CompartilharCartao from '@/components/feature/CompartilharCartao';
import { linkIndicacao } from '@/lib/ferramentas/cartao';
import { calcularConquistas, nivel, sequencias } from '@/lib/ferramentas/conquistas';
import { useHistorico } from '@/lib/ferramentas/useHistorico';

export default function Indique() {
  const { user } = useAuth();
  const h = useHistorico(user?.id, false);
  const [copiado, setCopiado] = useState(false);
  const link = user ? linkIndicacao(user.id) : '';
  const conq = useMemo(() => calcularConquistas(h), [h]);
  const nv = nivel(conq, h.treinos.length, h.refeicoes, h.checkins);
  const seq = sequencias(h.treinos.filter((t) => t.done_at).map((t) => new Date(t.done_at as string)));
  const dados = useMemo(() => ({
    titulo: `Nível ${nv.nivel} · ${nv.nome}`,
    data: new Date(),
    itens: [
      { rotulo: 'treinos', valor: String(h.treinos.length) },
      { rotulo: 'medalhas', valor: String(conq.filter((c) => c.ok).length) },
      { rotulo: 'maior sequência', valor: `${seq.maior}d` },
      { rotulo: 'XP', valor: nv.xp.toLocaleString('pt-BR') },
    ],
  }), [nv.nivel, nv.nome, nv.xp, h.treinos.length, conq, seq.maior]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sem área de transferência */ }
  };
  const compartilhar = async () => {
    try { await navigator.share({ title: 'Body Coach', text: 'Estou treinando com o Body Coach: treino, dieta e evolução no celular. Entra comigo:', url: link }); } catch { /* cancelou */ }
  };
  const whats = `https://wa.me/?text=${encodeURIComponent(`Estou treinando com o Body Coach: treino, dieta e evolução no celular. Entra comigo: ${link}`)}`;

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-br from-primary-500 to-primary-700 text-background-50 dark:text-foreground-950">
        <p className="font-heading text-xl font-bold">Indique e ganhe</p>
        <p className="mt-1 text-sm opacity-90">Cada amigo que entrar pelo seu link fica registrado como sua indicação. Quando os planos pagos começarem, cada indicação que assinar vale 1 mês de Premium para você.</p>
      </Card>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Seu link</p>
        <p className="mt-1 break-all rounded-lg bg-background-100 p-2.5 font-mono text-xs text-foreground-800">{link}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={whats} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white"><i className="ri-whatsapp-line text-lg"></i>WhatsApp</a>
          <button type="button" onClick={() => void (typeof navigator.share === 'function' ? compartilhar() : copiar())} className="flex items-center justify-center gap-1 rounded-xl border border-background-300 py-3 text-sm font-semibold text-foreground-800"><i className="ri-share-line"></i>{copiado ? 'Copiado!' : 'Compartilhar'}</button>
        </div>
        <button type="button" onClick={() => void copiar()} className="mt-2 w-full py-1 text-xs font-medium text-primary-700">{copiado ? 'Link copiado' : 'Copiar link'}</button>
      </Card>
      <Card>
        <p className="font-heading text-base font-semibold text-foreground-950">Seu progresso em story</p>
        <p className="mb-3 mt-1 text-xs text-foreground-500">Imagem pronta para Instagram e WhatsApp com seu nível e seu link.</p>
        {!h.carregando && <CompartilharCartao dados={dados} rotulo="Criar imagem do meu progresso" />}
      </Card>
      <Card>
        <p className="font-heading text-base font-semibold text-foreground-950"><i className="ri-star-smile-line mr-1 text-primary-500"></i>Seja embaixador</p>
        <p className="mt-1 text-sm text-foreground-600">É personal, nutricionista ou influenciador? Os primeiros parceiros ganham o plano Pro grátis e comissão nas assinaturas que indicarem.</p>
        <Link to="/feedback?assunto=embaixador" className="mt-3 inline-block rounded-xl border border-primary-300 px-4 py-2.5 text-sm font-semibold text-primary-700">Quero ser embaixador</Link>
      </Card>
    </div>
  );
}
