import { useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { compressImageToDataUrl, setUserDoc } from '@/lib/userData';
import { perguntar } from '@/lib/coachAI';

const TIPOS = [
  { id: 'suplemento', nome: 'Suplemento ou produto', dica: 'Foto do rótulo ou da embalagem' },
  { id: 'tabela', nome: 'Tabela nutricional', dica: 'Foto da tabela, bem de perto' },
  { id: 'prato', nome: 'Refeição', dica: 'Foto do prato' },
  { id: 'exame', nome: 'Exame de sangue', dica: 'Foto do resultado' },
] as const;

interface Avaliacao { id: string; em: number; tipo: string; texto: string }

// Foto -> IA grátis com visão -> avaliação em texto. Histórico guardado no perfil e no aparelho.
export default function AvaliarFoto() {
  const { user, profile, refreshProfile } = useAuth();
  const chave = user ? `bc_avaliar_${user.id}` : '';
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]['id']>('suplemento');
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [atual, setAtual] = useState<Avaliacao | null>(null);
  const [lista, setLista] = useState<Avaliacao[]>(() => {
    try { return chave ? JSON.parse(localStorage.getItem(chave) || '[]') : []; } catch { return []; }
  });
  const arq = useRef<HTMLInputElement>(null);
  const objetivo = String((profile as unknown as { onboarding?: { goal?: string; objetivo?: string } } | null)?.onboarding?.goal ?? (profile as unknown as { onboarding?: { objetivo?: string } } | null)?.onboarding?.objetivo ?? '');

  const avaliar = async (f: File) => {
    setLendo(true); setErro(''); setAtual(null);
    try {
      const foto = await compressImageToDataUrl(f, 1280, 220_000);
      const texto = (await perguntar('coach', 'Avalie o que está na foto para o meu objetivo.', { objetivo }, foto, undefined, 'produto', { tipo })).trim();
      if (!texto) throw new Error('Não consegui ler a foto. Tente com mais luz e mais perto.');
      const nova = { id: `a${Date.now()}`, em: Date.now(), tipo, texto };
      setAtual(nova);
      const todas = [nova, ...lista].slice(0, 30);
      setLista(todas);
      try { if (chave) localStorage.setItem(chave, JSON.stringify(todas)); } catch { /* sem armazenamento */ }
      if (user) void setUserDoc(user.id, 'profile', 'main', { avaliacoes_foto: todas }, true).then(refreshProfile).catch(() => {});
    } catch (e) { setErro((e as Error).message); } finally { setLendo(false); }
  };

  const t = TIPOS.find((x) => x.id === tipo)!;
  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((x) => (
            <button key={x.id} onClick={() => setTipo(x.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipo === x.id ? 'bg-primary-500 text-background-50' : 'border border-background-200 text-foreground-700'}`}>{x.nome}</button>
          ))}
        </div>
        <p className="mt-3 text-xs text-foreground-500">{t.dica}. Informação educativa: não substitui nutricionista ou médico.</p>
        <input ref={arq} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void avaliar(f); }} />
        <button onClick={() => arq.current?.click()} disabled={lendo} className="mt-3 w-full rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 disabled:opacity-60" data-testid="avaliar-foto">
          <i className="ri-camera-line mr-2"></i>{lendo ? 'Analisando...' : 'Tirar ou escolher foto'}
        </button>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      </Card>
      {atual && <Card padding="p-5"><p className="whitespace-pre-wrap text-sm text-foreground-800" data-testid="avaliar-resultado">{atual.texto}</p></Card>}
      {lista.length > 0 && (
        <Card padding="p-5">
          <div className="mb-2 text-sm font-semibold text-foreground-950">Avaliações anteriores</div>
          <ul className="space-y-2">
            {lista.filter((x) => x.id !== atual?.id).slice(0, 10).map((x) => (
              <li key={x.id}>
                <button onClick={() => setAtual(x)} className="w-full rounded-lg border border-background-200 px-3 py-2 text-left text-sm text-foreground-800">
                  {TIPOS.find((y) => y.id === x.tipo)?.nome ?? 'Avaliação'} · {new Date(x.em).toLocaleDateString('pt-BR')}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
