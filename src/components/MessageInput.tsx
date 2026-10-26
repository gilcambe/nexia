'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const MessageInput = ({ onSendMessage, disabled = false }: MessageInputProps) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua mensagem..."
          disabled={disabled}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-nexia-cyan focus:border-transparent resize-none"
          rows={1}
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="p-3 bg-nexia-cyan hover:bg-nexia-cyan/90 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
};

export default MessageInput;