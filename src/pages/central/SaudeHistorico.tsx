import { useEffect, useState } from "react";
import type { Historico, RotaSaude } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando, Barras } from "./ui";
import { IcSaude } from "./icones";
import type { Cor } from "./ui";

// Aba Sistema: saúde dos sites nos últimos 30 dias (o Worker guarda 1 amostra por hora de cada rota).
// Pedido só quando a aba abre (e no botão), para não ler 30 dias a cada 5 minutos.

const cor = (r: RotaSaude): Cor =>
  r.disponibilidade === null ? "cinza" : r.agora || r.disponibilidade < 95 ? "vermelho" : r.disponibilidade < 99.5 ? "amarelo" : "verde";
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);
const seg = (ms: number | null) => (ms === null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export default function SaudeHistorico() {
  const { buscar } = useCentral();
  const [h, setH] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [lendo, setLendo] = useState(false);
  const ler = async () => {
    setLendo(true); setErro(undefined);
    try { setH(await buscar("historico")); } catch (e) { setErro((e as Error).message); }
    setLendo(false);
  };
  useEffect(() => { ler(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Cartao titulo="Saúde dos sites (30 dias)" resumo="Conferindo…" icone={<IcSaude />} acao={<Botao onClick={ler} disabled={lendo} testid="ler-historico">{lendo ? "Lendo…" : "🔄 Atualizar"}</Botao>}>
      {!h ? <Carregando erro={erro} /> : !h.amostras ? (
        <p className="text-sm text-nexia-muted">Ainda sem medições guardadas. O Worker mede cada site uma vez por hora; a primeira aparece em até 1 hora.</p>
      ) : (
        <div className="space-y-3" data-testid="historico">
          <p className="text-xs text-nexia-muted">{h.amostras} medições (1 por hora); a primeira foi {haQuanto(h.desde)}. Queda = site sem resposta ou com erro do servidor.</p>
          {h.porDia.length > 1 && <Barras itens={h.porDia.map((d) => ({ rotulo: d.dia.slice(8, 10), valor: d.disponibilidade }))} formato={(v) => `${v}% no ar`} />}
          <ul className="space-y-2">
            {h.rotas.map((r) => (
              <li key={r.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex items-center gap-3" data-testid="rota-saude">
                <Sinal cor={cor(r)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{r.nome} <span className="text-xs text-nexia-muted">· {pct(r.disponibilidade)} no ar{r.agora ? " · fora do ar agora" : ""}</span></div>
                  <div className="text-xs text-nexia-muted">
                    {r.quedas} {r.quedas === 1 ? "queda" : "quedas"}{r.horasFora ? ` (${r.horasFora} h fora)` : ""} · tempo médio {seg(r.tempoMedio)} · {r.erros} {r.erros === 1 ? "erro" : "erros"}
                    {r.erros ? ` (${Object.entries(r.codigos).map(([c, n]) => `${c}: ${n}`).join(", ")})` : ""}
                    {r.ultimaQueda ? ` · última queda ${haQuanto(r.ultimaQueda)}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Cartao>
  );
}
