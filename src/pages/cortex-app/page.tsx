import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
import { cn } from '@/lib/utils';

export default function CortexPage() {
  const themeState = useTheme();
  return (
    <ThemeContext.Provider value={themeState}>
      <div className={cn("flex h-screen w-screen overflow-hidden", themeState.theme === 'dark' ? 'dark bg-gray-950 text-white' : 'bg-gray-50 text-gray-900')}>
        <Sidebar />
        <ChatArea />
        <PreviewPanel />
      </div>
    </ThemeContext.Provider>
  );
}
