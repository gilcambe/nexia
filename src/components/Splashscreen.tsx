import { useEffect, useState } from 'react';

interface SplashscreenProps {
  isFirstVisit: boolean;
}

const Splashscreen = ({ isFirstVisit }: SplashscreenProps) => {
  const [isVisible, setIsVisible] = useState(isFirstVisit);

  useEffect(() => {
    if (isFirstVisit) {
      setIsVisible(true);
      
      // Timer para esconder a vinheta após 2 segundos
      const timer = setTimeout(() => {
        setIsVisible(false);
        
        // Marcar que não é mais a primeira visita
        localStorage.setItem('cortex-first-visit', 'false');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isFirstVisit]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-nexia-cyan/90 to-nexia-blue/90">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl mb-6 animate-pulse">
          <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Cortex</h1>
        <p className="text-xl text-white/90">Inteligência Artificial</p>
      </div>
    </div>
  );
};

export default Splashscreen;