import { useState } from "react";
import type { Dados, Parte, Situacao, TesteIA } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";
import type { Cor } from "./ui";
import Mais from "./Mais";
import SaudeHistorico from "./SaudeHistorico";

// Aba Sistema: a saúde dos sites em 30 dias, as IAs que trabalham para a NEXIA, os fornecedores (serviços grátis que usamos) e os robôs.
const COR: Record<Situacao, Cor> = { ok: "verde", erro: "vermelho", desligado: "cinza" };
const FRASE: Record<Situacao, string> = { ok: "ligado", erro: "deu erro", desligado: "falta ligar" };
const NOME_IA: Record<string, string> = { groq: "Groq", github: "GitHub Models", google: "Google Gemini", codestral: "Codestral", nvidia: "NVIDIA", cloudflare: "Cloudflare Workers AI", mistral: "Mistral", openrouter: "OpenRouter", kilo: "Kilo" };

export default function Sistema({ d, erros }: { d: Dados; erros: Partial<Record<Parte, string>> }) {
  const { agir } = useCentral();
  const [ias, setIas] = useState<TesteIA[] | null>(null);
  const [testando, setTestando] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const testar = async () => {
    setTestando(true); setErroIA(null);
    try { setIas((await agir<{ ias: TesteIA[] }>({ acao: "testar-ias" })).ias || []); } catch (e) { setErroIA((e as Error).message); }
    setTestando(false);
  };
  const grupos = [...new Set((d.empresa?.fornecedores || []).map((f) => f.grupo))];
  const ligadas = ias?.filter((i) => i.situacao === "ok").length || 0;

  return (
    <div className="space-y-4">
      <SaudeHistorico />

      <Cartao titulo="IAs que trabalham para a Kernex" acao={<Botao onClick={testar} disabled={testando} testid="testar-ias">{testando ? "Testando…" : "🧪 Testar agora"}</Botao>}>
        {erroIA && <p className="text-sm text-red-400" role="alert">{erroIA}</p>}
        {!ias ? (
          <p className="text-sm text-nexia-muted">O Cortex e o coach usam só IAs grátis. Se uma cair, a próxima entra sozinha. Toque em "Testar agora" para ver quais estão respondendo.</p>
        ) : (
          <div className="space-y-2" data-testid="ias">
            <p className="text-sm">{ligadas} de {ias.length} respondendo agora.</p>
            <ul className="space-y-2">
              {ias.map((i) => (
                <li key={i.provedor} className="rounded-xl bg-nexia-surface2 p-3 text-sm flex items-center gap-3" data-testid="ia">
                  <Sinal cor={COR[i.situacao]} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{NOME_IA[i.provedor] || i.provedor}</div>
                    <div className="text-xs text-nexia-muted truncate">
                      {i.situacao === "ok" ? `respondeu em ${((i.tempo || 0) / 1000).toFixed(1)} s` : i.situacao === "desligado" ? "sem chave guardada" : `não respondeu${i.motivo ? `: ${i.motivo}` : ""}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Fornecedores e integrações">
        {!d.empresa ? <Carregando erro={erros.empresa} /> : (
          <div className="space-y-3" data-testid="fornecedores">
            {grupos.map((g) => (
              <div key={g} className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-nexia-muted">{g}</h3>
                <ul className="space-y-2">
                  {d.empresa!.fornecedores.filter((f) => f.grupo === g).map((f) => (
                    <li key={f.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm" data-testid="fornecedor">
                      <a href={f.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                        <Sinal cor={COR[f.situacao]} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{f.nome} <span className="text-xs text-nexia-muted">· {FRASE[f.situacao]}{f.quando ? ` ${haQuanto(f.quando)}` : ""}</span></div>
                          <div className="text-xs text-nexia-muted">{f.paraQue} · grátis: {f.gratis}</div>
                        </div>
                        <span className="text-nexia-muted">›</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <Mais d={d} erro={erros.robos} />
    </div>
  );
}
