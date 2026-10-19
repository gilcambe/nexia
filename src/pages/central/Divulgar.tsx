import { useState } from "react";
import type { Dados } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";

// Função para escapar HTML e prevenir XSS
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Função para validar e formatar dados do gráfico
const formatarDadosGrafico = (historico: any[]) => {
  if (!historico || !Array.isArray(historico) || historico.length === 0) return [];
  
  return historico.map(item => {
    if (!item || typeof item !== 'object') return null;
    
    return {
      data: escapeHtml(String(item.data || '')),
      seguidores: Number(item.seguidores) || 0,
      curtidas: Number(item.curtidas) || 0,
      comentarios: Number(item.comentarios) || 0,
      compartilhamentos: Number(item.compartilhamentos) || 0,
      alcance: Number(item.alcance) || 0
    };
  }).filter(Boolean);
};

const REDE: Record<string, string> = { facebook: "Facebook", instagram: "Instagram" };

// Função para formatar dados do gráfico
const formatarDadosGrafico = (historico: any[]) => {
  if (!historico || historico.length === 0) return [];
  
  return historico.map(item => ({
    data: item.data,
    seguidores: item.seguidores || 0,
    curtidas: item.curtidas || 0,
    comentarios: item.comentarios || 0,
    compartilhamentos: item.compartilhamentos || 0,
    alcance: item.alcance || 0
  }));
};

// Função para encontrar melhor horário com validação de dados
const obterMelhorHorario = (historico: any[]) => {
  if (!historico || !Array.isArray(historico) || historico.length === 0) return null;
  
  // Agrupa posts por hora
  const postsPorHora: Record<string, { count: number; engagement: number }> = {};
  
  historico.forEach(item => {
    if (!item || typeof item !== 'object') return;
    
    const hora = String(item.melhorHorario);
    if (hora && !isNaN(Number(hora))) {
      if (!postsPorHora[hora]) {
        postsPorHora[hora] = { count: 0, engagement: 0 };
      }
      postsPorHora[hora].count++;
      postsPorHora[hora].engagement += (Number(item.curtidas) || 0) + (Number(item.comentarios) || 0) + (Number(item.compartilhamentos) || 0);
    }
  });
  
  // Encontra hora com melhor engajamento médio
  let melhorHora: number | null = null;
  let melhorEngajamentoMedio = 0;
  
  Object.keys(postsPorHora).forEach(hora => {
    const { count, engagement } = postsPorHora[hora];
    if (count > 0) {
      const engajamentoMedio = engagement / count;
      if (engajamentoMedio > melhorEngajamentoMedio) {
        melhorEngajamentoMedio = engajamentoMedio;
        melhorHora = parseInt(hora);
      }
    }
  });
  
  return melhorHora;
};

export default function Divulgar({ d, erro }: { d: Dados; erro?: string }) {
  const { agir } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const rodar = async (corpo: Record<string, unknown>) => {
    setOcupado(true); setMsg(null);
    try { setMsg((await agir(corpo)).mensagem); } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  const x = d.divulga;
  const metaGraphData = d.metaGraphAPI;
  return (
    <div className="space-y-4">
      <Cartao titulo="Propaganda grátis">
        <p className="text-sm text-nexia-muted">O robô posta sozinho todo dia às 7h15, 12h15 e 19h15 no Facebook e no Instagram.</p>
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={() => rodar({ acao: "rodar", arquivo: "divulga.yml" })} disabled={ocupado} tipo="forte" testid="divulga-postar">📣 Postar agora</Botao>
          <Botao onClick={() => rodar({ acao: "rodar", arquivo: "divulga.yml", ensaio: true })} disabled={ocupado}>👀 Testar sem postar</Botao>
        </div>
        {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
      </Cartao>

      {!x ? <Carregando erro={erro} /> : (
        <>
          <Cartao titulo="Últimos posts">
            {x.historico.length === 0 && <p className="text-sm text-nexia-muted">Nenhum post ainda.</p>}
            <ul className="space-y-2">
              {x.historico.map((h, k) => (
                <li key={k} className="rounded-xl bg-nexia-surface2 p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2"><span className="font-medium">{h.cliente}</span><span className="text-xs text-nexia-muted">{haQuanto(h.quando)}</span></div>
                  {h.resultados.map((r) => (
                    <div key={r.canal} className="flex items-start gap-2 text-xs">
                      <Sinal cor={r.ok ? "verde" : "vermelho"} />
                      <span>{REDE[r.canal] || r.canal}: {r.ok ? "publicado" : `não saiu${r.erro ? ` (${r.erro})` : ""}`}</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </Cartao>
          <Cartao titulo={`Próximos posts (${x.naFila} na fila)`}>
            {x.proximos.length === 0 && <p className="text-sm text-nexia-muted">Fila vazia: o robô cria textos sozinho com a IA grátis.</p>}
            <ul className="space-y-2">
              {x.proximos.map((p) => <li key={p.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm whitespace-pre-line">{p.texto || p.id}</li>)}
            </ul>
          </Cartao>
        </>
      )}

      <Cartao titulo="De onde vêm as visitas">
        <p className="text-sm text-nexia-muted">Cada post leva um link marcado com a rede de onde a pessoa veio (Instagram ou Facebook). As visitas aparecem no Google Search Console.</p>
        <Botao href="https://search.google.com/search-console">Ver visitas no Google</Botao>
      </Cartao>

      <Cartao titulo="Robô de ofertas">
        <p className="text-sm text-nexia-muted">Busca ofertas fitness na Shopee e na Amazon e monta a vitrine.</p>
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={() => rodar({ acao: "rodar", arquivo: "afiliados.yml" })} disabled={ocupado}>🛍️ Buscar ofertas</Botao>
          <Botao href="https://achados-nexia.pages.dev/">Ver vitrine</Botao>
        </div>
      </Cartao>

      {/* Seção de Dados da Graph API */}
      <Cartao titulo="Dados da Meta (Graph API)">
        {x.metaGraphAPI ? (
          x.metaGraphAPI.temChave ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-nexia-surface2 rounded-lg p-3">
                  <p className="text-xs text-nexia-muted">Seguidores</p>
                  <p className="text-lg font-bold">{x.metaGraphAPI.seguidores?.toLocaleString()}</p>
                </div>
                <div className="bg-nexia-surface2 rounded-lg p-3">
                  <p className="text-xs text-nexia-muted">Curtidas (últimos posts)</p>
                  <p className="text-lg font-bold">{x.metaGraphAPI.curtidas?.toLocaleString()}</p>
                </div>
                <div className="bg-nexia-surface2 rounded-lg p-3">
                  <p className="text-xs text-nexia-muted">Alcance</p>
                  <p className="text-lg font-bold">{x.metaGraphAPI.alcance?.toLocaleString()}</p>
                </div>
                <div className="bg-nexia-surface2 rounded-lg p-3">
                  <p className="text-xs text-nexia-muted">Posts analisados</p>
                  <p className="text-lg font-bold">{x.metaGraphAPI.posts}</p>
                </div>
              </div>
              
              {typeof x.metaGraphAPI.melhorHorario === 'number' && (
                <div className="mb-4">
                  <p className="text-sm font-medium">Melhor horário para postar: <span className="text-nexia-cyan">{x.metaGraphAPI.melhorHorario}:00</span></p>
                  <p className="text-xs text-nexia-muted">Baseado no engajamento histórico</p>
                </div>
              )}
              
              {x.metaGraphAPI.historico && Array.isArray(x.metaGraphAPI.historico) && x.metaGraphAPI.historico.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Evolução dos últimos 30 dias</h4>
                  <div className="space-y-2">
                    {formatarDadosGrafico(x.metaGraphAPI.historico).slice(-7).map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span>{item.data}</span>
                        <div className="flex gap-2">
                          <span className="text-nexia-cyan">👤 {item.seguidores.toLocaleString()}</span>
                          <span>❤️ {item.curtidas.toLocaleString()}</span>
                          <span>👁️ {item.alcance.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
                        {x.metaGraphAPI.erro && (
            <div className="bg-nexia-vermelho/10 border border-nexia-vermelho/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-nexia-vermelho">Erro ao acessar dados da Graph API</p>
            </div>
          )}
            </>
          ) : (
            <div className="bg-nexia-amarelo/10 border border-nexia-amarelo/30 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Chave da Graph API não configurada</p>
              <p className="text-xs text-nexia-muted mb-3">Para usar esta funcionalidade, você precisa configurar a chave da Graph API da Meta.</p>
              <Botao onClick={() => rodar({ acao: "configurar-meta" })} disabled={ocupado} tipo="forte">
                📋 Gerar arquivo de configuração
              </Botao>
            </div>
          )
        ) : (
          <Carregando />
        )}
      </Cartao>

      <Cartao titulo="Rede de crescimento de seguidores (sem automação proibida)">
        <p className="text-sm text-nexia-muted">Roteiro diário de colaborações, enquetes e Reels com ganchos. O robô só prepara e agenda; a interação em massa nunca é automática (evita bloqueio da conta). Risco de banimento da conta é maior que o ganho. Custo 0.</p>
        <div className="space-y-3 text-sm text-nexia-muted pt-2">\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">1. Colaborações (Collabs)</p>\n            <p>Parcerias semanais com perfis do mesmo nicho. Publicação cruzada de Reels para alcançar novas audiências organicamente sem custo.</p>\n          </div>\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">2. Enquetes e Caixas de Perguntas</p>\n            <p>Engajamento diário nos Stories para reter seguidores e entender dores do público para novos conteúdos.</p>\n          </div>\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">3. Reels com Ganchos Fortes</p>\n            <p>Vídeos curtos focados nos primeiros 3 segundos (gancho de curiosidade ou dor imediata) e chamada para ação nos comentários.</p>\n          </div>\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">⚠️ Regra de Ouro da Segurança</p>\n            <p>O robô prepara os roteiros e materiais, mas a interação e postagem manual ou agendada respeitam os limites da plataforma. Interação em massa automatizada é proibida para evitar banimentos.</p>\n          </div>\n        </div>
      </Cartao>
    </div>
  );
}
