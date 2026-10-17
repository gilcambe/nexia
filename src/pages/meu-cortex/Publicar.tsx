import { useCallback, useEffect, useState } from "react";
import { Cartao, Botao } from "../central/ui";
import { haQuanto } from "../central/api";
import { usePedidos } from "./api";
import type { Deploy } from "./api";

// "O que ainda não está no ar" e o botão Publicar agora (o dono apertar é a autorização).
export default function Publicar() {
  const { deploy, agir } = usePedidos();
  const [d, setD] = useState<Deploy | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ver = useCallback(() => { deploy().then(setD).catch((e: Error) => setMsg(e.message)); }, [deploy]);
  useEffect(() => { ver(); }, [ver]);
  const publicar = async () => {
    setMsg(null);
    try { setMsg((await agir({ acao: "publicar" })).mensagem); setTimeout(ver, 4000); } catch (e) { setMsg((e as Error).message); }
  };
  if (!d) return msg ? <p className="text-sm text-red-400" role="alert">{msg}</p> : null;
  return (
    <Cartao titulo="Publicar no ar">
      <p className="text-sm" data-testid="publicar-situacao">
        {d.emAndamento ? "⏳ Publicando agora..." : d.falhou ? "🔴 A última publicação falhou." : d.mudancas ? `🟡 ${d.mudancas} mudança(s) ainda não estão no ar.` : "🟢 Tudo o que entrou já está no ar."}
        {d.ultimoDeploy && <span className="text-nexia-muted"> Último: {haQuanto(d.ultimoDeploy.quando)}.</span>}
      </p>
      {d.titulos.length > 0 && <ul className="text-xs text-nexia-muted list-disc pl-5">{d.titulos.map((t) => <li key={t}>{t}</li>)}</ul>}
      <Botao tipo="forte" disabled={d.emAndamento || (!d.mudancas && !d.falhou)} onClick={() => confirm("Publicar o app novo no ar agora?") && publicar()} testid="publicar-agora">🚀 Publicar agora</Botao>
      {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
    </Cartao>
  );
}
