import React, { useState, useEffect, useRef } from \"react\";
import BlocoCodigo from \"@/components/BlocoCodigo\";

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
      // Simulação ou chamada real de streaming do Cortex
      const respostaCortex: Fala = {
        id: Math.random().toString(),
        quem: "cortex",
        texto: "Aqui está o código solicitado:\\n\\n```python\\n# Fibonacci em Python\\ndef fib(n):\\n    a, b = 0, 1\\n    for _ in range(n):\\n        print(a)\\n        a, b = b, a + b\\n\\nfib(5)\\n```\\n\\nE um exemplo em JavaScript:\\n\\n```js\\nconsole.log('Olá do JS isolado!');\\n```",
        modelo: "Claude 3.5 Sonnet"
      };
      setMensagens((prev) => [...prev, respostaCortex]);
    } catch (err) {
      setMensagens((prev) => [...prev, { id: Math.random().toString(), quem: "cortex", texto: "Erro ao consultar o Cortex." }]);
    } finally {
      setCarregando(false);
    }
  };

  const handleCorrigir = (codigo: string, erro: string) => {
    setInput(`Por favor, corrija o seguinte erro no código:\\nErro: ${erro}\\nCódigo:\\n${codigo}`);
  };

  // Renderizador simples de texto com suporte a blocos de código
  const renderizarTextoComCodigo = (texto: string) => {
    const regex = /```([a-zA-Z]*)\\n([\\s\\S]*?)```/g;
    const partes = [];
    let ultimoIndice = 0;
    let match;

    while ((match = regex.exec(texto)) !== null) {
      if (match.index > ultimoIndice) {
        partes.push(<span key={ultimoIndice}>{texto.substring(ultimoIndice, match.index)}</span>);
      }
      const linguagem = match[1] || 'text';
      const codigo = match[2];
      partes.push(
        <BlocoCodigo
          key={match.index}
          linguagem={linguagem}
          codigo={codigo}
          onCorrigir={handleCorrigir}
        />
      );
      ultimoIndice = regex.lastIndex;
    }

    if (ultimoIndice < texto.length) {
      partes.push(<span key={ultimoIndice}>{texto.substring(ultimoIndice)}</span>);
    }

    return partes;
  };

  return (
    <div className=\"flex flex-col h-full bg-[var(--cx-bg)] text-[var(--cx-txt)]\">\n      <div className=\"px-4 py-3 border-b border-[var(--cx-line)] flex items-center justify-between\">\n        <div className=\"flex items-center gap-3\">\n          {onVoltar && (\n            <button onClick={onVoltar} className=\"text-[var(--cx-mut)] hover:text-white\" data-testid=\"cx-voltar\">\n              ← Voltar\n            </button>\n          )}\n          <h1 className=\"font-semibold text-sm\">Nova Conversa com o Cortex</h1>\n        </div>\n      </div>\n\n      <div className=\"flex-1 overflow-y-auto p-4 space-y-4\">\n        {mensagens.map((m) => (\n          <div key={m.id} className={`flex gap-3 ${m.quem === 'dono' ? 'justify-end' : 'justify-start'}`}>\n            <div className={`max-w-[85%] rounded-2xl p-4 ${m.quem === 'dono' ? 'bg-[var(--cx-user)] text-white' : 'bg-[var(--cx-card)] border border-[var(--cx-line)]'}`}>\n              <div className=\"text-xs text-[var(--cx-mut)] mb-1\">\n                {m.quem === 'dono' ? 'Você' : `Cortex ${m.modelo ? `(${m.modelo})` : ''}`}\n              </div>\n              <div className=\"text-sm leading-relaxed whitespace-pre-wrap break-words\">\n                {renderizarTextoComCodigo(m.texto)}\n              </div>\n            </div>\n          </div>\n        ))}\n        {carregando && (\n          <div className=\"flex gap-3\">\n            <div className=\"p-4 rounded-2xl bg-[var(--cx-card)] border border-[var(--cx-line)] text-xs text-[var(--cx-mut)] animate-pulse\">\n              Cortex pensando...\n            </div>\n          </div>\n        )}\n        <div ref={fimRef} />\n      </div>\n\n      <div className=\"p-4 border-t border-[var(--cx-line)] bg-[var(--cx-card)]\">\n        <form\n          onSubmit={(e) => {\n            e.preventDefault();\n            enviar(input);\n          }}\n          className=\"flex gap-2 max-w-4xl mx-auto\"\n        >\n          <input\n            type=\"text\"\n            value={input}\n            onChange={(e) => setInput(e.target.value)}\n            placeholder=\"Pergunte algo ou cole código...\"\n            className=\"flex-1 bg-[var(--cx-bg)] border border-[var(--cx-line)] rounded-xl px-4 py-2.5 text-sm text-[var(--cx-txt)] focus:outline-none focus:border-[var(--cx-ac)]\"\n          />\n          <button\n            type=\"submit\"\n            disabled={carregando || !input.trim()}\n            className=\"px-5 py-2.5 bg-[var(--cx-ac)] text-black font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity\"\n          >\n            Enviar\n          </button>\n        </form>\n      </div>\n    </div>\n  );\n}\n
