import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:grid-cols-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Nexia</h3>
            <p className="text-sm text-gray-400">Plataforma de automação e IA para negócios.</p>
          </div>
          <nav className="flex flex-col sm:flex-row gap-2 sm:gap-6 justify-center sm:justify-start text-sm space-y-1 sm:space-y-0">
            <a href="/termos" className="text-blue-400 hover:text-blue-300 transition-colors">Termos de Serviço</a>
            <a href="/privacidade" className="text-blue-400 hover:text-blue-300 transition-colors">Política de Privacidade</a>
          </nav>
        </div>
        <div className="mt-8 border-t border-gray-800 pt-8 text-center sm:text-left">
          <p className="text-xs text-gray-500">© 2026 NEXIA. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
