import Card from '@/components/base/Card';
import type { Conta } from './contas';

// Números do mês e a faixa/valor usados ao confirmar um pagamento.
export default function ResumoAcesso({ contas, receitaMes, faixa, setFaixa, valor, setValor }: { contas: Conta[]; receitaMes: number; faixa: string; setFaixa: (v: string) => void; valor: string; setValor: (v: string) => void }) {
  const agora = Date.now();
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card><p className="text-xs text-foreground-500">Receita do mês</p><p className="font-heading text-lg font-bold">R$ {receitaMes.toFixed(2).replace('.', ',')}</p></Card>
        <Card><p className="text-xs text-foreground-500">Pagantes</p><p className="font-heading text-lg font-bold">{contas.filter((c) => c.pagoAte > agora).length}</p></Card>
        <Card><p className="text-xs text-foreground-500">Contas</p><p className="font-heading text-lg font-bold">{contas.length}</p></Card>
      </div>
      <Card>
        <p className="text-sm text-foreground-700">Ao liberar um <b>coach</b>, use esta faixa:</p>
        <select value={faixa} onChange={(e) => setFaixa(e.target.value)} aria-label="Faixa do coach" className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2 text-sm">
          <option value="15">Até 15 alunos (R$ 49)</option>
          <option value="40">Até 40 alunos (R$ 89)</option>
          <option value="9999">Ilimitado (R$ 149)</option>
        </select>
        <label className="mt-2 block text-sm">Valor recebido (R$)<input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="19,90" className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
      </Card>
    </>
  );
}
