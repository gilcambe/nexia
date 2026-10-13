import { useState } from 'react';
import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
import { cn } from '@/lib/utils';

export default function CortexPage() {
  const theme = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([
    { id: '1', role: 'assistant', content: 'Olá! Como posso ajudar você hoje no Cortex-p1?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([
    { id: 'proj-1', name: 'Projeto Padrão' }
  ]);
  const [currentProject, setCurrentProject] = useState('proj-1');

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Simulação de resposta integrada do modelo e streaming
      setTimeout(() => {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: `Recebi sua mensagem: "${userMessage.content}". Processando via modelo ${selectedModel} no projeto ${currentProject}...`
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      <div className={cn("min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200", theme.theme)}>
        <div className="flex flex-1 h-[calc(100vh)] overflow-hidden">
          <Sidebar 
            isOpen={sidebarOpen} 
            onToggle={() => setSidebarOpen(!sidebarOpen)} 
            currentChatId={currentChatId} 
            onSelectChat={setCurrentChatId}
            projects={projects}
            currentProject={currentProject}
            onSelectProject={setCurrentProject}
          />
          <main className="flex-1 flex flex-col min-w-0 relative">
            <ChatArea 
              chatId={currentChatId} 
              onTogglePreview={() => setPreviewOpen(!previewOpen)} 
              previewOpen={previewOpen}
              messages={messages}
              input={input}
              setInput={setInput}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            />
          </main>
          {previewOpen && <PreviewPanel onClose={() => setPreviewOpen(false)} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
