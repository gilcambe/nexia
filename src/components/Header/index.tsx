import { useState } from 'react';

const NOME_PRODUTO = 'Cortex';

export default function Header() {
  const [aberto, setAberto] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2" role="link" tabIndex={0} aria-label="Página inicial do Cortex">
            <svg className="w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
              <path d="M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
              <path d="M12 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-slate-900">{NOME_PRODUTO}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-indigo-600 transition-colors">Início</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Conversa</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Pedidos</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-slate-600 hover:text-slate-900"
              aria-expanded={aberto}
              aria-controls="menu-mobile"
              onClick={() => setAberto(!aberto)}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <nav id="menu-mobile" className={`md:hidden fixed inset-0 z-40 bg-slate-900/95 ${aberto ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ul className="space-y-4 text-sm font-medium">
            <li>
              <a href="/cortex" className="block px-3 py-2 rounded hover:bg-white/10 text-white hover:text-indigo-300">Início</a>
            </li>
            <li>
              <a href="/cortex/conversa" className="block px-3 py-2 rounded hover:bg-white/10 text-white hover:text-indigo-300">Conversa</a>
            </li>
            <li>
              <a href="/cortex/pedidos" className="block px-3 py-2 rounded hover:bg-white/10 text-white hover:text-indigo-300">Pedidos</a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
