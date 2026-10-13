import { useCallback } from "react";
import type { Message } from "../page";

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  onCopy: (text: string) => void;
  onRegenerate: (assistantMsgId: string) => void;
  onEditSend: (assistantMsgId: string) => void;
  onStop: (assistantMsgId: string) => void;
}

export function ChatArea({
  messages,
  loading,
  onCopy,
  onRegenerate,
  onEditSend,
  onStop,
}: ChatAreaProps) {
  const isLastMessageStreaming = useCallback(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    return assistantMessages.length > 0 && assistantMessages[assistantMessages.length - 1].streaming;
  }, [messages]);

  const showActions = useCallback((msg: Message) => {
    return msg.role === "assistant" && !msg.streaming;
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] md:max-w-[72%] rounded-xl px-4 py-3 text-sm leading-relaxed relative ${
              msg.role === "user"
                ? "bg-nexia-cyan/15 text-white border border-nexia-cyan/25"
                : "bg-nexia-surface text-nexia-muted border border-nexia-border"
            }`}
          >
            {msg.role === "assistant" && msg.model && (
              <div className="flex items-center gap-1.5 mb-2">
                <i className="ri-brain-line text-nexia-cyan text-xs" />
                <span className="text-[10px] font-semibold text-nexia-cyan uppercase tracking-wider">{msg.model}</span>
                {msg.streaming && <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-pulse ml-1" />}
              </div>
            )}
            <div className="whitespace-pre-wrap break-words">{msg.text}</div>
            {msg.imagem && (
              <a href={msg.imagem} target="_blank" rel="noreferrer">
                <img src={msg.imagem} alt="Imagem gerada" className="mt-2 rounded-lg max-w-full" loading="lazy" />
              </a>
            )}
            {msg.streaming && msg.text && (
              <div className="mt-2 flex items-center gap-1.5 border-t border-nexia-border/50 pt-2">
                <i className="ri-loader-4-line animate-spin text-nexia-cyan text-xs" />
                <span className="text-[10px] text-nexia-muted">Recebendo tokens...</span>
              </div>
            )}
            {msg.streaming && !msg.text && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}

            {/* Action buttons for assistant messages */}
            {showActions(msg) && (
              <div className="flex space-x-2 mt-4 pt-3 border-t border-nexia-border/30">
                <button
                  onClick={() => onCopy(msg.text)}
                  className="btn btn-primary text-xs px-3 py-1.5"
                  title="Copiar resposta"
                >
                  <i className="ri-file-copy-line mr-1" /> Copiar
                </button>
                <button
                  onClick={() => onRegenerate(msg.id)}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                  title="Regenerar resposta"
                  disabled={loading}
                >
                  <i className="ri-refresh-line mr-1" /> Regenerar
                </button>
                <button
                  onClick={() => onEditSend(msg.id)}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                  title="Editar e reenviar"
                  disabled={loading}
                >
                  <i className="ri-edit-line mr-1" /> Editar e Reenviar
                </button>
                {msg.streaming && (
                  <button
                    onClick={() => onStop(msg.id)}
                    className="btn btn-danger text-xs px-3 py-1.5"
                    title="Parar geração"
                  >
                    <i className="ri-stop-fill mr-1" /> Parar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      <div id="chat-bottom" />
    </div>
  );
}

export default ChatArea;
