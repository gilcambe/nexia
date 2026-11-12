import { useState } from "react";
import type { Dados } from "./api";
import { reais } from "./api";
import { Cartao, Numero, Barras, Botao, Carregando } from "./ui";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function lerMeta() { try { return Number(localStorage.getItem("central-meta")) || 1000; } catch { return 1000; } }

function Meta({ valor }: { valor: number }) {
  const [meta, setMeta] = useState(lerMeta);
  const pct = Math.min(100, Math.round((valor / meta) * 100));
  const mudar = () => {
    const v = Number(String(window.prompt("Meta do mês em reais:", String(meta)) || "").replace(",", "."));
    if (v > 0) { setMeta(v); try { localStorage.setItem("central-meta", String(v)); } catch { /* sem storage */ } }
  };
  return (
    <div className="space-y-1" data-testid="meta-mes">
      <div className="flex justify-between items-center text-sm"><span>Meta do mês</span>
        <button onClick={mudar} className="text-xs text-nexia-cyan underline cursor-pointer">Mudar meta</button></div>
      <div className="h-3 rounded-full bg-nexia-surface2 overflow-hidden"><div className="h-full bg-nexia-cyan" style={{ width: `${pct}%` }} /></div>
      <div className="text-xs text-nexia-muted">{reais(valor)} de {reais(meta)} ({pct}%)</div>
    </div>
  );
}

export default function Dinheiro({ d, erro }: { d: Dados; erro?: string }) {
  const x = d.dinheiro;
  if (!x) return <Carregando erro={erro} />;
  const total6 = x.receitaPorMes.reduce((t, m) => t + m.valor, 0);
  return (
    <div className="space-y-4">
      <Cartao titulo="Body Coach" aberto>
        <div className="grid grid-cols-2 gap-2">
          <Numero valor={reais(x.receitaMes)} rotulo="entrou este mês" destaque />
          <Numero valor={reais(total6)} rotulo="nos últimos 6 meses" />
          <Numero valor={x.pagantes} rotulo="pagando agora" />
          <Numero valor={x.emTeste} rotulo="no teste grátis" />
          <Numero valor={x.vencendo7} rotulo="vencem em 7 dias" />
          <Numero valor={x.avisos7} rotulo="avisos de Pix (7 dias)" />
        </div>
        <Meta valor={x.receitaMes} />
        <Botao href="https://bodycoach.kernex.com.br/body-coach/admin/acessos" tipo="forte">Confirmar pagamentos e liberar acesso</Botao>
      </Cartao>

      <Cartao titulo="Quanto entrou por mês">
        <Barras itens={x.receitaPorMes.map((m) => ({ rotulo: MES[Number(m.mes.slice(5, 7)) - 1] || m.mes, valor: m.valor }))} formato={reais} />
      </Cartao>

      <Cartao titulo="Pessoas usando o app (30 dias)">
        <Barras itens={x.ativosPorDia.map((p) => ({ rotulo: p.dia.slice(8, 10), valor: p.n }))} />
      </Cartao>

      <Cartao titulo="Quem são as contas">
        <div className="grid grid-cols-3 gap-2">
          <Numero valor={x.porTipo.coach} rotulo="personais" />
          <Numero valor={x.porTipo.aluno} rotulo="alunos" />
          <Numero valor={x.porTipo.independente} rotulo="treinam sozinhos" />
        </div>
      </Cartao>

      <Cartao titulo="Comissões de afiliados">
        <p className="text-sm text-nexia-muted">O valor das comissões fica no site de cada loja.</p>
        <div className="grid grid-cols-2 gap-2">
          <Botao href="https://affiliate.shopee.com.br/">Shopee</Botao>
          <Botao href="https://associados.amazon.com.br/">Amazon</Botao>
        </div>
      </Cartao>
    </div>
  );
}
