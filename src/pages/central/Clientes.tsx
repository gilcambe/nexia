import { useState } from "react";
import type { Dados, Parte, Personal } from "./api";
import { haQuanto } from "./api";
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
  const pessoas = d.clientes?.personais || [];
  return (
    <div className="space-y-4">
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
                  <span className="flex-1 min-w-0 truncate">{p.email}</span>
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
