import React, { useState, useEffect, useRef } from "react";
import CodeBlockRunner from "@/components/CodeBlockRunner";

interface Fala {
  id: string;
  quem: "dono" | "cortex";
  texto: string;
  vivo?: boolean;
  modelo?: string;
  tokens?: number;
}

interface PerguntaProps {
  idPedido?: string;
  perguntaInicial?: string;
  onVoltar?: () => void;
}

export default function Pergunta({ idPedido, perguntaInicial, onVoltar }: PerguntaProps) {
  const [mensagens, setMensagens] = useState<Fala[]>([]);
  const [input, setInput] = useState(perguntaInicial || "");
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (perguntaInicial) {
      enviar(perguntaInicial);
    }
  }, [perguntaInicial]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  const enviar = async (textoMsg: string) => {
    if (!textoMsg.trim() || carregando) return;
    const novaMensagem: Fala = { id: Math.random().toString(), quem: "dono", texto: textoMsg };
    setMensagens((prev) => [...prev, novaMensagem]);
    setInput("");
    setCarregando(true);

    try {
          // Chamada real de streaming do Cortex
      const respostaStream = await fetch('/api/cortex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acao: 'perguntar',
          texto: textoMsg,
          idPedido: idPedido
        })
      });
      
      if (!respostaStream.ok) {
        throw new Error('Falha ao comunicar com o Cortex');
      }
      
      const reader = respostaStream.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        let acumulado = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          acumulado += chunk;
          
          // Atualiza a mensagem do Cortex em tempo real
          setMensagens((prev) => {
            const novas = [...prev];
            if (novas.length > 0 && novas[novas.length - 1].quem === 'cortex') {
              novas[novas.length - 1].texto = acumulado;
            } else {
              novas.push({
                id: Date.now().toString(),
                quem: 'cortex',
                texto: acumulado
              });
            }
            return novas;
          });
        }
      }
    } catch (err) {
      setMensagens((prev) => [...prev, { id: Math.random().toString(), quem: "cortex", texto: "Erro ao consultar o Cortex." }]);
    } finally {
      setCarregando(false);
    }
  };

  const handleCorrigir = (codigo: string, erro: string) => {
    setInput(`Por favor, corrija o seguinte erro no código:\\nErro: ${erro}\\nCódigo:\\n${codigo}`);
  };

  // Renderizador de texto com suporte a blocos de código usando CodeBlockRunner
  const renderizarTextoComCodigo = (texto: string) => {
    const regex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    const partes = [];
    let ultimoIndice = 0;
    let match;

    while ((match = regex.exec(texto)) !== null) {
      if (match.index > ultimoIndice) {
        partes.push(<span key={ultimoIndice}>{texto.substring(ultimoIndice, match.index)}</span>);
      }
      const linguagem = match[1] || 'text';
      const codigo = match[2];
      
      // Ignora blocos de código que não são executáveis
      const linguagemLower = linguagem.toLowerCase();
      if (['python', 'py', 'javascript', 'js', 'html'].includes(linguagemLower)) {
        partes.push(
          <CodeBlockRunner
            key={match.index}
            language={linguagem}
            code={codigo}
            onCorrigir={handleCorrigir}
          />
        );
      } else {
        // Para linguagens não executáveis, mostra como bloco de código normal
        partes.push(
          <div key={match.index} className="my-3 rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--cx-hover)] border-b border-[var(--cx-line)] text-xs font-mono">
              <span className="text-[var(--cx-mut)] uppercase tracking-wider">{linguagem}</span>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed bg-transparent text-[var(--cx-txt)]">
              <code>{codigo}</code>
            </pre>
          </div>
        );
      }
      ultimoIndice = regex.lastIndex;
    }

    if (ultimoIndice < texto.length) {
      partes.push(<span key={ultimoIndice}>{texto.substring(ultimoIndice)}</span>);
    }

    return partes;
  };

  return (
    <div className=\"flex flex-col h-full bg-[var(--cx-bg)] text-[var(--cx-txt)]\">\n      <div className=\"px-4 py-3 border-b border-[var(--cx-line)] flex items-center justify-between\">\n        <div className=\"flex items-center gap-3\">\n          {onVoltar && (\n            <button onClick={onVoltar} className=\"text-[var(--cx-mut)] hover:text-white\" data-testid=\"cx-voltar\">\n              ← Voltar\n            </button>\n          )}\n          <h1 className=\"font-semibold text-sm\">Nova Conversa com o Cortex</h1>\n        </div>\n      </div>\n\n      <div className=\"flex-1 overflow-y-auto p-4 space-y-4\">\n        {mensagens.map((m) => (\n          <div key={m.id} className={`flex gap-3 ${m.quem === 'dono' ? 'justify-end' : 'justify-start'}`}>\n            <div className={`max-w-[85%] rounded-2xl p-4 ${m.quem === 'dono' ? 'bg-[var(--cx-user)] text-white' : 'bg-[var(--cx-card)] border border-[var(--cx-line)]'}`}>\n              <div className=\"text-xs text-[var(--cx-mut)] mb-1\">\n                {m.quem === 'dono' ? 'Você' : `Cortex ${m.modelo ? `(${m.modelo})` : ''}`}\n              </div>\n              <div className=\"text-sm leading-relaxed whitespace-pre-wrap break-words\">\n                {renderizarTextoComCodigo(m.texto)}\n              </div>\n            </div>\n          </div>\n        ))}\n        {carregando && (\n          <div className=\"flex gap-3\">\n            <div className=\"p-4 rounded-2xl bg-[var(--cx-card)] border border-[var(--cx-line)] text-xs text-[var(--cx-mut)] animate-pulse\">\n              Cortex pensando...\n            </div>\n          </div>\n        )}\n        <div ref={fimRef} />\n      </div>\n\n      <div className=\"p-4 border-t border-[var(--cx-line)] bg-[var(--cx-card)]\">\n        <form\n          onSubmit={(e) => {\n            e.preventDefault();\n            enviar(input);\n          }}\n          className=\"flex gap-2 max-w-4xl mx-auto\"\n        >\n          <input\n            type=\"text\"\n            value={input}\n            onChange={(e) => setInput(e.target.value)}\n            placeholder=\"Pergunte algo ou cole código...\"\n            className=\"flex-1 bg-[var(--cx-bg)] border border-[var(--cx-line)] rounded-xl px-4 py-2.5 text-sm text-[var(--cx-txt)] focus:outline-none focus:border-[var(--cx-ac)]\"\n          />\n          <button\n            type=\"submit\"\n            disabled={carregando || !input.trim()}\n            className=\"px-5 py-2.5 bg-[var(--cx-ac)] text-black font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity\"\n          >\n            Enviar\n          </button>\n        </form>\n      </div>\n    </div>\n  );\n}\n
