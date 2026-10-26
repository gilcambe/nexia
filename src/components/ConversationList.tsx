import React, { useState, useEffect } from 'react';
import { Conversation, getConversations, createNewConversation } from '@/utils/localStorage';

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
  onCreateNewConversation: (conversation: Conversation) => void;
  selectedConversationId?: string;
}

const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  onCreateNewConversation,
  selectedConversationId
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadConversations();
  }, []);
  
  const loadConversations = () => {
    try {
      const savedConversations = getConversations();
      setConversations(savedConversations);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateNew = () => {
    const newConversation = createNewConversation('Nova Conversa');
    setConversations(prev => [newConversation, ...prev]);
    onCreateNewConversation(newConversation);
  };
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nexia-cyan"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Minhas Conversas</h2>
        <button
          onClick={handleCreateNew}
          className="bg-nexia-cyan hover:bg-nexia-cyan/90 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova
        </button>
      </div>
      
      {conversations.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Nenhuma conversa salva</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Clique em "Nova" para criar sua primeira conversa</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedConversationId === conversation.id
                  ? 'bg-nexia-cyan/10 border border-nexia-cyan'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {conversation.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {conversation.messages.length} mensagens
                  </p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 ml-4 flex-shrink-0">
                  {formatDate(conversation.updatedAt)}
                </div>
              </div>
              {conversation.messages.length > 0 && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 truncate">
                  {conversation.messages[conversation.messages.length - 1].content.substring(0, 60)}...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationList;