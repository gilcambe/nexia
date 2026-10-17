import { useState, useEffect } from 'react';
import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
import { cn } from '@/lib/utils';

export default function CortexPage() {
  const themeState = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  return (
    <ThemeContext.Provider value={themeState}>
      <div className={cn("min-h-screen flex flex-col transition-colors duration-200", themeState.theme === 'dark' ? "bg-[#0a0a0f] text-white" : "bg-gray-50 text-gray-900")}>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
          <ChatArea onOpenPreview={(content) => { setPreviewContent(content); setPreviewOpen(true); }} />
          {previewOpen && (
            <PreviewPanel content={previewContent} onClose={() => setPreviewOpen(false)} />
          )}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
