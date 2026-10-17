export default function PreviewPanel() {
  return (
    <aside className="hidden md:flex md:w-64 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-l border-gray-200 dark:border-gray-700 p-4 flex-col">
      <h3 className="text-sm font-semibold mb-2">Pré-visualização</h3>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Conteúdo aparecerá aqui.
      </div>
    </aside>
  );
}
