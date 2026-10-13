import { Message } from "../page";

interface ChatAreaProps {
  messages: Message[];
  onCopy: (text: string) => void;
  onRegenerate: (messageId: string) => void;
  onEditSend: (messageId: string) => void;
  onStop: () => void;
  loading: boolean;
}

export function ChatArea({
  messages,
  onCopy,
  onRegenerate,
  onEditSend,
  onStop,
  loading,
}: ChatAreaProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] md:max-w-[72%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
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
            {msg.role === "assistant" && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-nexia-border/30">
                <button
                  onClick={() => onCopy(msg.text)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-nexia-surface2 border border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/40 hover:bg-nexia-cyan/10 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Copiar resposta"
                >
                  <i className="ri-file-copy-line" /> Copiar
                </button>
                {!msg.streaming && msg.text && (
                  <button
                    onClick={() => onRegenerate(msg.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-nexia-surface2 border border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/40 hover:bg-nexia-cyan/10 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Regenerar resposta"
                  >
                    <i className="ri-refresh-line" /> Regenerar
                  </button>
                )}
                {!msg.streaming && msg.text && (
                  <button
                    onClick={() => onEditSend(msg.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-nexia-surface2 border border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/40 hover:bg-nexia-cyan/10 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Editar e reenviar"
                  >
                    <i className="ri-edit-line" /> Editar e reenviar
                  </button>
                )}
                {msg.streaming && (
                  <button
                    onClick={onStop}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Parar geração"
                  >
                    <i className="ri-stop-fill" /> Parar
                  </button>
                )}
              </div>
            )}
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
          </div>
        </div>
      ))}
      <div id="chat-bottom" />
    </div>
  );
}
