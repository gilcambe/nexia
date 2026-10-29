import { useState } from "react";
import type { Dados, Fornecedor, Parte, Situacao, TesteIA } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";
import type { Cor } from "./ui";
import Mais from "./Mais";
import SaudeHistorico from "./SaudeHistorico";\n
import ConectarIAs from "./ConectarIAs";
import UltimosErros from "./UltimosErros";
import { Abre, useModo } from "./celular";
import { buscarContextoIA, sanitizarTexto } from "@/lib/fetch-contexto-ia";

// Aba Sistema: a saúde dos sites em 30 dias, as IAs que trabalham para a NEXIA, os fornecedores (serviços grátis que usamos) e os robôs.
const COR: Record<Situacao, Cor> = { ok: "verde", erro: "vermelho", desligado: "cinza" };
const FRASE: Record<Situacao, string> = { ok: "ligado", erro: "deu erro", desligado: "falta ligar" };
const NOME_IA: Record<string, string> = { groq: "Groq", github: "GitHub Models", google: "Google Gemini", codestral: "Codestral", nvidia: "NVIDIA", cloudflare: "Cloudflare Workers AI", mistral: "Mistral", openrouter: "OpenRouter", kilo: "Kilo" };

// Contexto para outras IAs: o arquivo docs/CONTEXTO-IA.md do próprio repositório (nunca tem chave, mas limpamos mesmo assim).
const URLS_CONTEXTO = [
  "https://raw.githubusercontent.com/gilcambe/nexia/develop/docs/CONTEXTO-IA.md",
  "https://raw.githubusercontent.com/gilcambe/nexia/main/docs/CONTEXTO-IA.md",
];

// Remove chaves e segredos do texto. Pode ser usado como extra sanitização.
export function limparChaves(texto: string): string {
  if (!texto) return "";
  
  // Padrões de chaves e segredos sensíveis (apenas os 4 do pedido)
  const PADROES = [
    /sk-[A-Za-z0-9]+/g,
    /AIza[A-Za-z0-9_-]+/g,
    /ghp_[A-Za-z0-9]+/g,
    /-----BEGIN[^\n]+/g
  ];
  
  let textoLimpo = texto;
  
  // Aplica cada regex substituindo por '[oculto]'
  PADROES.forEach((regex) => {
    textoLimpo = textoLimpo.replace(regex, "[oculto]");
  });
  
  return textoLimpo;
}

// Estilo dos links (mesmo visual do botão) para abrir outra IA em outra aba.
const LINK = "inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm min-h-[40px] border border-nexia-border bg-nexia-surface2 text-white hover:opacity-90 transition-opacity";

// Verifica se sobrou algum padrão de chave no texto (após sanitização).
// Focado apenas nos padrões críticos mencionados no pedido original
const TEM_CHAVE = /sk-[A-Za-z0-9]+|AIza[A-Za-z0-9_-]+|ghp_[A-Za-z0-9]+|-----BEGIN[^\n]+/;

// "Chaves e IAs" (#1872): estado de cada chave sem nunca mostrar o valor, juntando o "Testar agora" das IAs.
const simples = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
function estadoChave(f: Fornecedor, ias: TesteIA[] | null): { cor: Cor; texto: string; fazer?: string } {
  if (f.chaveEstado === "falta") return { cor: "amarelo", texto: "Falta", fazer: `Cadastrar no Cloudflare (Workers → nexia → Settings → Variables) com o nome ${f.chave}.` };
  const t = ias?.find((i) => simples(i.provedor) === simples(f.id) || simples(f.nome).startsWith(simples(i.provedor)));
  if (t?.situacao === "ok") return { cor: "verde", texto: "Funcionando ✓" };
  if (t?.situacao === "erro") {
    const m = t.motivo || "";
    if (/\b429\b|quota|cota|rate/i.test(m)) return { cor: "amarelo", texto: "Cota do dia acabou", fazer: "Volta sozinha amanhã. O Cortex usa outra IA grátis enquanto isso." };
    if (/\b40[13]\b|invalid|unauthor|forbidden/i.test(m)) return { cor: "vermelho", texto: "Chave recusada", fazer: "Criar uma chave nova no site do serviço e trocar no Cloudflare." };
    return { cor: "vermelho", texto: "Com erro", fazer: m.slice(0, 80) };
  }
  return { cor: "cinza", texto: "Existe, não testada" };
}

export default function Sistema({ d, erros }: { d: Dados; erros: Partial<Record<Parte, string>> }) {
  const { agir } = useCentral();
  const { compacto } = useModo();
  const [ias, setIas] = useState<TesteIA[] | null>(null);
  const [testando, setTestando] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [contextoIA, setContextoIA] = useState("");
  const [carregandoIA, setCarregandoIA] = useState(false);

  // Busca o contexto, sanitiza, adiciona info da fila e copia para clipboard.
  const copiarContexto = async () => {
    setCarregandoIA(true);
    try {
      // Lê o arquivo docs/CONTEXTO-IA.md do próprio repositório (URL definida no projeto, com fallback para os ramos conhecidos).
      const contextoBruto = await buscarContextoComFallback();
      // Aplica sanitização dupla: primeiro a função do fetch-contexto-ia.ts, depois nossa limpeza extra
      const contextoSanitizado = sanitizarTexto(contextoBruto);
      const contextoLimpo = limparChaves(contextoSanitizado);
      
      const fila = d.cortex?.naFila ?? 0;
      const rodando = d.cortex?.fazendo?.length ?? 0;
      const travadas = d.cortex?.travadas?.length ?? 0;
      const final = `${contextoLimpo}\n\nConexão: Filas: ${fila} | Rodando: ${rodando} | Travadas: ${travadas}`;
      
      // Implementa cópia para clipboard com fallback
      try {
        await navigator.clipboard.writeText(final);
      } catch {
        // Fallback para navegadores antigos
        const textarea = document.createElement('textarea');
        textarea.value = final;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textarea);
        }
      }
      
      // Segurança: o alerta de sucesso só sai quando o texto tem o contexto do Cortex e nenhuma chave sobrou.
      const temCortex = final.includes("Cortex");
      const temChaves = TEM_CHAVE.test(final);

      if (temCortex && !temChaves) {
        // Só marca o contexto como pronto quando o texto passou na checagem de segurança.
        setContextoIA(final);
        window.alert("Contexto copiado. Cole na conversa da outra IA.");
      } else {
        window.alert("Não copiei por segurança: o texto não tem o contexto do Cortex ou ainda esconde alguma chave.");
        console.warn("Falha na checagem de segurança:", {
          temCortex,
          temChaves,
          tamanhoFinal: final.length
        });
      }
    } catch (e) {
      window.alert(`Não consegui copiar o contexto: ${(e as Error).message}`);
    } finally {
      setCarregandoIA(false);
    }
  };
  // Lê o arquivo de contexto do repositório. Usa o serviço da Central e, se ele falhar,
  // tenta as URLs conhecidas do próprio projeto (ramo develop e ramo main).
  const buscarContextoComFallback = async (): Promise<string> => {
    try {
      return await buscarContextoIA();
    } catch {
      for (const url of URLS_CONTEXTO) {
        try {
          const resposta = await fetch(url);
          if (resposta.ok) return await resposta.text();
        } catch {
          // tenta a próxima URL
        }
      }
      throw new Error("Não consegui ler o arquivo de contexto do repositório.");
    }
  };

  const testar = async () => {
    setTestando(true); setErroIA(null);
    try { setIas((await agir<{ ias: TesteIA[] }>({ acao: "testar-ias" })).ias || []); } catch (e) { setErroIA((e as Error).message); }
    setTestando(false);
  };
  const grupos = [...new Set((d.empresa?.fornecedores || []).map((f) => f.grupo))];
  const ligadas = ias?.filter((i) => i.situacao === "ok").length || 0;

  return (
    <div className="space-y-4">
      {compacto ? (
        <Abre id="conectar-ias" titulo="Conectar IAs" icone="chave" solto
          resumo={d.vagas ? `${d.vagas.vagas.filter((v) => v.ligada).length} de ${d.vagas.vagas.length} vagas conectadas` : "Conferindo…"}>
          <ConectarIAs inicial={d.vagas} />
        </Abre>
      ) : <ConectarIAs inicial={d.vagas} />}
      <SaudeHistorico />
      <UltimosErros />

      <Cartao titulo="Chaves e IAs" acao={<Botao onClick={testar} disabled={testando} testid="testar-chaves">{testando ? "Testando…" : "🧪 Testar todas agora"}</Botao>}>
        {!d.empresa ? <Carregando /> : (
          <ul className="space-y-2" data-testid="chaves">
            {d.empresa.fornecedores.filter((f) => f.chaveEstado).map((f) => {
              const e = estadoChave(f, ias);
              return (
                <li key={f.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Sinal cor={e.cor} />
                    <a href={f.link} target="_blank" rel="noopener noreferrer" className="font-semibold flex-1 truncate">{f.nome}</a>
                    <span className="text-xs">{e.texto}</span>
                  </div>
                  <div className="text-xs text-nexia-muted mt-1">{f.paraQue} · chave {f.chave}{ias ? " · testado agora" : ""}</div>
                  {e.fazer && <div className="text-xs mt-1">O que fazer: {e.fazer}</div>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-nexia-muted">Escada: o Cortex usa primeiro as IAs grátis que estão verdes; a ordem fica no roteador de modelos. O valor das chaves nunca aparece aqui.</p>
      </Cartao>

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

      <Cartao titulo="Usar outra IA">
        <div className="space-y-3">
          <p className="text-sm text-nexia-muted">Cole na conversa e a IA já sabe tudo.</p>
          <Botao onClick={copiarContexto} disabled={carregandoIA} testid="btn-copiar-contexto">
            {carregandoIA ? "Copiando…" : "📋 Copiar contexto"}
          </Botao>
          <div className="flex flex-wrap gap-2">
            <a className={LINK} href="https://gemini.google.com" target="_blank" rel="noopener noreferrer">Abrir Gemini</a>
            <a className={LINK} href="https://chat.openai.com" target="_blank" rel="noopener noreferrer">Abrir ChatGPT</a>
            <a className={LINK} href="https://claude.ai" target="_blank" rel="noopener noreferrer">Abrir Claude</a>
          </div>
          {contextoIA && (
            <p className="text-xs text-nexia-muted" role="status" aria-live="polite">Contexto pronto: {contextoIA.length} caracteres. Agora é só colar na conversa.</p>
          )}
        </div>
      </Cartao>

      <Mais d={d} erro={erros.robos} />
    </div>
  );
}
