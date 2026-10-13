import { useState, useEffect } from 'react';
import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
import { cn } from '@/lib/utils';

export default function CortexPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza tema com o documento ou classes
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div className={cn("min-h-screen flex flex-col md:flex-row bg-[#0a0a0f] text-white transition-colors duration-200", theme === 'light' ? 'bg-gray-50 text-gray-900' : '')}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <ChatArea 
            onOpenPreview={(content) => {
              setPreviewContent(content);
              setPreviewOpen(true);
            }} 
          />
        </main>
        {previewOpen && (
          <PreviewPanel 
            content={previewContent} 
            onClose={() => setPreviewOpen(false)} 
          />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
