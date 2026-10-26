import type { Dados } from "./api";
import { reais, haQuanto } from "./api";
import type { Aviso, Aba } from "./avisos";
import { useState } from "react";
import { Cartao, Sinal, Numero, Botao, Carregando } from "./ui";
import type { Cor } from "./ui";
import type { ReactNode } from "react";

function BotaoAvisar() {
  const suporta = typeof Notification !== "undefined";
  const [estado, setEstado] = useState(suporta ? Notification.permission : "denied");
  if (!suporta || estado === "granted") return null;
  if (estado === "denied") return <p className="text-xs text-nexia-muted">Os avisos no aparelho estão bloqueados no navegador.</p>;
  return <Botao onClick={async () => setEstado(await Notification.requestPermission())}>🔔 Avisar no celular quando algo parar</Botao>;
}

// Atalhos dos módulos da Kernex (#1869). O Vault entra quando a lista de produtos (#1848) o tiver.
const MODULOS: { aba: Aba; nome: string; frase: string; icone: string; cor: string }[] = [
  { aba: "cortex", nome: "Cortex", frase: "Tarefas e IA", icone: "🧠", cor: "bg-violet-500/15 text-violet-500" },
  { aba: "clientes", nome: "Clientes", frase: "Produtos e tenants", icone: "👥", cor: "bg-sky-500/15 text-sky-500" },
  { aba: "sistema", nome: "IAs e chaves", frase: "Quais IAs estão ativas", icone: "✨", cor: "bg-indigo-500/15 text-indigo-500" },
  { aba: "sistema", nome: "Infraestrutura", frase: "GitHub, Firebase, Cloudflare", icone: "☁️", cor: "bg-orange-500/15 text-orange-500" },
  { aba: "dinheiro", nome: "Dinheiro", frase: "Assinaturas e Pix", icone: "💰", cor: "bg-emerald-500/15 text-emerald-500" },
];

const BARRA: Record<Cor, string> = { verde: "bg-emerald-400", amarelo: "bg-amber-400", vermelho: "bg-red-500", cinza: "bg-gray-500" };

// Cartão de número com barra opcional. Sem dado: "—" e "sem dado ainda", nunca número inventado.
function Indicador({ titulo, valor, linha, pct, conta, cor = "cinza", onClick }: {
  titulo: string; valor: ReactNode | null; linha?: string; pct?: number | null; conta?: string; cor?: Cor; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left rounded-2xl border border-nexia-border bg-nexia-surface p-4 cursor-pointer" data-testid="indicador">
      <div className="flex items-center gap-2 text-xs text-nexia-muted"><Sinal cor={valor === null ? "cinza" : cor} />{titulo}</div>
      <div className="text-2xl font-bold mt-2">{valor === null ? "—" : valor}</div>
      <div className="text-xs text-nexia-muted mt-1">{valor === null ? "sem dado ainda" : linha}</div>
      {valor !== null && pct != null && (
        <div className="mt-3 h-1.5 rounded-full bg-nexia-surface2 overflow-hidden" title={conta}>
          <div className={`h-full ${BARRA[cor]}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
    </button>
  );
}

export default function Inicio({ d, avisos, ir, conferir, carregando }: { d: Dados; avisos: Aviso[]; ir: (a: Aba) => void; conferir: () => void; carregando: boolean }) {
  const pronto = !!(d.saude && d.robos && d.cortex);
  const tudoOk = pronto && avisos.length === 0;
  const cx = d.cortex;
  const semana = cx ? cx.feitas7 + cx.naFila + cx.travadas.length + cx.fazendo.length : 0;
  const pctSemana = cx && semana ? Math.round((cx.feitas7 / semana) * 100) : null;
  const medidos = d.saude?.produtos || [];
  const noAr = medidos.filter((m) => m.ok).length;
  const forn = d.empresa?.fornecedores;
  const comErro = forn ? forn.filter((f) => f.situacao === "erro").length : 0;
  const vermelho = avisos.some((a) => a.cor === "vermelho");
  const nomeDe = (id: string) => d.lista?.produtos.find((p) => p.id === id)?.nome || id;
  return (
    <div className="space-y-4 flex flex-col">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Olá, Gil</h2>
          <p className="text-sm text-nexia-muted">Tudo da Kernex num lugar só.</p>
        </div>
        <div className="hidden lg:flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-sky-500/10 border border-nexia-border p-4 max-w-md">
          <img src="/central-icon.svg" alt="Kernex" className="w-10 h-10" />
          <p className="text-sm">Sua central de controle: produtos, clientes, Cortex, IAs e infraestrutura.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="modulos">
        {MODULOS.map((m) => (
          <button key={m.nome} onClick={() => ir(m.aba)} className="flex items-center gap-3 text-left rounded-2xl border border-nexia-border bg-nexia-surface p-3 cursor-pointer">
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${m.cor}`}>{m.icone}</span>
            <span className="min-w-0"><span className="block font-semibold text-sm">{m.nome}</span><span className="block text-xs text-nexia-muted truncate">{m.frase}</span></span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador titulo="Tarefas do Cortex" onClick={() => ir("cortex")}
          valor={cx ? cx.fazendo.length : null} linha={cx ? `em execução · ${cx.naFila} na fila · ${cx.travadas.length} travadas` : ""}
          pct={pctSemana} cor={cx && cx.travadas.length ? "amarelo" : "verde"}
          conta={cx ? `${pctSemana}% das tarefas da semana prontas: ${cx.feitas7} entregues ÷ (${cx.feitas7} entregues + ${cx.naFila} na fila + ${cx.fazendo.length} rodando + ${cx.travadas.length} travadas)` : ""} />
        <Indicador titulo="Clientes no ar" onClick={() => ir("clientes")}
          valor={medidos.length ? `${noAr}/${medidos.length}` : null} linha="sites abrindo agora"
          pct={medidos.length ? (noAr / medidos.length) * 100 : null} cor={noAr === medidos.length ? "verde" : "vermelho"}
          conta={`${noAr} de ${medidos.length} sites responderam no último teste`} />
        <Indicador titulo="Serviços com erro" onClick={() => ir("sistema")}
          valor={forn ? (comErro ? comErro : "nenhum") : null} linha={forn ? `de ${forn.length} serviços e integrações` : ""} cor={comErro ? "amarelo" : "verde"} />
        <Indicador titulo="Avisos" onClick={() => ir("inicio")}
          valor={pronto ? avisos.length : null} linha={avisos.length ? "precisam de você (lista abaixo)" : "nada pendente"}
          cor={vermelho ? "vermelho" : avisos.length ? "amarelo" : "verde"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 flex flex-col lg:col-span-2">
      <section className={`rounded-2xl p-5 border ${!pronto ? "border-nexia-border bg-nexia-surface" : tudoOk ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-400/40 bg-amber-400/10"}`} data-testid="central-sinal">
        <div className="text-2xl font-bold">
          {!pronto ? "Conferindo tudo…" : tudoOk ? "✅ Tudo funcionando" : `⚠️ ${avisos.length} coisa${avisos.length > 1 ? "s precisam" : " precisa"} de você`}
        </div>
        <div className="text-xs text-nexia-muted mt-1">Última conferência: {haQuanto(d.saude?.em)}</div>
      </section>

      {avisos.length > 0 && (
        <Cartao titulo="Precisa de você">
          <ul className="space-y-2">
            {avisos.map((a, k) => (
              <li key={k}>
                <button onClick={() => ir(a.aba)} className="w-full flex items-center gap-3 text-left text-sm rounded-xl bg-nexia-surface2 p-3 cursor-pointer" data-testid="central-aviso">
                  <Sinal cor={a.cor} /><span className="flex-1">{a.texto}</span><span className="text-nexia-muted">›</span>
                </button>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao titulo="Sua empresa hoje">
        {!d.clientes || !d.leads || !d.empresa ? <Carregando /> : (
          <div className="grid grid-cols-2 gap-2" data-testid="empresa-hoje">
            <button className="text-left cursor-pointer" onClick={() => ir("clientes")}><Numero valor={d.clientes.empresas.length + d.clientes.personais.filter((p) => p.situacao === "pagando").length} rotulo="clientes pagando" destaque /></button>
            <button className="text-left cursor-pointer" onClick={() => ir("clientes")}><Numero valor={d.leads.novos} rotulo="contatos esperando resposta" /></button>
            <button className="text-left cursor-pointer" onClick={() => ir("sistema")}><Numero valor={`${d.empresa.fornecedores.filter((f) => f.situacao === "ok").length}/${d.empresa.fornecedores.length}`} rotulo="serviços ligados" /></button>
            <button className="text-left cursor-pointer" onClick={() => ir("cortex")}><Numero valor={d.cortex ? d.cortex.fazendo.length + d.cortex.naFila : "…"} rotulo="tarefas com o Cortex" /></button>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Dinheiro do Body Coach">
        {!d.dinheiro ? <Carregando /> : (
          <div className="grid grid-cols-2 gap-2">
            <Numero valor={reais(d.dinheiro.receitaMes)} rotulo="entrou este mês" destaque />
            <Numero valor={d.dinheiro.pagantes} rotulo="pagando agora" />
            <Numero valor={d.dinheiro.emTeste} rotulo="no teste grátis" />
            <Numero valor={d.dinheiro.novosPorDia[d.dinheiro.novosPorDia.length - 1]?.n ?? 0} rotulo="cadastros hoje" />
          </div>
        )}
      </Cartao>

      <BotaoAvisar />
      <Botao onClick={conferir} disabled={carregando} tipo="forte" testid="central-conferir">{carregando ? "Conferindo…" : "🔄 Conferir de novo"}</Botao>
      </div>

      <div className="space-y-4 flex flex-col">
        <Cartao titulo="Estado dos serviços" acao={<button className="text-xs text-nexia-cyan cursor-pointer" onClick={() => ir("clientes")}>Ver tudo</button>}>
          {!d.saude ? <Carregando /> : !medidos.length ? <p className="text-sm text-nexia-muted">Sem medição ainda.</p> : (
            <ul className="space-y-2" data-testid="estado-servicos">
              {medidos.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{nomeDe(m.id)}</span>
                  <Sinal cor={!m.ok ? "vermelho" : m.lento ? "amarelo" : "verde"} />
                  <span className="text-xs text-nexia-muted w-16">{!m.ok ? "Fora do ar" : m.lento ? "Lento" : "No ar"}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
      </div>
    </div>
  );
}
