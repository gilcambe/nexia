import React, { useState, useEffect } from 'react';
import { useSpeechSynthesis } from 'react-speech-kit';
import { pipeline } from '@xenova/transformers';

interface Step {
  customer: string;
  expectedKeywords: string[];
  translation: string;
}

interface Script {
  title: string;
  description: string;
  steps: Step[];
}

const Simulador: React.FC = () => {
  const [script, setScript] = useState<Script | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [response, setResponse] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const { speak } = useSpeechSynthesis();

  useEffect(() => {
    const fetchScript = async () => {
      const res = await fetch('/roteiros/suporte-basico.json');
      const data = await res.json();
      setScript(data);
    };

    fetchScript();
  }, []);

  const handleSpeak = () => {
    if (script && script.steps[currentStep]) {
      speak({ text: script.steps[currentStep].customer });
    }
  };

  const handleResponseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResponse(e.target.value);
  };

  const handleSubmit = () => {
    if (script && script.steps[currentStep]) {
      const expectedKeywords = script.steps[currentStep].expectedKeywords;
      const responseKeywords = response.toLowerCase().split(' ');
      const matchedKeywords = expectedKeywords.filter(keyword =>
        responseKeywords.includes(keyword.toLowerCase())
      );

      const newScore = matchedKeywords.length / expectedKeywords.length;
      setScore(newScore);

      if (newScore === 1) {
        setFeedback('Great job! You matched all the expected keywords.');
      } else if (newScore >= 0.5) {
        setFeedback('Good effort! You matched some of the expected keywords.');
      } else {
        setFeedback('Keep trying! You can improve by matching more keywords.');
      }

      setCurrentStep(currentStep + 1);
      setResponse('');
    }
  };

  const handleListen = async () => {
    setIsListening(true);
    try {
      const recognizer = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      const result = await recognizer(response);
      setTranscript(result.text);
    } catch (error) {
      console.error('Error recognizing speech:', error);
    } finally {
      setIsListening(false);
    }
  };

  if (!script) {
    return <div>Loading script...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{script.title}</h1>
      <p className="mb-4">{script.description}</p>
      {script.steps[currentStep] ? (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Customer:</h2>
            <p>{script.steps[currentStep].customer}</p>
            <button onClick={handleSpeak} className="mt-2 p-2 bg-blue-500 text-white rounded">
              Hear Again
            </button>
          </div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Your Response:</h2>
            <textarea
              value={response}
              onChange={handleResponseChange}
              className="w-full p-2 border rounded"
              rows={4}
            />
            <button onClick={handleSubmit} className="mt-2 p-2 bg-green-500 text-white rounded">
              Submit
            </button>
            <button onClick={handleListen} disabled={isListening} className="mt-2 p-2 bg-yellow-500 text-white rounded">
              {isListening ? 'Listening...' : 'Speak'}
            </button>
            {transcript && (
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <h3 className="font-semibold">Transcript:</h3>
                <p>{transcript}</p>
              </div>
            )}
          </div>
          {feedback && (
            <div className="mb-4 p-2 bg-gray-100 rounded">
              <h2 className="text-xl font-semibold">Feedback:</h2>
              <p>{feedback}</p>
              <p>Score: {score.toFixed(2)}</p>
              <p>Expected Keywords: {script.steps[currentStep].expectedKeywords.join(', ')}</p>
              <p>Translation: {script.steps[currentStep].translation}</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold">Training Complete!</h2>
          <p>You have completed the training script.</p>
        </div>
      )}
    </div>
  );
};

export default Simulador;
