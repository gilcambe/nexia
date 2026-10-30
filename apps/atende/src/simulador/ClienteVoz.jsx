import React, { useState, useEffect } from 'react';
import './ClienteVoz.css';

const ClienteVoz = ({ roteiro }) => {
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSynthesisAvailable, setSpeechSynthesisAvailable] = useState(false);

  useEffect(() => {
    // Check if speech synthesis is available
    if ('speechSynthesis' in window) {
      setSpeechSynthesisAvailable(true);
    }

    // Set the initial speech
    if (roteiro && roteiro.length > 0) {
      setCurrentSpeech(roteiro[0].texto);
    }
  }, [roteiro]);

  const speak = (text) => {
    if (!speechSynthesisAvailable) {
      console.warn('Speech synthesis is not available in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleRepeat = () => {
    speak(currentSpeech);
  };

  if (!roteiro || roteiro.length === 0) {
    return <div className="cliente-voz">Nenhum roteiro disponível</div>;
  }

  return (
    <div className="cliente-voz">
      <div className="speech-bubble">
        <p>{currentSpeech}</p>
      </div>
      <div className="controls">
        <button
          onClick={handleRepeat}
          disabled={!speechSynthesisAvailable || isSpeaking}
          className="repeat-button"
        >
          Ouvir de novo
        </button>
      </div>
    </div>
  );
};

export default ClienteVoz;
