import Card from '@/components/base/Card';
import { dataCurta } from '@/lib/acesso';
import type { Conta } from './contas';

export interface Pedido { id: string; uid: string; email: string; nome: string; em: number }

// Quem tocou em "Já paguei": o admin confere o Pix no banco e libera 30 dias (coach usa a faixa escolhida acima).
export default function PedidosAcesso({ pedidos, contas, liberar }: { pedidos: Pedido[]; contas: Conta[]; liberar: (uid: string, dias: number, ehCoach?: boolean) => void }) {
  const dados = { pedidos, contas };
  return (
      <Card>
        <h2 className="font-semibold text-foreground-900">Avisaram que pagaram</h2>
        {!dados.pedidos.length && <p className="mt-1 text-sm text-foreground-500">Nenhum aviso.</p>}
        {dados.pedidos.map((p) => (
          <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2 border-t border-background-200 pt-2 text-sm">
            <span className="flex-1">{p.nome || p.email} · {p.email} · {dataCurta(p.em)}</span>
            <button onClick={() => liberar(p.uid, 30, dados.contas.some((c) => c.uid === p.uid && c.tipo === 'coach'))} className="rounded-lg bg-primary-500 px-3 py-2 font-semibold text-background-50">Confirmar Pix: +30 dias</button>
          </div>
        ))}
      </Card>
  );
}
