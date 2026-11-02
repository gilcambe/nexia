import { useEffect, useState } from "react";
import { useCentral } from "./api";
import type { TokensDados } from "./api";
import { Cartao, Numero, Carregando } from "./ui";

// #2857: card "Tokens próprios". Quanto a Kernex respondeu sem gastar IA de fora e quanto cada IA gastou hoje.
const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function TokensProprios() {
  const { buscar } = useCentral();
  const [d, setD] = useState<TokensDados | null>(null);
  const [erro, setErro] = useState<string>();
  useEffect(() => { buscar("tokens").then(setD).catch((e) => setErro((e as Error).message)); }, [buscar]);
  return (
    <Cartao titulo="Tokens próprios" icone="ia">
      {!d ? <Carregando erro={erro} /> : !d.configurado ? (
        <p className="text-sm text-nexia-muted">O banco grátis (D1) não está ligado no servidor, então ainda não há números.</p>
      ) : (
        <div className="space-y-3" data-testid="tokens-proprios">
          <div className="grid grid-cols-3 gap-2">
            <Numero valor={fmt(d.cache.acertos)} rotulo="Respostas sem gastar IA" destaque={d.cache.acertos > 0} />
            <Numero valor={fmt(d.semantico.acertos)} rotulo="Mesma pergunta, outras palavras" />
            <Numero valor={fmt(d.cache.economiaTokens)} rotulo="Tokens economizados" />
          </div>
          <p className="text-xs text-nexia-muted">{fmt(d.cache.guardadas + d.semantico.guardadas)} respostas guardadas por 7 dias. Hoje: {fmt(d.totalHoje.pedidos)} pedidos e {fmt(d.totalHoje.tokens)} tokens nas IAs grátis.</p>
          {d.usoHoje.length > 0 && (
            <ul className="text-sm divide-y divide-slate-100">
              {d.usoHoje.map((u) => (
                <li key={u.provedor} className="flex justify-between py-1.5"><span>{u.provedor}</span><span className="text-nexia-muted">{fmt(u.pedidos)} pedidos · {fmt(u.tokens)} tokens{u.semCota ? ` · ${u.semCota} sem cota` : ""}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Cartao>
  );
}
