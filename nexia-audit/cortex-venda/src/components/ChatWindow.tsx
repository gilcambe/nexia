import React, { useState, useEffect } from 'react';
import { sendMessage } from '../api/chat';
import ChatInput from './ChatInput';

interface Message {
  text: string;
  isUser: boolean;
  imageUrl?: string;
  response?: string;
}

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (text: string, files: File[] = []) => {
    setIsLoading(true);

    try {
      const imageUrls = await Promise.all(files.map(file => URL.createObjectURL(file)));
      const newMessage: Message = {
        text,
        isUser: true,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : undefined,
      };
      setMessages(prevMessages => [...prevMessages, newMessage]);

      const response = await sendMessage(text, files);

      const botMessage: Message = {
        text: response.text,
        isUser: false,
        response: response.response,
      };
      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={index} className={`mb-4 ${message.isUser ? 'text-right' : 'text-left'}`}>
            {message.imageUrl && (
              <div className="mb-2">
                <img
                  src={message.imageUrl}
                  alt="Uploaded"
                  className="max-w-xs rounded-lg"
                />
              </div>
            )}
            <div className={`inline-block p-2 rounded-lg ${message.isUser ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              {message.text}
            </div>
            {message.response && (
              <div className="mt-2 p-2 bg-gray-100 rounded-lg">
                <p className="font-bold">Resposta do Kernex Cortex:</p>
                <p>{message.response}</p>
              </div>
            )}
          </div>
        ))}
        {isLoading && <div className="text-center">Carregando...</div>}
      </div>
      <ChatInput onSend={handleSendMessage} disabled={isLoading} />
    </div>
  );
};

export default ChatWindow;
