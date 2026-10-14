import Card from '@/components/base/Card';
import { dataCurta } from '@/lib/acesso';
import type { Conta } from './contas';

export interface Pedido { id: string; uid: string; email: string; nome: string; em: number; plano?: 'mensal' | 'anual'; valor?: number; dias?: number; cupom?: string; pct?: number }

// Quem tocou em "Já paguei": o admin confere o Pix no banco e libera os dias do plano pedido (anual 365, mensal 30; coach usa a faixa escolhida acima).
export default function PedidosAcesso({ pedidos, contas, liberar }: { pedidos: Pedido[]; contas: Conta[]; liberar: (uid: string, dias: number, ehCoach?: boolean, valor?: number) => void }) {
  const dados = { pedidos, contas };
  return (
      <Card>
        <h2 className="font-semibold text-foreground-900">Avisaram que pagaram</h2>
        {!dados.pedidos.length && <p className="mt-1 text-sm text-foreground-500">Nenhum aviso.</p>}
        {dados.pedidos.map((p) => (
          <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2 border-t border-background-200 pt-2 text-sm">
            <span className="flex-1">{p.nome || p.email} · {p.email} · {dataCurta(p.em)}
              {p.plano && <><br /><b>Plano {p.plano}</b>{p.valor ? ` · R$ ${p.valor.toFixed(2).replace('.', ',')}` : ''}{p.cupom ? ` · cupom ${p.cupom} (${p.pct}%)` : ''}</>}
            </span>
            <button onClick={() => liberar(p.uid, p.dias || 30, dados.contas.some((c) => c.uid === p.uid && c.tipo === 'coach'), p.valor)} className="rounded-lg bg-primary-500 px-3 py-2 font-semibold text-background-50">Confirmar Pix: +{p.dias || 30} dias</button>
          </div>
        ))}
      </Card>
  );
}
