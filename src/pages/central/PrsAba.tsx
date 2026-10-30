import type { Dados } from "./api";
import { haQuanto } from "./api";
import { Cartao, Botao, Carregando } from "./ui";
import { Icone } from "./icones";

const REPO = "https://github.com/gilcambe/nexia";

// Aba PRs: o que o Cortex entregou e atalhos para os PRs abertos e juntados no GitHub.
export default function PrsAba({ d, erro }: { d: Dados; erro?: string }) {
  const x = d.cortex;
  return (
    <div className="space-y-4">
      <Cartao titulo="PRs no GitHub" resumo="Conferindo…" icone={<Icone nome="prs" />}>
        <div className="grid grid-cols-2 gap-2">
          <Botao href={`${REPO}/pulls?q=is%3Apr+is%3Aopen`}>Abertos</Botao>
          <Botao href={`${REPO}/pulls?q=is%3Apr+is%3Amerged`}>Juntados</Botao>
        </div>
        <Botao href="/meu-cortex">Pedidos e aprovação</Botao>
      </Cartao>
      {!x ? <Carregando erro={erro} /> : (
        <Cartao titulo="Últimas entregas do Cortex" resumo="Conferindo…" icone={<Icone nome="cortex" />}>
          {!x.ultimas.length && <p className="text-sm text-nexia-muted">Nenhuma entrega nos últimos 7 dias.</p>}
          <ul className="space-y-2">
            {x.ultimas.map((t) => (
              <li key={t.numero}>
                <a href={t.link} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-nexia-surface2 p-3 text-sm">
                  <span className="text-nexia-muted">#{t.numero}</span> {t.titulo}
                  <span className="block text-xs text-nexia-muted mt-1">{haQuanto(t.quando)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
