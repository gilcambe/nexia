import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// O Chrome pode disparar o evento antes de a tela montar: guarda já ao carregar o módulo.
let saved: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    saved = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    saved = null;
    listeners.forEach((fn) => fn());
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(saved);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const update = () => setPrompt(saved);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  if (isStandalone() || (!prompt && !isIos())) return null;

  const onClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        saved = null;
        setPrompt(null);
      }
      return;
    }
    setHelp((h) => !h);
  };

  return (
    <div className={compact ? 'relative' : ''}>
      <button
        onClick={onClick}
        className={
          compact
            ? 'flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition hover:bg-primary-600'
            : 'mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-600 transition hover:bg-background-100'
        }
      >
        <i className={`ri-download-2-line ${compact ? 'text-base' : 'text-lg'}`}></i>
        Instalar app
      </button>
      {help && (
        <p
          className={
            compact
              ? 'absolute right-0 top-11 z-40 w-64 rounded-xl border border-background-200 bg-background-50 p-3 text-xs text-foreground-700 shadow-lg'
              : 'mx-3 mt-1 rounded-lg bg-background-100 p-3 text-xs text-foreground-700'
          }
        >
          No Safari, toque em Compartilhar <i className="ri-share-box-line"></i> e depois em "Adicionar à Tela de Início".
        </p>
      )}
    </div>
  );
}
