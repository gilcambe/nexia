import type { Dados } from "./api";
import { reais, haQuanto } from "./api";
import type { Aviso, Aba } from "./avisos";
import { useState } from "react";
import { Cartao, Sinal, Numero, Botao, Carregando } from "./ui";

function BotaoAvisar() {
  const suporta = typeof Notification !== "undefined";
  const [estado, setEstado] = useState(suporta ? Notification.permission : "denied");
  if (!suporta || estado === "granted") return null;
  if (estado === "denied") return <p className="text-xs text-nexia-muted">Os avisos no aparelho estão bloqueados no navegador.</p>;
  return <Botao onClick={async () => setEstado(await Notification.requestPermission())}>🔔 Avisar no celular quando algo parar</Botao>;
}

export default function Inicio({ d, avisos, ir, conferir, carregando }: { d: Dados; avisos: Aviso[]; ir: (a: Aba) => void; conferir: () => void; carregando: boolean }) {
  const pronto = !!(d.saude && d.robos && d.cortex);
  const tudoOk = pronto && avisos.length === 0;
  return (
    <div className="space-y-4 flex flex-col">
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
  );
}
