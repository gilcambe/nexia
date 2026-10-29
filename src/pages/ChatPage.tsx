import React, { useState, useEffect } from 'react';
import SitePreview from '../components/SitePreview.vue';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [siteSpec, setSiteSpec] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    // Add user message to the chat
    const userMessage = { text: inputValue, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue('');

    // Simulate AI response
    const aiResponse = await simulateAIResponse(inputValue);
    setMessages(prevMessages => [...prevMessages, aiResponse]);

    // Check if the response contains a site spec
    if (aiResponse.siteSpec) {
      setSiteSpec(aiResponse.siteSpec);
      setShowPreview(true);
    }
  };

  const simulateAIResponse = async (userInput: string) => {
    // This is a simulation - in a real app, you would call your AI service
    if (userInput.toLowerCase().includes('create site')) {
      // Simulate generating a site spec
      const siteSpec = {
        title: 'My New Website',
        sections: [
          { type: 'header', content: 'Welcome to My Website' },
          { type: 'text', content: 'This is a sample website created with our AI.' },
          { type: 'button', content: 'Learn More', link: '/about' }
        ]
      };

      return {
        text: 'I have created a new website for you!',
        sender: 'ai',
        siteSpec: siteSpec
      };
    }

    return {
      text: 'I received your message: ' + userInput,
      sender: 'ai'
    };
  };

  return (
    <div className="chat-page">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            {message.text}
          </div>
        ))}
      </div>

      {showPreview && siteSpec && (
        <SitePreview siteSpec={siteSpec} />
      )}

      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatPage;
