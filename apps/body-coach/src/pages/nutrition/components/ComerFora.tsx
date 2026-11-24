import { useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useNutrition } from '@/components/feature/NutritionContext';
import { useAuth } from '@/components/feature/AuthContext';
import { perguntar } from '@/lib/coachAI';
import { compressImageToDataUrl } from '@/lib/userData';

// Comer fora: foto do cardápio (ou o nome do restaurante) → a IA diz as 3 melhores escolhas para o que falta hoje
// e como pedir (ex.: molho à parte). Nada é salvo; registrar a refeição continua no botão de sempre.
export default function ComerFora() {
  const { totals, targets } = useNutrition();
  const { profile } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [lugar, setLugar] = useState('');
  const [resposta, setResposta] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const falta = { kcal: Math.max(0, Math.round((targets?.calories ?? 0) - (totals?.calories ?? 0))), proteina: Math.max(0, Math.round((targets?.protein ?? 0) - (totals?.protein ?? 0))) };
  const objetivo = String(profile?.onboarding?.goal ?? '');

  const pedir = async (foto?: string) => {
    setLendo(true); setErro(''); setResposta('');
    try {
      const msg = `Vou comer fora${lugar.trim() ? ` (${lugar.trim()})` : ''}. ${foto ? 'Esta é a foto do cardápio. ' : ''}Ainda faltam hoje ${falta.kcal} kcal e ${falta.proteina} g de proteína; objetivo: ${objetivo || 'saúde'}. ` +
        'Indique as 3 melhores opções (do cardápio, se houver foto), cada uma com calorias e proteína aproximadas e como pedir para ficar mais leve. Depois, 1 opção para evitar e por quê. Texto curto, sem markdown.';
      setResposta(await perguntar('nutrologo', msg, { falta_hoje: falta }, foto));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui agora. Tente de novo.');
    } finally { setLendo(false); }
  };
  const foto = async (f?: File) => {
    if (!f) return;
    try { await pedir(await compressImageToDataUrl(f, 1400, 260_000)); } catch { setErro('Não consegui abrir essa foto.'); }
    if (ref.current) ref.current.value = '';
  };

  return (
    <Card padding="p-3">
      <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-store-2-line mr-1 text-primary-500"></i>Comer fora</h2>
      <p className="mt-0.5 text-xs text-foreground-500">Tire foto do cardápio: o coach diz o que pedir para não sair da dieta (faltam {falta.kcal} kcal e {falta.proteina} g de proteína hoje).</p>
      <input value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={80} placeholder="Onde? (ex.: churrascaria, japonês, Outback)" aria-label="Restaurante"
        className="mt-2 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-400" />
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void foto(e.target.files?.[0])} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => ref.current?.click()} disabled={lendo} className="rounded-xl bg-primary-500 px-3 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-60" data-testid="foto-cardapio">
          <i className="ri-camera-line mr-1"></i>Foto do cardápio
        </button>
        <button type="button" onClick={() => void pedir()} disabled={lendo || lugar.trim().length < 3} className="rounded-xl border border-primary-300 px-3 py-2.5 text-sm font-semibold text-primary-700 disabled:opacity-50">Sem foto</button>
      </div>
      {lendo && <p className="mt-2 text-sm text-foreground-600"><i className="ri-loader-4-line mr-1 animate-spin"></i>Olhando o cardápio…</p>}
      {erro && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {resposta && <p className="mt-2 whitespace-pre-line rounded-xl bg-background-100 p-3 text-sm text-foreground-900" data-testid="resposta-fora">{resposta}</p>}
    </Card>
  );
}
