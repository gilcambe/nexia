import { useState, useEffect } from 'react';
import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
import { cn } from '@/lib/utils';

export default function CortexPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('cortex_theme') as 'dark' | 'light') || 'dark';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cortex_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={cn(
        "min-h-screen flex flex-col md:flex-row transition-colors duration-200",
        theme === 'dark' ? 'bg-[#0a0a0f] text-white' : 'bg-gray-50 text-gray-900'
      )}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-screen">
          <ChatArea onTogglePreview={() => setPreviewOpen(!previewOpen)} previewOpen={previewOpen} />
          <PreviewPanel isOpen={previewOpen} onClose={() => setPreviewOpen(false)} />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
