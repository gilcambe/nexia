export default function Sidebar({ open, onToggle }: { open: boolean; onToggle: (v: boolean) => void }) {
  return (
    <aside className={cn("fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex-col transition-transform duration-300", open ? 'translate-x-0' : '-translate-x-full md:relative md:translate-x-0')}>
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-lg font-semibold">Cortex</h1>
        <button onClick={() => onToggle(false)} className="md:hidden p-2 hover:bg-gray-800 rounded" aria-label="Fechar menu">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <button className="w-full text-left p-3 rounded hover:bg-gray-800 transition">
          Conversas
        </button>
        <button className="w-full text-left p-3 rounded hover:bg-gray-800 transition">
          Arquivos
        </button>
        <button className="w-full text-left p-3 rounded hover:bg-gray-800 transition">
          Configurações
        </button>
      </nav>
    </aside>
  );
}
