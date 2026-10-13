import { useState, useEffect, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

// Theme Context Definition
interface ThemeContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// Sub-components for Cortex-v16 Layout & Functionality
import { 
  MessageSquare, Plus, Settings, ChevronLeft, ChevronRight, 
  Sun, Moon, Send, Sparkles, Code, Globe, Shield, Database, 
  Terminal, Cpu, FileText, CheckCircle2, RefreshCw, PanelRightOpen, X, Play
} from 'lucide-react';

function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'chats' | 'prompts' | 'artifacts'>('chats');

  return (
    <aside className={cn(
      "flex flex-col border-r border-border bg-card transition-all duration-300 z-20 relative select-none",
      isOpen ? "w-72" : "w-16"
    )}>
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        {isOpen ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
              C
            </div>
            <div>
              <h1 className="font-semibold text-sm tracking-tight text-foreground">Cortex-v16</h1>
              <p className="text-xs text-muted-foreground">Autonomous AI Engine</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg mx-auto shadow-sm">
            C
          </div>
        )}
        <button 
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={isOpen ? "Recolher barra" : "Expandir barra"}
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button 
          onClick={() => {}}
          className={cn(
            "w-full flex items-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 px-3 font-medium text-sm hover:opacity-95 transition-all shadow-sm",
            !isOpen && "justify-center px-0"
          )}
        >
          <Plus size={18} />
          {isOpen && <span>Novo Chat Cortex</span>}
        </button>
      </div>

      {/* Navigation Tabs */}
      {isOpen && (
        <div className="px-3 py-2 flex gap-1 border-b border-border/60">
          <button 
            onClick={() => setActiveTab('chats')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded transition-colors", activeTab === 'chats' ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Chats
          </button>
          <button 
            onClick={() => setActiveTab('prompts')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded transition-colors", activeTab === 'prompts' ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Prompts
          </button>
          <button 
            onClick={() => setActiveTab('artifacts')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded transition-colors", activeTab === 'artifacts' ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Artefatos
          </button>
        </div>
      )}

      {/* Sidebar Content List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isOpen ? (
          <>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1 tracking-wider">Recentes</div>
            {[
              { id: '1', title: 'Arquitetura de microsserviços v2', date: 'Hoje' },
              { id: '2', title: 'Análise de segurança Cloudflare', date: 'Ontem' },
              { id: '3', title: 'Otimização de queries PostgreSQL', date: '3 dias atrás' }
            ].map(chat => (
              <button 
                key={chat.id}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent/80 text-foreground/90 transition-colors flex items-center gap-3 group"
              >
                <MessageSquare size={16} className="text-muted-foreground group-hover:text-primary shrink-0" />
                <div className="truncate flex-1">
                  <div className="truncate font-medium">{chat.title}</div>
                  <div className="text-[11px] text-muted-foreground">{chat.date}</div>
                </div>
              </button>
            ))}
          </>
        ) : (
          <div className="space-y-2 flex flex-col items-center">
            <div className="w-9 h-9 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer" title="Chats recentes">
              <MessageSquare size={18} />
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-border flex flex-col gap-2">
        <button 
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            !isOpen && "justify-center px-0"
          )}
        >
          {theme === 'dark' ? <Sun size={18} className="text-amber-400 shrink-0" /> : <Moon size={18} className="text-indigo-600 shrink-0" />}
          {isOpen && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>}
        </button>

        <button 
          onClick={() => {}}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            !isOpen && "justify-center px-0"
          )}
        >
          <Settings size={18} className="shrink-0" />
          {isOpen && <span>Configurações</span>}
        </button>
      </div>
    </aside>
  );
}

function ChatArea({ onTogglePreview, isPreviewOpen }: { onTogglePreview: () => void; isPreviewOpen: boolean }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o Cortex-v16, seu assistente autônomo avançado. Como posso ajudar na arquitetura ou no código do seu projeto hoje?' }
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Recebi sua solicitação: "${userMsg}". Analisei a base de código e estou pronto para executar as melhorias necessárias com total precisão e robustez.` 
      }]);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cortex v16 Online
          </span>
          <span className="text-sm text-muted-foreground hidden sm:inline">| Workspace Ativo: gilcambe/nexia</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onTogglePreview}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              isPreviewOpen ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
            )}
          >
            <PanelRightOpen size={16} />
            <span>Painel de Preview</span>
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6 w-full">
          {messages.map((msg, index) => (
            <div key={index} className={cn("flex gap-4", msg.role === 'user' ? "justify-end" : "justify-start")}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                  C
                </div>
              )}
              <div className={cn(
                "rounded-2xl px-4 py-3 text-sm max-w-[85%] leading-relaxed shadow-sm",
                msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border text-card-foreground rounded-tl-none"
              )}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 font-bold text-sm">
                  U
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="p-4 sm:p-6 border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem para o Cortex-v16..."
              className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground shadow-sm"
            />
            <button 
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Send size={16} />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 px-1 text-xs text-muted-foreground">
            <span>Pressione Enter para enviar</span>
            <span>Cortex-v16 Autonomia Nível 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ isOpen, onClose, content }: { isOpen: boolean; onClose: () => void; content: string | null }) {
  if (!isOpen) return null;

  return (
    <aside className="w-80 lg:w-96 border-l border-border bg-card flex flex-col z-20 shadow-xl animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Code size={16} className="text-primary" />
          Painel de Pré-visualização
        </h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg border border-border bg-background p-4 text-sm">
          <h3 className="font-medium mb-2 text-foreground">Estado do Preview</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {content || "Nenhum artefato selecionado no momento. Interaja com o chat para gerar código, diagramas ou visualizações em tempo real."}
          </p>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funcionalidades Cortex-v16</span>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
              <Cpu size={18} className="text-primary" />
              <div>
                <div className="text-xs font-medium">Análise de Código</div>
                <div className="text-[11px] text-muted-foreground">Linting e validação em tempo real</div>
              </div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
              <Shield size={18} className="text-emerald-500" />
              <div>
                <div className="text-xs font-medium">Segurança e Vault</div>
                <div className="text-[11px] text-muted-foreground">Proteção de segredos e credenciais</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function CortexPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={cn("min-h-screen flex bg-background text-foreground transition-colors duration-200", theme)}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 flex flex-col min-w-0 relative">
          <ChatArea 
            onTogglePreview={() => setPreviewOpen(!previewOpen)}
            isPreviewOpen={previewOpen}
          />
        </main>

        <PreviewPanel 
          isOpen={previewOpen} 
          onClose={() => setPreviewOpen(false)}
          content={previewContent}
        />
      </div>
    </ThemeContext.Provider>
  );
}


