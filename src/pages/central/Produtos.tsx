import { useState } from "react";
import type { Dados } from "./api";
import { useCentral } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";

export default function Produtos({ d }: { d: Dados }) {
  const { entrarSuporte } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  if (!d.lista) return <Carregando />;

  const entrar = async (site: string) => {
    const aba = window.open("about:blank", "_blank"); // o celular bloqueia abas abertas depois de esperar a rede
    setMsg(null);
    try { const url = await entrarSuporte(site); if (aba) aba.location.href = url; else window.location.href = url; }
    catch (e) { aba?.close(); setMsg((e as Error).message); }
  };
  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setMsg("Link copiado. É só colar no WhatsApp."); } catch { setMsg(url); }
  };

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
      {d.lista.produtos.map((p) => {
        const m = d.saude?.produtos.find((x) => x.id === p.id);
        const cor = !m ? "cinza" : !m.ok ? "vermelho" : m.lento ? "amarelo" : "verde";
        const estado = !m ? "conferindo…" : !m.ok ? "fora do ar" : m.lento ? `lento (${(m.tempo / 1000).toFixed(1)} s)` : `no ar (${(m.tempo / 1000).toFixed(1)} s)`;
        return (
          <Cartao key={p.id}>
            <div className="flex items-start gap-3" data-testid={`produto-${p.id}`}>
              <div className="text-3xl leading-none">{p.icone}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{p.nome}</div>
                <div className="text-xs text-nexia-muted">{p.frase}</div>
                <div className="flex items-center gap-2 text-xs mt-1"><Sinal cor={cor} />{estado}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Botao href={p.site}>🌐 Abrir site</Botao>
              <Botao href={p.painel}>⚙️ Abrir painel</Botao>
              {p.suporte && <Botao onClick={() => entrar(p.suporte!)} testid={`suporte-${p.suporte}`}>🛟 Entrar como suporte</Botao>}
              <Botao onClick={() => copiar(p.site)}>📋 Copiar link</Botao>
            </div>
          </Cartao>
        );
      })}
    </div>
  );
}
