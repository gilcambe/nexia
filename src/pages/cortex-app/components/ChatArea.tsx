export default function ChatArea() {
  return (
    <main className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Chat</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="max-w-md p-3 rounded-lg bg-blue-600 text-white">
          Olá! Como posso ajudar você hoje?
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <input
          type="text"
          placeholder="Digite sua mensagem..."
          className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </main>
  );
}
