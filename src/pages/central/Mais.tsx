import { useState } from "react";
import type { Dados, Robo } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";
import type { Cor } from "./ui";

const COR: Record<Robo["situacao"], Cor> = { ok: "verde", erro: "vermelho", rodando: "amarelo", nunca: "cinza", "sem-acesso": "cinza" };
const FRASE: Record<Robo["situacao"], string> = { ok: "deu certo", erro: "deu erro", rodando: "rodando agora", nunca: "nunca rodou", "sem-acesso": "sem acesso" };

export default function Mais({ d, erro }: { d: Dados; erro?: string }) {
  const { agir } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  const rodar = async (arquivo: string) => {
    setMsg(null);
    try { setMsg((await agir({ acao: "rodar", arquivo })).mensagem); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <Cartao titulo="Robôs automáticos">
        {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
        {!d.robos ? <Carregando erro={erro} /> : (
          <ul className="space-y-2">
            {d.robos.robos.map((r) => (
              <li key={r.arquivo} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex items-center gap-3" data-testid="robo">
                <Sinal cor={COR[r.situacao]} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{r.nome}</div>
                  <div className="text-xs text-nexia-muted">{FRASE[r.situacao]} · {haQuanto(r.quando)}{r.link && <> · <a className="underline" href={r.link} target="_blank" rel="noopener noreferrer">ver</a></>}</div>
                </div>
                {r.podeRodar && <Botao onClick={() => rodar(r.arquivo)}>▶ Rodar</Botao>}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Uso do site hoje">
        {!d.cloudflare ? <Carregando /> : !d.cloudflare.configurado ? (
          <p className="text-sm text-nexia-muted">Ainda não ligado. Falta criar no Cloudflare um token só de leitura ("Analytics: Read") e guardar como CLOUDFLARE_ANALYTICS_TOKEN.</p>
        ) : d.cloudflare.erro ? <p className="text-sm text-nexia-muted">{d.cloudflare.erro}</p> : (
          <div className="space-y-1" data-testid="uso-cloudflare">
            <div className="text-sm">{(d.cloudflare.pedidos || 0).toLocaleString("pt-BR")} de {d.cloudflare.limite.toLocaleString("pt-BR")} pedidos grátis</div>
            <div className="h-3 rounded-full bg-nexia-surface2 overflow-hidden"><div className={`h-full ${(d.cloudflare.pedidos || 0) > d.cloudflare.limite * 0.8 ? "bg-amber-400" : "bg-nexia-cyan"}`} style={{ width: `${Math.min(100, ((d.cloudflare.pedidos || 0) / d.cloudflare.limite) * 100)}%` }} /></div>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Banco de dados">
        {!d.banco ? <Carregando /> : (
          <div className="flex items-center gap-3 text-sm">
            <Sinal cor={d.banco.ok ? "verde" : "vermelho"} />
            <span>{d.banco.ok ? `Respondendo (${d.banco.tempo} ms). Se o limite grátis do dia acabar, a reserva entra sozinha.` : d.banco.cheio ? "Chegou no limite grátis de hoje. A reserva grátis está sendo usada; volta ao normal amanhã." : "Não respondeu agora. Tente de novo em instantes."}</span>
          </div>
        )}
        <Botao href="https://console.firebase.google.com/project/_/usage">Ver consumo no Firebase</Botao>
      </Cartao>

      <Cartao titulo="Links grátis do dia a dia">
        {!d.lista ? <Carregando /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {d.lista.links.map((l) => <Botao key={l.url} href={l.url}>{l.nome}</Botao>)}
          </div>
        )}
      </Cartao>
    </div>
  );
}
