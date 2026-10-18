import { Cartao, Botao } from "../central/ui";
import { haQuanto } from "../central/api";
import { NOME_PR } from "./api";
import type { PR } from "./api";

// Os PRs que o Cortex abriu para um pedido, com o estado dos testes e o botão de aprovar.
export default function PrsDoPedido({ prs, ocupado, aprovar }: { prs: PR[]; ocupado: boolean; aprovar: (pr: number) => void }) {
  return (
    <Cartao titulo="O que o Cortex entregou">
      {!prs.length && <p className="text-sm text-nexia-muted">Nenhum PR ainda.</p>}
      {prs.map((p) => (
        <div key={p.numero} className="rounded-xl bg-nexia-surface2 p-3 text-sm space-y-2" data-testid="pedido-pr">
          <a href={p.link} target="_blank" rel="noopener noreferrer" className="block break-words">PR #{p.numero} · {NOME_PR[p.estado]}</a>
          {p.ci && <p className="text-xs text-nexia-muted">Testes: {p.ci === "verde" ? "🟢 passaram" : p.ci === "vermelho" ? "🔴 falharam" : p.ci === "rodando" ? "🟡 rodando" : "sem testes"} · {haQuanto(p.quando)}</p>}
          {p.estado === "aberto" && p.ramo.startsWith("nexia/") && !p.automerge && (
            <Botao disabled={ocupado} onClick={() => confirm("Aprovar este PR? Ele entra no app quando os testes passarem.") && aprovar(p.numero)} testid="pedido-aprovar">👍 Aprovar e juntar</Botao>
          )}
          {p.automerge && p.estado === "aberto" && <p className="text-xs text-emerald-400">Aprovado: entra sozinho quando os testes passarem.</p>}
        </div>
      ))}
    </Cartao>
  );
}
