import { useState, useEffect } from 'react';
import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
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
