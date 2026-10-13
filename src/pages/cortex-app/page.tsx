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

  return (
    <ThemeContext.Provider value={theme}>
      <div className={cn("min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200", theme.theme)}>
        <div className="flex flex-1 h-[calc(100vh)] overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} currentChatId={currentChatId} onSelectChat={setCurrentChatId} />
          <main className="flex-1 flex flex-col min-w-0 relative">
            <ChatArea chatId={currentChatId} onTogglePreview={() => setPreviewOpen(!previewOpen)} previewOpen={previewOpen} />
          </main>
          {previewOpen && <PreviewPanel onClose={() => setPreviewOpen(false)} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
