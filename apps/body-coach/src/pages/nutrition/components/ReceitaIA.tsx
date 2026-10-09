import { useState } from 'react';
import Card from '@/components/base/Card';
import { useNutrition } from '@/components/feature/NutritionContext';
import { perguntar } from '@/lib/coachAI';

// Receita feita sob medida: a IA usa o que o aluno tem em casa e o que ainda falta de calorias e proteína hoje.
export default function ReceitaIA() {
  const { totals, targets } = useNutrition();
  const [tenho, setTenho] = useState('');
  const [receita, setReceita] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const gerar = async () => {
    if (carregando) return;
    setCarregando(true);
    setErro('');
    try {
      const faltaKcal = Math.max(0, Math.round(targets.calories - totals.calories));
      const faltaProt = Math.max(0, Math.round(targets.protein - totals.protein));
      const pedido = tenho.trim() ? `Quero uma receita com o que tenho em casa: ${tenho.trim()}.` : 'Quero uma receita para a minha próxima refeição.';
      const texto = await perguntar('nutrologo', pedido, { faltaKcal, faltaProteina: faltaProt }, undefined, undefined, 'receita');
      if (!texto.trim()) throw new Error('vazio');
      setReceita(texto.trim());
    } catch (e) {
      setErro(e instanceof Error && e.message !== 'vazio' ? e.message : 'Não consegui criar a receita agora. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Card padding="p-5">
      <div className="flex items-center gap-2">
        <i className="ri-restaurant-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Receita para você</h2>
      </div>
      <p className="mt-1 text-sm text-foreground-600">Diga o que tem em casa (ou deixe em branco) e eu crio uma receita que cabe nas suas metas de hoje.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={tenho}
          onChange={(e) => setTenho(e.target.value)}
          maxLength={200}
          placeholder="Ex.: ovo, arroz, frango, banana"
          aria-label="O que você tem em casa"
          className="flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300"
        />
        <button
          onClick={() => void gerar()}
          disabled={carregando}
          className="whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-60"
        >
          {carregando ? 'Criando…' : receita ? 'Outra receita' : 'Criar receita'}
        </button>
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-primary-800">{erro}</p>}
      {receita && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-background-100 p-4 font-body text-sm leading-relaxed text-foreground-800">{receita}</pre>}
    </Card>
  );
}
