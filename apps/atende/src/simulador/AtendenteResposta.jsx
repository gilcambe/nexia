import React, { useState, useRef, useEffect } from 'react';
import { loadWhisper, transcribeAudio } from './whisperWasmLoader';
import './AtendenteResposta.css';

const AtendenteResposta = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState('text');
  const [whisperLoaded, setWhisperLoaded] = useState(false);
  const [cloudFallback, setCloudFallback] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const initializeWhisper = async () => {
      try {
        await loadWhisper();
        setWhisperLoaded(true);
      } catch (error) {
        console.error('Failed to load Whisper:', error);
        setCloudFallback(true);
      }
    };

    initializeWhisper();
  }, []);

  const handleTextChange = (e) => {
    setMessage(e.target.value);
  };

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      setIsLoading(true);
      setActiveMode('voice');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        try {
          if (whisperLoaded && !cloudFallback) {
            const transcription = await transcribeAudio(audioBlob);
            setMessage(transcription);
          } else {
            // Fallback to cloud transcription
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');

            const response = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Cloud transcription failed');
            }

            const result = await response.json();
            setMessage(result.transcription);
          }
        } catch (error) {
          console.error('Transcription error:', error);
          alert('Failed to transcribe audio. Please try again.');
        } finally {
          setIsLoading(false);
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsLoading(false);
      setActiveMode('text');
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleCloudTranscription = () => {
    setCloudFallback(!cloudFallback);
    setActiveMode(cloudFallback ? 'text' : 'cloud');
  };

  return (
    <div className="atendente-resposta-container">
      <div className="mode-indicator">
        {activeMode === 'text' && <span>Modo: Digitação</span>}
        {activeMode === 'voice' && <span>Modo: Fala (WASM)</span>}
        {activeMode === 'cloud' && <span>Modo: Transcrição na nuvem</span>}
      </div>

      <div className="input-container">
        <textarea
          value={message}
          onChange={handleTextChange}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua resposta..."
          disabled={isRecording || isLoading}
          className="text-input"
        />

        <div className="button-group">
          <button
            onClick={handleSend}
            disabled={!message.trim() || isRecording || isLoading}
            className="send-button"
          >
            Enviar
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || (activeMode === 'cloud' && !cloudFallback)}
            className={`voice-button ${isRecording ? 'recording' : ''}`}
          >
            {isRecording ? 'Parar' : 'Falar'}
          </button>

          {whisperLoaded && (
            <button
              onClick={toggleCloudTranscription}
              className={`cloud-button ${cloudFallback ? 'active' : ''}`}
              title="Ativar transcrição na nuvem"
            >
              Nuvem
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <span>Processando áudio...</span>
        </div>
      )}
    </div>
  );
};

export default AtendenteResposta;
