import { useState } from "react";
import type { Dados, Parte, Personal } from "./api";
import { haQuanto, reais, useCentral } from "./api";
import { Cartao, Sinal, Numero, Botao, Carregando } from "./ui";
import type { Cor } from "./ui";
import Produtos from "./Produtos";

// Aba Clientes: quem já compra (empresas e personais), quem está interessado (contatos) e os produtos no ar.
const PERSONAL: Record<Personal["situacao"], { cor: Cor; frase: string }> = {
  pagando: { cor: "verde", frase: "pagando" }, isento: { cor: "verde", frase: "liberado sem pagar" },
  teste: { cor: "amarelo", frase: "no teste grátis" }, vencido: { cor: "vermelho", frase: "venceu" },
};
const ANDAMENTO: Record<string, string> = { novo: "Novos", conversando: "Conversando", testando: "Testando", cliente: "Viraram cliente", perdido: "Não quiseram" };
const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 4);
const zap = (n: string) => `https://wa.me/${n.length <= 11 ? "55" + n : n}`;

export default function Clientes({ d, erros }: { d: Dados; erros: Partial<Record<Parte, string>> }) {
  const [verTodos, setVerTodos] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const { agir } = useCentral();
  const pessoas = d.clientes?.personais || [];
  const pixs = d.clientes?.pixAguardando || [];
  const usoIa = d.clientes?.usoIa;

  const responderPix = async (id: string, acao: "confirmar_pix" | "recusar_pix") => {
    setProcessando(id);
    try {
      const res = await agir<{ ok: boolean; mensagem: string }>({ acao, id });
      alert(res.mensagem || "Pix atualizado com sucesso!");
      window.location.reload();
    } catch (e) {
      alert((e as Error).message || "Erro ao processar Pix");
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="space-y-4">
      {pixs.length > 0 && (
        <Cartao titulo="Pix aguardando confirmação">
          <div className="space-y-2" data-testid="pix-aguardando">
            <p className="text-xs text-nexia-muted mb-2">Confira o comprovante no banco e toque em confirmar para ativar o plano do cliente.</p>
            <ul className="space-y-2">
              {pixs.map((p) => (
                <li key={p.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex flex-col gap-2" data-testid="pix-item">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate">{p.email || p.nome || "Cliente Pix"}</span>
                    <span className="text-nexia-cyan font-bold">{reais(p.valor)}</span>
                  </div>
                  <div className="text-xs text-nexia-muted flex justify-between">
                    <span>Plano: {p.plano} ({p.dias} dias)</span>
                    <span>{haQuanto(new Date(p.em).toISOString())}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Botao tipo="forte" disabled={processando === p.id} onClick={() => responderPix(p.id, "confirmar_pix")}>
                      {processando === p.id ? "Aguarde..." : "✓ Confirmar"}
                    </Botao>
                    <Botao disabled={processando === p.id} onClick={() => responderPix(p.id, "recusar_pix")}>
                      ✕ Recusar
                    </Botao>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Cartao>
      )}

      {usoIa && (
        <Cartao titulo="Uso de IA do mês">
          <div className="space-y-3" data-testid="uso-ia">
            {usoIa.frear80 && (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold" role="alert" data-testid="alerta-cota-80">
                ⚠️ Alerta: O uso do plano grátis de IA ultrapassou 80% da cota diária!
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-nexia-muted uppercase tracking-wider">Por Provedor</h3>
              {usoIa.porProvedor.length === 0 ? (
                <p className="text-xs text-nexia-muted">Nenhum uso registrado neste mês.</p>
              ) : (
                <ul className="space-y-1">
                  {usoIa.porProvedor.map((prov) => (
                    <li key={prov.provedor} className="flex justify-between items-center text-xs rounded bg-nexia-surface2 p-2">
                      <span className="font-medium">{prov.provedor}</span>
                      <span className={prov.pct >= 80 ? "text-amber-400 font-bold" : "text-nexia-cyan"}>
                        {prov.usado.toLocaleString("pt-BR")} / {prov.limite.toLocaleString("pt-BR")} ({prov.pct}%)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {usoIa.porCliente.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-nexia-border">
                <h3 className="text-xs font-semibold text-nexia-muted uppercase tracking-wider">Por Cliente</h3>
                <ul className="space-y-1">
                  {usoIa.porCliente.map((cli) => (
                    <li key={cli.email} className="flex justify-between items-center text-xs rounded bg-nexia-surface2 p-2">
                      <span className="font-medium truncate max-w-[60%]">{cli.email}</span>
                      <span className="text-nexia-muted">{cli.requisicoes} reqs · {cli.tokens} tokens</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Cartao>
      )}
      <Cartao titulo="Contatos interessados" acao={<Botao href="/leads">Ver todos</Botao>}>
        {!d.leads ? <Carregando erro={erros.leads} /> : (
          <div className="space-y-3" data-testid="leads">
            <div className="grid grid-cols-3 gap-2">
              <Numero valor={d.leads.novos} rotulo="esperando resposta" destaque />
              <Numero valor={d.leads.semana} rotulo="nos últimos 7 dias" />
              <Numero valor={d.leads.porStatus.cliente || 0} rotulo="viraram cliente" />
            </div>
            {d.leads.total === 0 ? (
              <p className="text-sm text-nexia-muted">Ainda ninguém deixou contato. Os formulários dos sites mandam para cá sozinhos.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(ANDAMENTO).map(([k, nome]) => <span key={k} className="rounded-full bg-nexia-surface2 px-2 py-1">{nome}: {d.leads!.porStatus[k] || 0}</span>)}
                </div>
                <div className="text-xs text-nexia-muted">
                  Vieram mais de: {top(d.leads.porOrigem).map(([k, n]) => `${k} (${n})`).join(", ")}
                </div>
                <ul className="space-y-2">
                  {d.leads.ultimos.slice(0, 5).map((l) => (
                    <li key={l.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex items-center gap-3" data-testid="lead">
                      <Sinal cor={l.status === "novo" ? "amarelo" : l.status === "cliente" ? "verde" : "cinza"} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{l.nome}</div>
                        <div className="text-xs text-nexia-muted truncate">{l.produto} · {haQuanto(l.quando)}{l.origem && ` · ${l.origem}`}</div>
                        {l.indicadoPor && <div className="text-xs text-nexia-cyan truncate" data-testid="lead-indicado-por">Indicado por: {l.indicadoPor}</div>}
                      </div>
                      {l.whatsapp ? <Botao href={zap(l.whatsapp)}>💬 WhatsApp</Botao> : l.email ? <Botao href={`mailto:${l.email}`}>✉️ E-mail</Botao> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Cartao>

      <Cartao titulo="Empresas clientes">
        {!d.clientes ? <Carregando erro={erros.clientes} /> : (
          <ul className="space-y-2" data-testid="empresas">
            {d.clientes.empresas.map((e) => (
              <li key={e.site} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex items-center gap-3">
                <Sinal cor="verde" /><span className="flex-1">{e.nome}</span>
                <span className="text-xs text-nexia-muted">{e.leilao ? "leilões" : "agenda"}</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Personais no Body Coach">
        {!d.clientes ? <Carregando erro={erros.clientes} /> : pessoas.length === 0 ? (
          <p className="text-sm text-nexia-muted">Nenhum personal cadastrado ainda.</p>
        ) : (
          <div className="space-y-2" data-testid="personais">
            <div className="grid grid-cols-3 gap-2">
              <Numero valor={pessoas.length} rotulo="no total" />
              <Numero valor={pessoas.filter((p) => p.situacao === "pagando").length} rotulo="pagando" destaque />
              <Numero valor={pessoas.filter((p) => p.situacao === "teste").length} rotulo="testando" />
            </div>
            <ul className="space-y-2">
              {(verTodos ? pessoas : pessoas.slice(0, 5)).map((p) => (
                <li key={p.email} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex items-center gap-3">
                  <Sinal cor={PERSONAL[p.situacao].cor} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{p.email}</div>
                    {p.situacao === "teste" && p.diasRestantes !== undefined && (
                      <div className="text-[11px] text-amber-400" data-testid="vencimento-teste">
                        Teste grátis: vence em {p.diasRestantes} {p.diasRestantes === 1 ? "dia" : "dias"}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-nexia-muted">{PERSONAL[p.situacao].frase}{p.faixa ? ` · até ${p.faixa} alunos` : ""}</span>
                </li>
              ))}
            </ul>
            {pessoas.length > 5 && <Botao onClick={() => setVerTodos((v) => !v)}>{verTodos ? "Mostrar menos" : `Ver todos (${pessoas.length})`}</Botao>}
          </div>
        )}
      </Cartao>

      <h2 className="font-semibold text-base pt-2">Produtos e sites</h2>
      <Produtos d={d} />
    </div>
  );
}
