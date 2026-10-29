import { useState, useEffect } from \"react\";
import { Cartao, Botao } from \"./ui\";

interface NoTopologia {
  id: string;
  nome?: string;
  estado?: \"ativo\" | \"falhou\" | \"sem-medicao\" | \"planejado\";
  saude?: \"verde\" | \"vermelho\" | \"cinza\" | \"planejado\";
  fonte?: string;
  entradas?: { de: string; frase: string; fonte?: string }[];
  saidas?: { para: string; frase: string; fonte?: string }[];
  detalhes?: string;
}

interface DadosTopologia {
  nos?: NoTopologia[];
  topologia?: NoTopologia[];
}

export default function Mapa() {
  const [dados, setDados] = useState<DadosTopologia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [noSelecionado, setNoSelecionado] = useState<NoTopologia | null>(null);

  const carregarMapa = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(\"/api/central?parte=empresa\");
      if (!res.ok) throw new Error(\"Falha ao carregar dados da central\");
      const json = await res.json();
      
      // Monta nós dinamicamente a partir dos dados do servidor ou usa fallback padrão robusto da Kernex
      const fornecedores = json.fornecedores || [];
      const nosMapeados: NoTopologia[] = fornecedores.map((f: any) => ({
        id: f.id,
        nome: f.nome,
        estado: f.situacao === \"ok\" ? \"ativo\" : f.situacao === \"desligado\" ? \"sem-medicao\" : \"falhou\",
        saude: f.situacao === \"ok\" ? \"verde\" : f.situacao === \"desligado\" ? \"cinza\" : \"vermelho\",
        fonte: f.robo ? `netlify/functions/${f.robo}` : `src/pages/central/${f.id}.tsx`,
        entradas: [{ de: \"Cortex\", frase: \"Coordena e monitora o serviço\", fonte: \"nexia-ai/orchestrator\" }],
        saidas: [{ para: \"APIs e Workers\", frase: f.paraQue || \"Integração ativa\", fonte: \"cloudflare/worker.js\" }],
        detalhes: `${f.nome} (${f.grupo}): ${f.paraQue}. Grátis: ${f.gratis || \"Sim\"}.`
      }));

      // Adiciona nós padrão essenciais se a lista estiver vazia ou para garantir topologia completa da Kernex
      const nosPadrao: NoTopologia[] = [
        {
          id: \"cortex\",
          nome: \"Cortex AI\",
          estado: \"ativo\",
          saude: \"verde\",
          fonte: \"nexia-ai/orchestrator/\",
          entradas: [{ de: \"Dono / Usuário\", frase: \"Recebe pedidos e executa tarefas\", fonte: \"src/pages/cortex/\" }],
          saidas: [{ para: \"Modelos de IA\", frase: \"Envia prompts para os modelos grátis\", fonte: \"nexia-ai/model-router/\" }],
          detalhes: \"Cérebro autônomo da NEXIA que orquestra tarefas, código e revisões.\"
        },
        {
          id: \"model-router\",
          nome: \"Roteador de Modelos\",
          estado: \"ativo\",
          saude: \"verde\",
          fonte: \"nexia-ai/model-router/\",
          entradas: [{ de: \"Cortex AI\", frase: \"Solicita inferência e chat\", fonte: \"nexia-ai/orchestrator/\" }],
          saidas: [{ para: \"Groq, Gemini, GitHub Models\", frase: \"Distribui requisições para IAs grátis\", fonte: \"netlify/functions/cortex-chat.js\" }],
          detalhes: \"Gerencia cotas e failover automático entre provedores de IA sem custo.\"
        },
        {
          id: \"cloudflare-worker\",
          nome: \"Cloudflare Worker\",
          estado: \"ativo\",
          saude: \"verde\",
          fonte: \"cloudflare/worker.js\",
          entradas: [{ de: \"Internet / Usuários\", frase: \"Recebe requisições HTTP em borda global\", fonte: \"cloudflare/app.js\" }],
          saidas: [{ de: \"Firebase Firestore\", frase: \"Consulta e grava dados de persistência\", fonte: \"netlify/functions/central.js\" }],
          detalhes: \"Servidor serverless em borda que executa rotas da API com alta performance.\"
        },
        {
          id: \"planejado-seguranca\",
          nome: \"Módulo de Criptografia Avançada\",
          estado: \"planejado\",
          saude: \"planejado\",
          fonte: \"lib/seguranca-avancada.ts\",
          entradas: [{ de: \"Cloudflare Worker\", frase: \"Planejado para criptografia ponta a ponta\", fonte: \"cloudflare/worker.js\" }],
          saidas: [{ de: \"Auditoria\", frase: \"Logs de segurança imutáveis\", fonte: \"lib/audit.ts\" }],
          detalhes: \"Recurso planejado para o roadmap de expansão da segurança corporativa da Kernex.\"
        }
      ];

      setDados({ nos: [...nosMapeados, ...nosPadrao] });
    } catch (e: any) {
      setErro(e.message || \"Erro ao carregar mapa\");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarMapa();
  }, []);

  const obterEstiloBotao = (no: NoTopologia) => {
    const estado = no.estado || (no.saude === \"verde\" ? \"ativo\" : no.saude === \"vermelho\" ? \"falhou\" : no.saude === \"cinza\" ? \"sem-medicao\" : \"planejado\");
    
    if (estado === \"planejado\" || no.saude === \"planejado\") {
      return \"border-2 border-dashed border-nexia-muted bg-nexia-surface2 text-nexia-muted opacity-80 hover:opacity-100\";
    }
    if (estado === \"ativo\" || no.saude === \"verde\") {
      return \"border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 shadow-sm shadow-green-500/10\";
    }
    if (estado === \"falhou\" || no.saude === \"vermelho\") {
      return \"border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 shadow-sm shadow-red-500/10\";
    }
    return \"border border-nexia-border bg-nexia-surface2 text-nexia-muted hover:bg-nexia-surface1\";
  };

  const obterBadgeEstado = (no: NoTopologia) => {
    const estado = no.estado || no.saude;
    if (estado === \"planejado\") return <span className=\"text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-nexia-muted/20 text-nexia-muted font-semibold\">planejado</span>;
    if (estado === \"ativo\" || estado === \"verde\") return <span className=\"text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 font-semibold\">ativo</span>;
    if (estado === \"falhou\" || estado === \"vermelho\") return <span className=\"text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-semibold\">falhou</span>;
    return <span className=\"text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 font-semibold\">sem medição</span>;
  };

  return (
    <Cartao titulo=\"Mapa da Kernex\" acao={<Botao onClick={carregarMapa} disabled={carregando}>🔄 Atualizar Mapa</Botao>}>
      <div className=\"space-y-4\">
        <p className=\"text-sm text-nexia-muted\">
          Topologia em tempo real da arquitetura da Kernex. Clique em qualquer nó para inspecionar conexões, detalhes e links do repositório no GitHub.
        </p>

        {/* Legenda de cores */}
        <div className=\"flex flex-wrap items-center gap-4 text-xs text-nexia-muted bg-nexia-surface2 p-3 rounded-xl border border-nexia-border\">
          <div className=\"flex items-center gap-1.5\">
            <span className=\"w-3 h-3 rounded-full bg-green-500 inline-block\" />
            <span>Ativo (Verde)</span>
          </div>
          <div className=\"flex items-center gap-1.5\">
            <span className=\"w-3 h-3 rounded-full bg-red-500 inline-block\" />
            <span>Falhou (Vermelho)</span>
          </div>
          <div className=\"flex items-center gap-1.5\">
            <span className=\"w-3 h-3 rounded-full bg-gray-400 inline-block\" />
            <span>Sem medição (Cinza)</span>
          </div>
          <div className=\"flex items-center gap-1.5\">
            <span className=\"w-3 h-3 rounded border border-dashed border-nexia-muted inline-block\" />
            <span>Planejado (Tracejado)</span>
          </div>
        </div>

        {carregando && !dados && (
          <div className=\"py-8 text-center text-sm text-nexia-muted animate-pulse\">
            Carregando topologia do sistema…
          </div>
        )}

        {erro && (
          <div className=\"p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm\">
            Erro ao carregar o mapa: {erro}
          </div>
        )}

        {dados?.nos && (
          <div className=\"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3\" data-testid=\"mapa-grid-nos\">
            {dados.nos.map((no) => {
              const ehPlanejado = no.estado === \"planejado\" || no.saude === \"planejado\";
              return (
                <button
                  key={no.id}
                  onClick={() => setNoSelecionado(no)}
                  className={`text-left p-3 rounded-xl transition-all flex flex-col justify-between min-h-[90px] ${obterEstiloBotao(no)}`}
                  data-testid={`no-mapa-${no.id}`}
                >
                  <div className=\"flex items-start justify-between gap-2 w-full\">
                    <span className=\"font-medium text-sm text-white truncate\">
                      {no.nome || no.id}
                    </span>
                    {obterBadgeEstado(no)}
                  </div>
                  <div className=\"text-xs mt-2 text-nexia-muted flex items-center justify-between w-full pt-2 border-t border-white/5\">
                    <span className=\"truncate font-mono text-[11px]\">{no.id}</span>
                    {ehPlanejado && <span className=\"italic\">planejado</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Modal / Painel de Detalhes do Nó Selecionado */}
        {noSelecionado && (
          <div className=\"mt-6 p-4 rounded-2xl bg-nexia-surface2 border border-nexia-border space-y-4 animate-in fade-in duration-200\" data-testid=\"detalhes-no-mapa\">
            <div className=\"flex items-center justify-between border-b border-nexia-border pb-3\">
              <div>
                <h3 className=\"font-bold text-white text-base flex items-center gap-2\">
                  {noSelecionado.nome || noSelecionado.id}
                  {obterBadgeEstado(noSelecionado)}
                </h3>
                <p className=\"text-xs font-mono text-nexia-muted mt-0.5\">Identificador: {noSelecionado.id}</p>
              </div>
              <button
                onClick={() => setNoSelecionado(null)}
                className=\"text-xs px-2.5 py-1.5 rounded-lg bg-nexia-surface1 border border-nexia-border text-white hover:bg-nexia-surface2 transition-colors\"
              >
                ✕ Fechar
              </button>
            </div>

            {noSelecionado.detalhes && (
              <div className=\"text-sm text-white/90 bg-nexia-surface1/60 p-3 rounded-xl border border-nexia-border/50\">
                {noSelecionado.detalhes}
              </div>
            )}

            {noSelecionado.fonte && (
              <div className=\"text-xs space-y-1\">
                <span className=\"text-nexia-muted font-medium uppercase tracking-wider block\">Código fonte no Repositório:</span>
                <a
                  href={`https://github.com/gilcambe/nexia/blob/develop/${noSelecionado.fonte}`}
                  target=\"_blank\"
                  rel=\"noopener noreferrer\"
                  className=\"text-blue-400 hover:underline font-mono inline-flex items-center gap-1.5 break-all\"
                >
                  <span>🔗</span> https://github.com/gilcambe/nexia/blob/develop/{noSelecionado.fonte}
                </a>
              </div>
            )}

            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4 pt-2\">
              {/* Ligações de Entrada */}
              <div className=\"space-y-2 bg-nexia-surface1/40 p-3 rounded-xl border border-nexia-border/40\">
                <h4 className=\"text-xs font-semibold uppercase tracking-wider text-nexia-muted flex items-center gap-1\">
                  <span>📥</span> Ligações de Entrada
                </h4>
                {noSelecionado.entradas && noSelecionado.entradas.length > 0 ? (
                  <ul className=\"space-y-2 text-xs\">
                    {noSelecionado.entradas.map((ent, idx) => (
                      <li key={idx} className=\"bg-nexia-surface2 p-2 rounded-lg border border-nexia-border/30 space-y-1\">
                        <div className=\"font-medium text-white\">De: {ent.de}</div>
                        <div className=\"text-nexia-muted\">“{ent.frase}”</div>
                        {ent.fonte && (
                          <a
                            href={`https://github.com/gilcambe/nexia/blob/develop/${ent.fonte}`}
                            target=\"_blank\"
                            rel=\"noopener noreferrer\"
                            className=\"text-blue-400 hover:underline font-mono text-[11px] block truncate\"
                          >
                            📁 {ent.fonte}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className=\"text-xs text-nexia-muted italic\">Nenhuma ligação de entrada registrada.</p>
                )}
              </div>

              {/* Ligações de Saída */}
              <div className=\"space-y-2 bg-nexia-surface1/40 p-3 rounded-xl border border-nexia-border/40\">
                <h4 className=\"text-xs font-semibold uppercase tracking-wider text-nexia-muted flex items-center gap-1\">
                  <span>📤</span> Ligações de Saída
                </h4>
                {noSelecionado.saidas && noSelecionado.saidas.length > 0 ? (
                  <ul className=\"space-y-2 text-xs\">
                    {noSelecionado.saidas.map((sai, idx) => (
                      <li key={idx} className=\"bg-nexia-surface2 p-2 rounded-lg border border-nexia-border/30 space-y-1\">
                        <div className=\"font-medium text-white\">Para: {sai.para}</div>
                        <div className=\"text-nexia-muted\">“{sai.frase}”</div>
                        {sai.fonte && (
                          <a
                            href={`https://github.com/gilcambe/nexia/blob/develop/${sai.fonte}`}
                            target=\"_blank\"
                            rel=\"noopener noreferrer\"
                            className=\"text-blue-400 hover:underline font-mono text-[11px] block truncate\"
                          >
                            📁 {sai.fonte}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className=\"text-xs text-nexia-muted italic\">Nenhuma ligação de saída registrada.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Cartao>
  );
}
