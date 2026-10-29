import { useEffect, useState } from "react";
import type { ErroRecente } from "./api";
import { useCentral } from "./api";
import { Cartao, Botao, Carregando } from "./ui";
import { IcErro } from "./icones";

// Aba Sistema (#815): últimos erros do servidor (5xx), cada um com o rid. O mesmo rid aparece no
// cabeçalho X-Request-Id da resposta e no log do Cloudflare: copie e procure lá para ver a causa.

const quando = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function UltimosErros() {
  const { buscar } = useCentral();
  const [lista, setLista] = useState<ErroRecente[] | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [lendo, setLendo] = useState(false);
  const ler = async () => {
    setLendo(true); setErro(undefined);
    try { setLista((await buscar("erros")).erros || []); } catch (e) { setErro((e as Error).message); }
    setLendo(false);
  };
  useEffect(() => { ler(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const copiar = (r: string) => { try { void navigator.clipboard.writeText(r); } catch { /* sem área de transferência */ } };

  return (
    <Cartao titulo="Últimos erros do servidor" resumo="Conferindo…" icone={<IcErro />} acao={<Botao onClick={ler} disabled={lendo} testid="ler-erros">{lendo ? "Lendo…" : "🔄 Atualizar"}</Botao>}>
      {!lista ? <Carregando erro={erro} /> : !lista.length ? (
        <p className="text-sm text-nexia-muted">Nenhum erro guardado. 🎉</p>
      ) : (
        <ul className="space-y-2" data-testid="ultimos-erros">
          {lista.map((x) => (
            <li key={`${x.em}-${x.rid}`} className="rounded-xl bg-nexia-surface2 p-3 text-sm">
              <div className="font-medium">{x.codigo} · {x.metodo} {x.rota}</div>
              <div className="text-xs text-nexia-muted">{quando(x.em)} · {x.msg}</div>
              <button type="button" className="mt-1 text-xs underline break-all text-left" onClick={() => copiar(x.rid)} title="Copiar rid">rid: {x.rid}</button>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
